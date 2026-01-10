"""
[배당 데이터 전처리기 (Processor)]
Raw DB에 적재된 DART 배당 데이터를 읽어 분석 가능한 형태(Mart)로 정제 및 구조화하는 스크립트입니다.

Roles:
1. Cleaning: 문자열 수치 변환 ('1,000' -> 1000.0), 결측치 처리
2. Pivoting: 세로형(Long) 데이터를 가로형(Wide)으로 변환 (SE 컬럼 기준)
3. Broadcasting: 기업 전체 지표(EPS 등)를 주식 종류별 행에 병합
4. Normalization: 보고서 코드 매핑 (11011 -> 4Q)

Input: DB Table 'dart_dividends_raw'
Output: DB Table 'dart_dividends'

Usage:
    python clean_dividends.py --corp_code 00126380 --year 2023
"""

import pandas as pd
import sys
import argparse
from pathlib import Path
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from tqdm import tqdm

# 프로젝트 루트 경로 추가
sys.path.append(str(Path(__file__).resolve().parents[3]))
from data.schema.db_models import SessionLocal, DartDividendRaw, DartDividend, engine

def clean_value(val):
    """문자열 숫자를 정제하여 Float/Int 변환 가능한 형태로 만듦"""
    if pd.isna(val) or val == '-':
        return None
    if isinstance(val, str):
        # 괄호 제거, 콤마 제거
        val = val.replace(',', '').replace('(', '').replace(')', '')
        try:
            return float(val)
        except ValueError:
            return None
    return val

def process_dividends(target_corp_code=None, target_year=None):
    """Raw 데이터를 읽어 정제(Cleaning) 및 피벗(Pivoting) 후 분석용 테이블에 적재"""
    
    filter_msg = []
    if target_corp_code: filter_msg.append(f"Corp: {target_corp_code}")
    if target_year: filter_msg.append(f"Year: {target_year}")
    filter_str = f" ({', '.join(filter_msg)})" if filter_msg else " (All Data)"
    
    print(f"배당 데이터 전처리 시작{filter_str}...")
    
    # 1. Raw Data 로드 (Incremental Processing을 위한 필터링)
    with SessionLocal() as session:
        query = session.query(DartDividendRaw)
        
        if target_corp_code:
            query = query.filter(DartDividendRaw.corp_code == target_corp_code)
        if target_year:
            query = query.filter(DartDividendRaw.bsns_year == target_year)
            
        raw_df = pd.read_sql(query.statement, session.bind)
    
    if raw_df.empty:
        print("처리할 Raw 데이터가 없습니다.")
        return

    print(f"Raw Data 로드 완료: {len(raw_df)}행")

    # 피벗을 위해 필요한 컬럼만 추출
    df = raw_df[['corp_code', 'corp_name', 'bsns_year', 'reprt_code', 'stock_knd', 'se', 'thstrm', 'stlm_dt']].copy()
    
    # 3. 데이터 정제 (수치 변환)
    df['clean_value'] = df['thstrm'].apply(clean_value)
    
    # 4. 피벗 (Long -> Wide)
    pivot_df = df.pivot_table(
        index=['corp_code', 'corp_name', 'bsns_year', 'reprt_code', 'stock_knd', 'stlm_dt'],
        columns='se',
        values='clean_value',
        aggfunc='first'
    ).reset_index()
    
    print(f"피벗 완료: {len(pivot_df)}행 (Wide Format)")

    # 1) 공통 지표와 종목별 지표 분리
    common_mask = (pivot_df['stock_knd'].isnull()) | (pivot_df['stock_knd'] == '') | (pivot_df['stock_knd'] == 'None')
    common_df = pivot_df[common_mask].copy()
    stock_df = pivot_df[~common_mask].copy()

    # 2) 병합을 위한 키 컬럼 설정
    merge_keys = ['corp_code', 'bsns_year', 'reprt_code']
    
    # 3) 공통 지표 컬럼만 추출
    meta_cols = ['corp_code', 'corp_name', 'bsns_year', 'reprt_code', 'stock_knd', 'stlm_dt']
    se_cols = [c for c in pivot_df.columns if c not in meta_cols]
    common_values = common_df[merge_keys + se_cols]
    common_values = common_values.drop_duplicates(subset=merge_keys)

    # 4) 종목별 데이터프레임에 공통 지표 병합
    merged_df = pd.merge(stock_df, common_values, on=merge_keys, how='left', suffixes=('', '_common'))

    # 5) 값 합치기 (Coalesce)
    for col in se_cols:
        common_col = f"{col}_common"
        if common_col in merged_df.columns:
            merged_df[col] = merged_df[col].fillna(merged_df[common_col])
    
    # 6) 보고서 코드 매핑 (11013 -> 1Q 등)
    reprt_map = {
        '11013': '1Q',
        '11012': '2Q',
        '11014': '3Q',
        '11011': '4Q'
    }
    merged_df['reprt_name'] = merged_df['reprt_code'].map(reprt_map).fillna(merged_df['reprt_code'])

    # 처리 완료된 데이터프레임을 최종 df로 사용
    final_df = merged_df
    print(f"병합 및 매핑 완료: {len(final_df)}행 (공통 지표 통합됨)")

    records = []
    for _, row in tqdm(final_df.iterrows(), total=len(final_df), desc="Processing"):
        def get_val(keywords):
            for col in final_df.columns:
                if col in meta_cols or col.endswith('_common') or col == 'reprt_name':
                    continue
                if any(k in col for k in keywords):
                    val = row[col]
                    if pd.notnull(val):
                        if '백만원' in col:
                            return val * 1_000_000
                        return val
            return None

        records.append({
            'corp_code': row['corp_code'],
            'corp_name': row['corp_name'],
            'bsns_year': row['bsns_year'],
            'reprt_code': row['reprt_name'],
            'stock_knd': row['stock_knd'],
            'stlm_dt': row['stlm_dt'],
            'dps': get_val(['주당 현금배당금']),
            'dividend_yield': get_val(['현금배당수익률']),
            'total_dividend': get_val(['현금배당금총액']),
            'net_income': get_val(['당기순이익']),
            'eps': get_val(['주당순이익']),
            'payout_ratio': get_val(['현금배당성향'])
        })

    if not records:
        print("적재할 데이터가 없습니다.")
        return

    with SessionLocal() as session:
        try:
            stmt = insert(DartDividend).values(records)
            update_dict = {
                'corp_name': stmt.excluded.corp_name,
                'dps': stmt.excluded.dps,
                'dividend_yield': stmt.excluded.dividend_yield,
                'total_dividend': stmt.excluded.total_dividend,
                'net_income': stmt.excluded.net_income,
                'eps': stmt.excluded.eps,
                'payout_ratio': stmt.excluded.payout_ratio,
                'stlm_dt': stmt.excluded.stlm_dt
            }
            on_conflict_stmt = stmt.on_conflict_do_update(
                constraint='uix_dividend_clean_identifier',
                set_=update_dict
            )
            session.execute(on_conflict_stmt)
            session.commit()
            print(f"전처리 완료: {len(records)}건 DB 적재 성공")
        except Exception as e:
            session.rollback()
            print(f"[ERROR] DB 적재 실패: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='DART 배당 정보 전처리 스크립트')
    parser.add_argument('--corp_code', type=str, help='처리할 기업 고유번호 (Optional)')
    parser.add_argument('--year', type=str, help='처리할 사업 연도 (Optional)')
    
    args = parser.parse_args()
    process_dividends(args.corp_code, args.year)