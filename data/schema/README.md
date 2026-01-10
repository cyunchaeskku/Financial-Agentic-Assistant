# Financial Agentic Assistant - Database Schema

이 문서는 프로젝트에서 사용하는 PostgreSQL 데이터베이스 스키마 및 테이블 구조를 설명합니다.
SQLAlchemy ORM 모델은 `db_models.py`에 정의되어 있습니다.

## 1. CorpCode (`dart_corps`)
DART(전자공시시스템)에서 제공하는 기업 고유번호 및 기본 정보를 관리하는 마스터 테이블입니다.

| Column Name | Type | Key | Description |
| :--- | :--- | :--- | :--- |
| **corp_code** | `VARCHAR(8)` | PK | 기업 고유번호 (DART 고유 ID) |
| `corp_name` | `VARCHAR(255)` | | 기업명 (예: 삼성전자) |
| `stock_code` | `VARCHAR(6)` | | 종목코드 (상장사인 경우 존재, 예: 005930) |
| `modify_date` | `VARCHAR(8)` | | 최종 변경 일자 (YYYYMMDD) |

---

## 2. DartDividendRaw (`dart_dividends_raw`)
DART API로부터 수집된 **원본(Raw) 배당 데이터**를 저장하는 테이블입니다.
데이터 무결성 및 추적성을 위해 원본 데이터를 가공하지 않고 문자열(String) 형태 그대로 저장합니다.
ELT(Extract-Load-Transform) 아키텍처의 **Load** 단계에 해당합니다.

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER` | 자동 증가 PK |
| `rcept_no` | `VARCHAR(14)` | 접수번호 |
| `corp_code` | `VARCHAR(8)` | 기업 고유번호 |
| `bsns_year` | `VARCHAR(4)` | 사업연도 (예: 2023) |
| `reprt_code` | `VARCHAR(5)` | 보고서 코드 (11013=1Q, 11012=2Q, 11014=3Q, 11011=4Q) |
| `se` | `VARCHAR(100)` | 구분 (예: 주당 현금배당금, 현금배당수익률 등) |
| `stock_knd` | `VARCHAR(50)` | 주식 종류 (보통주, 우선주 등) |
| `thstrm` | `VARCHAR(50)` | 당기 값 (문자열, 콤마 포함 등 원본 그대로) |
| `stlm_dt` | `VARCHAR(10)` | 결산일 |

*   **Unique Constraint**: `corp_code`, `bsns_year`, `reprt_code`, `se`, `stock_knd` 조합으로 중복 적재를 방지합니다 (Upsert).

---

## 3. DartDividend (`dart_dividends`)
Raw 데이터를 분석하기 좋게 **정제(Cleaned) 및 피벗(Pivoted)**하여 저장하는 Mart 테이블입니다.
모든 수치 데이터는 숫자형(`INTEGER`, `FLOAT`, `BIGINT`)으로 변환되어 있으며, 분석 쿼리에 최적화되어 있습니다.
ELT 아키텍처의 **Transform** 단계 결과물입니다.

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER` | 자동 증가 PK |
| **corp_code** | `VARCHAR(8)` | FK (`dart_corps.corp_code`) |
| `corp_name` | `VARCHAR(255)` | 기업명 |
| `bsns_year` | `VARCHAR(4)` | 사업연도 |
| `reprt_code` | `VARCHAR(5)` | 보고서 코드 (1Q, 2Q, 3Q, 4Q 등으로 매핑됨) |
| `stock_knd` | `VARCHAR(50)` | 주식 종류 (보통주, 우선주) |
| `dps` | `INTEGER` | 주당 배당금 (Dividend Per Share) |
| `dividend_yield` | `FLOAT` | 배당 수익률 (%) |
| `total_dividend` | `BIGINT` | 현금배당금 총액 |
| `net_income` | `BIGINT` | 당기순이익 |
| `eps` | `INTEGER` | 주당순이익 (Earning Per Share) |
| `payout_ratio` | `FLOAT` | 배당성향 (Payout Ratio, %) |
| `stlm_dt` | `VARCHAR(10)` | 결산일 |

*   **Relationship**: `DartDividend` ↔ `CorpCode` (Many-to-One)
*   **Unique Constraint**: `corp_code`, `bsns_year`, `reprt_code`, `stock_knd` 조합으로 중복을 방지합니다.

---

## 4. 데이터 흐름 (Data Flow)
1.  **Extract**: DART API 호출 (`get_dividends.py`)
2.  **Load**: JSON 응답을 `dart_dividends_raw` 테이블에 적재 (Upsert)
3.  **Transform**:
    *   `clean_dividends.py`가 Raw 데이터를 조회.
    *   '주당 배당금', '배당 수익률' 등 `se` 컬럼 값을 컬럼 헤더로 피벗(Pivot).
    *   문자열 데이터를 숫자로 변환 (Cleaning).
    *   `dart_dividends` 테이블에 최종 적재.
