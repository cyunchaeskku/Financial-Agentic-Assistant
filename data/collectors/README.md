# Data Collectors

이 디렉토리는 외부 소스(API, 웹사이트 등)로부터 **Raw Data를 수집(Ingestion)**하여 데이터베이스의 Raw Layer에 적재하는 스크립트들을 포함합니다.

## 역할 및 프로세스
1.  **Extract:** 외부 API(예: DART)를 호출하여 JSON/XML 응답을 받습니다.
2.  **Load:** 데이터 가공을 최소화하고 원본 형태(String) 그대로 DB의 Raw 테이블(`dart_dividends_raw`)에 **Upsert(Insert or Update)** 합니다.

## 주요 스크립트

### `dart/get_dividends.py`
*   **기능:** 특정 기업 및 연도의 배당 정보를 DART API에서 수집합니다.
*   **Destination:** PostgreSQL `dart_dividends_raw` 테이블.
*   **사용법:**
    ```bash
    python data/collectors/dart/get_dividends.py --corp_code 00126380 --year 2023
    ```
*   **특징:** 동일 데이터 수집 시 중복 생성되지 않고 최신 데이터로 갱신됩니다.

### `dart/get_corp_code.py`
*   **기능:** DART에 등록된 전 기업의 고유번호 리스트를 수집합니다.
*   **Destination:** `data/storage/raw/dart/corp_code.csv` (대용량 마스터 데이터라 현재는 파일로 관리 중이나 추후 DB 이관 고려).