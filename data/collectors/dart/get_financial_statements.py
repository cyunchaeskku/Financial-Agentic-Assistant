"""
[DART 재무제표 수집기]
DART Open API를 호출하여 특정 기업의 재무제표(단일회사 주요계정) 정보를 수집하고 JSON 파일로 저장하는 스크립트입니다.

Roles:
1. API 호출: DART '단일회사 주요계정' (fnlttSinglAcnt) API 호출
2. 파일 저장: 수집된 JSON 응답을 data/storage/raw/dart/ 디렉토리에 저장

Usage:
    python get_financial_statements.py --corp_code 00126380 --year 2023 --reprt_code 11011

Arguments:
    --corp_code (str): DART 고유번호 (8자리)
    --year (str): 사업연도 (YYYY)
    --reprt_code (str): 보고서 코드 (11011:사업, 11012:반기, 11013:1분기, 11014:3분기)
"""

import requests
import json
import os
import argparse
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# 환경 설정
API_KEY = os.getenv('DART_API_KEY')
FS_API_URL = 'https://opendart.fss.or.kr/api/fnlttSinglAcnt.json'
STORAGE_DIR = Path(__file__).resolve().parents[3] / 'data/storage/raw/dart'

def fetch_financial_statements(corp_code: str, bsns_year: str, reprt_code: str) -> dict:
    """특정 기업의 재무제표 정보를 API로부터 수집한다."""
    params = {
        'crtfc_key': API_KEY,
        'corp_code': corp_code,
        'bsns_year': bsns_year,
        'reprt_code': reprt_code
    }
    
    try:
        res = requests.get(FS_API_URL, params=params)
        data = res.json()
        
        if data['status'] == '000':
            return data
        elif data['status'] == '013':
            print(f"[{corp_code}] {bsns_year}년 {reprt_code} 보고서 데이터 없음")
            return data # 데이터가 없어도 응답 구조 확인을 위해 반환
        else:
            print(f"[ERROR] API 호출 오류 ({corp_code}): {data['message']}")
            return data
            
    except Exception as e:
        print(f"[ERROR] 요청 실패: {e}")
        return {}

def save_to_json(data: dict, corp_code: str, year: str, reprt_code: str):
    """수집된 데이터를 JSON 파일로 저장한다."""
    if not data:
        return

    # 디렉토리 생성
    os.makedirs(STORAGE_DIR, exist_ok=True)
    
    filename = f"fs_{corp_code}_{year}_{reprt_code}.json"
    filepath = STORAGE_DIR / filename
    
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"파일 저장 완료: {filepath}")
        
    except Exception as e:
        print(f"[ERROR] 파일 저장 실패: {e}")

def main():
    parser = argparse.ArgumentParser(description='DART 재무제표 정보 수집 스크립트')
    parser.add_argument('--corp_code', type=str, required=True, help='DART 기업 고유번호 (8자리)')
    parser.add_argument('--year', type=str, required=True, help='사업 연도 (YYYY)')
    parser.add_argument('--reprt_code', type=str, default='11011', 
                        help='보고서 코드 (11011: 사업, 11012: 반기, 11013: 1분기, 11014: 3분기)')
    
    args = parser.parse_args()
    
    print(f"재무제표 수집 시작: {args.corp_code} ({args.year}, {args.reprt_code})")
    
    data = fetch_financial_statements(args.corp_code, args.year, args.reprt_code)
    
    if data:
        save_to_json(data, args.corp_code, args.year, args.reprt_code)

if __name__ == "__main__":
    main()
