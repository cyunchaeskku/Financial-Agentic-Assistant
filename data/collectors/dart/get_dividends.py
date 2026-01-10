"""
[DART 배당 정보 수집기]
DART Open API를 호출하여 특정 기업의 배당 정보를 수집하고 Raw Data 테이블에 적재하는 스크립트입니다.

Roles:
1. API 호출: DART '배당에 관한 사항' API 호출
2. DB 적재: 수집된 JSON 응답을 그대로 dart_dividends_raw 테이블에 Upsert (ELT의 Load 단계)

Usage:
    python get_dividends.py --corp_code 00126380 --year 2023 --reprt_code 11011

Arguments:
    --corp_code (str): DART 고유번호 (8자리)
    --year (str): 사업연도 (YYYY)
    --reprt_code (str): 보고서 코드 (11011:사업, 11012:반기, 11013:1분기, 11014:3분기)
"""

import requests
import pandas as pd
import os
import argparse
import sys
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.dialects.postgresql import insert

# 프로젝트 루트 경로 추가 (schema 모듈 import용)
sys.path.append(str(Path(__file__).resolve().parents[3]))
from data.schema.db_models import SessionLocal, DartDividendRaw

load_dotenv()

# 환경 설정
API_KEY = os.getenv('DART_API_KEY')
DIVIDEND_API_URL = 'https://opendart.fss.or.kr/api/alotMatter.json'

def fetch_dividend_data(corp_code: str, bsns_year: str, reprt_code: str) -> list:
    """특정 기업의 배당 정보를 API로부터 수집한다."""
    params = {
        'crtfc_key': API_KEY,
        'corp_code': corp_code,
        'bsns_year': bsns_year,
        'reprt_code': reprt_code
    }
    
    try:
        res = requests.get(DIVIDEND_API_URL, params=params)
        data = res.json()
        
        if data['status'] == '000':
            return data['list']
        elif data['status'] == '013':
            print(f"[{corp_code}] {bsns_year}년 {reprt_code} 보고서 데이터 없음")
            return []
        else:
            print(f"[ERROR] API 호출 오류 ({corp_code}): {data['message']}")
            return []
            
    except Exception as e:
        print(f"[ERROR] 요청 실패: {e}")
        return []

def save_to_db_raw(dividends: list, year: str, reprt_code: str):
    """수집된 배당 데이터를 Raw 테이블에 Upsert 한다."""
    if not dividends:
        return

    session = SessionLocal()
    try:
        # 딕셔너리 리스트 생성 (API 응답 필드 -> DB 컬럼 매핑)
        # API 응답에는 year, reprt_code가 없으므로 주입 필요
        records = []
        for item in dividends:
            records.append({
                'rcept_no': item.get('rcept_no'),
                'corp_code': item.get('corp_code'),
                'corp_name': item.get('corp_name'),
                'bsns_year': year, # 인자로 받은 값 사용
                'reprt_code': reprt_code, # 인자로 받은 값 사용
                'se': item.get('se'),
                'stock_knd': item.get('stock_knd') if item.get('stock_knd') else '', # NULL 방지 (빈 문자열)
                'thstrm': item.get('thstrm'),
                'frmtrm': item.get('frmtrm'),
                'lwfr': item.get('lwfr'),
                'stlm_dt': item.get('stlm_dt')
            })

        # PostgreSQL Upsert 구문 생성
        stmt = insert(DartDividendRaw).values(records)
        
        # 충돌 시 업데이트할 컬럼들 (모든 데이터 컬럼)
        update_dict = {
            'rcept_no': stmt.excluded.rcept_no,
            'corp_name': stmt.excluded.corp_name,
            'thstrm': stmt.excluded.thstrm,
            'frmtrm': stmt.excluded.frmtrm,
            'lwfr': stmt.excluded.lwfr,
            'stlm_dt': stmt.excluded.stlm_dt
        }
        
        # ON CONFLICT DO UPDATE 실행
        # constraint 이름은 모델에서 정의한 'uix_dividend_raw_identifier'
        on_conflict_stmt = stmt.on_conflict_do_update(
            constraint='uix_dividend_raw_identifier',
            set_=update_dict
        )
        
        session.execute(on_conflict_stmt)
        session.commit()
        print(f"DB 저장 완료: {len(records)}건 Upsert")
        
    except Exception as e:
        session.rollback()
        print(f"[ERROR] DB 저장 실패: {e}")
    finally:
        session.close()

def main():
    parser = argparse.ArgumentParser(description='DART 배당 정보 수집 및 DB 적재 스크립트')
    parser.add_argument('--corp_code', type=str, required=True, help='DART 기업 고유번호 (8자리)')
    parser.add_argument('--year', type=str, required=True, help='사업 연도 (YYYY)')
    parser.add_argument('--reprt_code', type=str, default='11011', 
                        help='보고서 코드 (11011: 사업, 11012: 반기, 11013: 1분기, 11014: 3분기)')
    
    args = parser.parse_args()
    
    print(f"배당 정보 수집 시작: {args.corp_code} ({args.year}, {args.reprt_code})")
    
    dividends = fetch_dividend_data(args.corp_code, args.year, args.reprt_code)
    
    if not dividends:
        print("수집된 데이터가 없습니다.")
        return

    # DB 적재 (Raw Data)
    save_to_db_raw(dividends, args.year, args.reprt_code)

if __name__ == "__main__":
    main()