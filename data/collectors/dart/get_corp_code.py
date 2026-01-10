"""
[DART 기업 고유번호 마스터 수집기]
DART에 등록된 모든 기업의 고유번호(corp_code), 종목코드(stock_code) 등을 수집하여 관리하는 스크립트입니다.

Roles:
1. 마스터 데이터 관리: 전체 기업 목록(약 10만 개)을 최신 상태로 유지
2. Delta Processing: 전체를 매번 새로 받되, 변경된 내역(신규/수정/삭제)을 감지하여 효율적으로 갱신

Output:
    data/storage/raw/dart/corp_code.csv (CSV 파일 저장)
    * 추후 DB 마스터 테이블로 이관 가능

Usage:
    python get_corp_code.py
"""

import requests
import pandas as pd
from zipfile import ZipFile
from bs4 import BeautifulSoup
from pathlib import Path
import io
import os
import sys
from dotenv import load_dotenv
from tqdm import tqdm

load_dotenv()

# 환경 설정
API_KEY = os.getenv('DART_API_KEY')
BASE_DIR = Path(__file__).resolve().parents[2] # data/ 디렉토리 기준
DATA_PATH = BASE_DIR / 'storage' / 'raw' / 'dart' / 'corp_code.csv'
DART_URL = 'https://opendart.fss.or.kr/api/corpCode.xml'

def fetch_dart_data(api_key: str) -> pd.DataFrame:
    """DART API로부터 기업 고유번호 데이터를 수집 및 파싱한다."""
    if not api_key:
        raise ValueError("DART_API_KEY가 설정되지 않았습니다.")

    try:
        res = requests.get(DART_URL, params={'crtfc_key': api_key})
        res.raise_for_status()

        # ZIP 압축 해제 및 XML 로드
        with ZipFile(io.BytesIO(res.content)) as zf:
            with zf.open('CORPCODE.xml') as f:
                soup = BeautifulSoup(f, 'lxml-xml')

        data = []
        tags = soup.find_all('list')
        
        # 진행률 표시 바 적용
        for tag in tqdm(tags, desc="XML Parsing", unit="corp"):
            data.append({
                'corp_code': tag.find('corp_code').text,
                'corp_name': tag.find('corp_name').text,
                'stock_code': tag.find('stock_code').text.strip(),
                'modify_date': tag.find('modify_date').text
            })
        
        return pd.DataFrame(data)

    except Exception as e:
        print(f"[ERROR] 데이터 수집 실패: {e}", file=sys.stderr)
        sys.exit(1)

def load_existing_data(path: Path) -> pd.DataFrame:
    """기존에 저장된 CSV 파일을 로드한다. 파일이 없으면 빈 데이터프레임을 반환한다."""
    if path.exists():
        # 비교를 위해 모든 필드를 문자열(str) 타입으로 읽기
        return pd.read_csv(path, dtype=str)
    return pd.DataFrame(columns=['corp_code', 'corp_name', 'stock_code', 'modify_date'])

def main():
    print("DART 기업 데이터 동기화 시작...")
    
    # 1. API로부터 현재 시점의 데이터 수집 (Current Snapshot)
    new_df = fetch_dart_data(API_KEY)
    
    # 2. 로컬에 저장된 기존 데이터 로드 (Previous Snapshot)
    old_df = load_existing_data(DATA_PATH)
    
    # 효율적인 비교를 위해 corp_code를 인덱스로 설정
    new_df.set_index('corp_code', inplace=True)
    old_df.set_index('corp_code', inplace=True)

    # 3. 변경 사항 감지 (Delta Processing)
    new_keys = set(new_df.index)
    old_keys = set(old_df.index)

    # Key 기준 신규 및 삭제 항목 탐지
    added_keys = new_keys - old_keys
    removed_keys = old_keys - new_keys
    
    # 공통 Key 중 데이터가 변경된 항목 탐지
    common_keys = new_keys & old_keys
    updated_keys = set()
    
    if common_keys:
        # 데이터프레임 정렬 및 내용 비교를 통한 수정 사항 확인
        diff_mask = (new_df.loc[list(common_keys)] != old_df.loc[list(common_keys)]).any(axis=1)
        updated_keys = set(diff_mask[diff_mask].index)

    # 변경 통계 계산
    n_added = len(added_keys)
    n_removed = len(removed_keys)
    n_updated = len(updated_keys)

    print(f"변경 통계 - 신규: {n_added}, 수정: {n_updated}, 삭제: {n_removed}")

    # 변경 사항이 없는 경우 파일 저장 생략
    if n_added == 0 and n_removed == 0 and n_updated == 0:
        print("변경 사항이 없습니다. 작업을 종료합니다.")
        return

    # 4. 데이터 저장 (변경 사항이 있는 경우에만 전체 스냅샷 갱신)
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    new_df.reset_index().to_csv(DATA_PATH, index=False, encoding='utf-8-sig')
    print(f"데이터 업데이트 완료: {DATA_PATH}")

if __name__ == "__main__":
    main()