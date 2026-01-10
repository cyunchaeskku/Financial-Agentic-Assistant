import pandas as pd
from sqlalchemy.dialects.postgresql import insert
import sys
import os
from pathlib import Path
from tqdm import tqdm

# 프로젝트 루트를 path에 추가하여 schema 패키지를 찾을 수 있게 함
sys.path.append(str(Path(__file__).resolve().parents[3]))
from data.schema.db_models import SessionLocal, CorpCode, init_db

# CSV 파일 경로 설정
BASE_DIR = Path(__file__).resolve().parents[2] # data/ 디렉토리 기준
CSV_PATH = BASE_DIR / 'storage' / 'dart' / 'corp_code.csv'

def load_csv_to_db():
    """CSV 데이터를 PostgreSQL 테이블로 Upsert 한다."""
    if not CSV_PATH.exists():
        print(f"[ERROR] CSV 파일을 찾을 수 없습니다: {CSV_PATH}")
        return

    print(f"데이터 로드 중: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH, dtype=str)
    
    # NaN 값을 None으로 변환
    df = df.where(pd.notnull(df), None)
    
    # 딕셔너리 리스트로 변환
    records = df.to_dict(orient='records')

    db = SessionLocal()
    try:
        # Upsert 로직
        for record in tqdm(records, desc="DB Upserting", unit="record"):
            stmt = insert(CorpCode).values(**record)
            stmt = stmt.on_conflict_do_update(
                index_elements=['corp_code'],
                set_={
                    'corp_name': stmt.excluded.corp_name,
                    'stock_code': stmt.excluded.stock_code,
                    'modify_date': stmt.excluded.modify_date
                }
            )
            db.execute(stmt)
        
        db.commit()
        print(f"성공적으로 {len(records)}건의 데이터를 DB에 반영했습니다.")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] DB 반영 실패: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # 테이블 생성 및 데이터 적재
    init_db()
    load_csv_to_db()