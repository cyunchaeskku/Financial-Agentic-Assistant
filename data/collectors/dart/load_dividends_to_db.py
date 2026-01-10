import pandas as pd
from sqlalchemy.dialects.postgresql import insert
import sys
import os
from pathlib import Path
from tqdm import tqdm

# 프로젝트 루트 경로 추가 (schema 모듈 import용)
sys.path.append(str(Path(__file__).resolve().parents[3]))
from data.schema.db_models import SessionLocal, DartDividend, init_db

# CSV 파일 경로 설정
BASE_DIR = Path(__file__).resolve().parents[2] # data/
CSV_PATH = BASE_DIR / 'storage' / 'raw' / 'dart' / 'dividends.csv'

def load_dividends_to_db():
    """배당 정보 CSV 데이터를 PostgreSQL 테이블로 적재한다."""
    if not CSV_PATH.exists():
        print(f"[ERROR] CSV 파일을 찾을 수 없습니다: {CSV_PATH}")
        return

    print(f"배당 데이터 로드 중: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH, dtype=str)
    
    # 데이터 전처리: NaN 값을 None으로 변환
    df = df.where(pd.notnull(df), None)
    
    records = df.to_dict(orient='records')

    db = SessionLocal()
    try:
        # 대량 데이터 처리를 위해 bulk_insert_mappings 대신 
        # 유연한 처리를 위해 개별 insert (tqdm 사용) 혹은 Core Insert 사용
        # 여기서는 단순 Insert (PK인 id는 자동 생성)
        
        success_count = 0
        for record in tqdm(records, desc="Dividends Upserting", unit="row"):
            # 기존 데이터 중복 방지 로직이 필요하다면 여기에 추가 (예: select 후 존재하면 skip)
            # 현재는 단순 insert (id 자동증가)
            
            # 모델 객체 생성
            dividend = DartDividend(
                rcept_no=record.get('rcept_no'),
                corp_code=record.get('corp_code'),
                corp_name=record.get('corp_name'),
                bsns_year=record.get('bsns_year'),
                reprt_code=record.get('reprt_code'),
                se=record.get('se'),
                stock_knd=record.get('stock_knd'),
                thstrm=record.get('thstrm'),
                frmtrm=record.get('frmtrm'),
                lwfr=record.get('lwfr'),
                stlm_dt=record.get('stlm_dt')
            )
            db.add(dividend)
            success_count += 1
        
        db.commit()
        print(f"성공적으로 {success_count}건의 배당 데이터를 DB에 반영했습니다.")
        
    except Exception as e:
        db.rollback()
        print(f"[ERROR] DB 반영 실패: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # 테이블 생성 (없을 경우)
    init_db()
    load_dividends_to_db()
