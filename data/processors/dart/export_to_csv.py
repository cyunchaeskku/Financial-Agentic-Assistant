"""
[Data Exporter (DB to CSV)]
분석용 Mart DB(dart_dividends)에 적재된 데이터를 Tableau 등 BI 도구 활용을 위해 CSV 파일로 추출하는 스크립트입니다.

Roles:
1. Data Serving: DB 데이터를 파일 형태로 제공
2. BI Integration: Tableau Public 등 DB 연결이 제한된 도구와의 연동 지원

Output:
    data/storage/processed/dart/dividends_mart.csv

Usage:
    python export_to_csv.py
"""

import pandas as pd
import sys
from pathlib import Path
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine

# 프로젝트 루트 경로 추가
BASE_DIR = Path(__file__).resolve().parents[3]
sys.path.append(str(BASE_DIR))

load_dotenv()

def export_dividends():
    """Mart DB 데이터를 CSV로 추출"""
    # 1. DB 연결 설정
    DB_URL = f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@localhost:5432/{os.getenv('POSTGRES_DB')}"
    engine = create_engine(DB_URL)

    print("DB 데이터 추출 시작...")

    # 2. 데이터 조회
    try:
        query = "SELECT * FROM dart_dividends ORDER BY bsns_year DESC, corp_name ASC"
        df = pd.read_sql(query, engine)
        
        if df.empty:
            print("추출할 데이터가 DB에 없습니다.")
            return

        # 3. 저장 경로 설정
        output_dir = BASE_DIR / 'data' / 'storage' / 'processed' / 'dart'
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / 'dividends_mart.csv'

        # 4. CSV 저장 (UTF-8 with BOM for Excel/Tableau compatibility)
        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        
        print(f"✅ 추출 완료: {len(df)}건의 데이터가 저장되었습니다.")
        print(f"📍 경로: {output_file}")

    except Exception as e:
        print(f"❌ 추출 실패: {e}")

if __name__ == "__main__":
    export_dividends()
