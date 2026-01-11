"""
[Data Pipeline Orchestrator]
다양한 금융 데이터(배당, 재무제표 등)의 수집(Extract & Load)부터 전처리(Transform)까지의 전체 과정을 제어하는 범용 실행 스크립트입니다.

Process:
1. Input: Task 이름, 대상 기업 코드(corp_code), 연도(year) 입력
2. Configuration: Task Registry에서 해당 데이터 타입에 맞는 수집기(Collector)와 전처리기(Processor) 경로 조회
3. Execution: 정의된 절차에 따라 수집 및 전처리 스크립트 실행

Usage:
    python run_pipeline.py --task dividend --corp_code 00126380 --year 2023
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path

# 스크립트 경로 정의 (Base)
BASE_DIR = Path(__file__).resolve().parent

# --- Pipeline Registry (확장 포인트) ---
PIPELINE_REGISTRY = {
    'dividend': {
        'collector': BASE_DIR / 'collectors' / 'dart' / 'get_dividends.py',
        'processor': BASE_DIR / 'processors' / 'dart' / 'clean_dividends.py',
        'description': 'DART 배당 정보(분기별 포함) 수집 및 전처리',
        'strategy': 'quarterly' # 분기별 순회 전략 사용
    },
    # 추후 추가 예시:
    # 'financial_stat': {
    #     'collector': BASE_DIR / 'collectors' / 'dart' / 'get_financials.py',
    #     'processor': BASE_DIR / 'processors' / 'dart' / 'clean_financials.py',
    #     'strategy': 'single' # 단일 실행
    # }
}

# 보고서 코드 매핑 (1Q, 2Q, 3Q, 4Q)
REPORT_CODES = {
    '1Q': '11013',
    '2Q': '11012',
    '3Q': '11014',
    '4Q': '11011' # 사업보고서
}

def run_command(cmd_list, description):
    """서브프로세스로 명령어 실행 및 로깅"""
    print(f"\n[Pipeline] {description}...")
    try:
        # subprocess.run을 사용하여 스크립트 실행
        result = subprocess.run(cmd_list, check=True, text=True, capture_output=True)
        print(f"Success: {result.stdout.strip().splitlines()[-1] if result.stdout else 'Completed'}") # 마지막 줄만 출력해서 깔끔하게
    except subprocess.CalledProcessError as e:
        print(f"Failed: {e.stderr.strip()}")

def execute_quarterly_strategy(config, args):
    """분기별 보고서(1Q~4Q)를 모두 순회하며 수집하는 전략"""
    collector_script = config['collector']
    
    # 1. Extraction (Quarterly Loop)
    for q_name, reprt_code in REPORT_CODES.items():
        cmd = [
            sys.executable, str(collector_script),
            '--corp_code', args.corp_code,
            '--year', args.year,
            '--reprt_code', reprt_code
        ]
        run_command(cmd, f"Collecting {q_name} ({reprt_code})")
        time.sleep(0.5) # Rate Limit

def execute_single_strategy(config, args):
    """단일 실행 전략 (예: 연간 보고서만 필요한 경우)"""
    # 구현 예정 (현재는 dividend만 있으므로 패스)
    pass

def main():
    parser = argparse.ArgumentParser(description='Financial Data Pipeline Orchestrator')
    parser.add_argument('--task', type=str, required=True, choices=PIPELINE_REGISTRY.keys(), help='Task Name (e.g., dividend)')
    parser.add_argument('--corp_code', type=str, required=True, help='Target Corporation Code')
    parser.add_argument('--year', type=str, required=True, help='Target Business Year')
    
    args = parser.parse_args()
    
    # Task 설정 로드
    config = PIPELINE_REGISTRY.get(args.task)
    if not config:
        print(f"Error: Unknown task '{args.task}'")
        sys.exit(1)

    print(f"Starting Pipeline: [{args.task.upper()}] for {args.corp_code} ({args.year})")
    print(f"Description: {config['description']}")
    print("=" * 60)

    # 1. Extraction & Loading (Collect)
    # 전략 패턴: 데이터 타입에 따라 수집 방식 분기
    if config.get('strategy') == 'quarterly':
        execute_quarterly_strategy(config, args)
    else:
        # 기본 단일 실행 (예시)
        # cmd = [sys.executable, str(config['collector']), '--corp_code', args.corp_code, '--year', args.year]
        # run_command(cmd, "Collecting Data")
        pass

    print("-" * 60)

    # 2. Transformation (Process)
    # 전처리는 보통 한 번에 수행 (Incremental Filtering 적용됨)
    processor_script = config['processor']
    cmd = [
        sys.executable, str(processor_script),
        '--corp_code', args.corp_code,
        '--year', args.year
    ]
    run_command(cmd, "Transforming & Loading to Mart")

    print("=" * 60)
    print("Pipeline Completed Successfully.")

if __name__ == "__main__":
    main()
