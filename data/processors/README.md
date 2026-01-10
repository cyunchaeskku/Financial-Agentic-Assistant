# Data Processors

이 디렉토리는 DB의 Raw Layer에 저장된 데이터를 조회하여, 정제(Cleaning) 및 구조화(Transformation) 과정을 거쳐 분석용 Mart Layer로 이관하는 스크립트들을 포함합니다.

## 역할 및 프로세스
1.  **Read:** `dart_dividends_raw` 테이블에서 Raw Data를 로드합니다.
2.  **Transform:**
    *   **Cleaning:** 문자열(`"1,000"`) -> 수치형(`1000`) 변환, 결측치 처리.
    *   **Pivoting:** 세로로 긴(Long) 데이터를 가로로 넓은(Wide) 형태로 변환하여 분석 효율성을 높입니다.
    *   **Broadcasting:** 기업 전체 지표(EPS, 순이익)를 각 주식 종류(보통주/우선주) 행에 병합합니다.
    *   **Normalization:** DART 보고서 코드(`11011`, `11012` 등)를 사람이 이해하기 쉬운 분기명(`4Q`, `2Q` 등)으로 변환합니다.
3.  **Write:** 최종 가공된 데이터를 `dart_dividends` 테이블에 Upsert 합니다.

## 주요 스크립트

### `dart/clean_dividends.py`
*   **기능:** 배당 Raw 데이터를 분석용 스키마로 변환합니다.
*   **Source:** DB `dart_dividends_raw`
*   **Target:** DB `dart_dividends`
*   **사용법:**
    ```bash
    python data/processors/dart/clean_dividends.py
    ```
*   **결과물 예시 (Wide Format):**
    | corp_name | year | stock_knd | dps | yield | eps |
    |---|---|---|---|---|---|
    | 삼성전자 | 2023 | 보통주 | 1444 | 1.9 | 2131 |
    | 삼성전자 | 2023 | 우선주 | 1445 | 2.4 | 2131 |