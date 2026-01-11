# Financial Data Pipeline Architecture

본 문서는 Financial Agentic Assistant의 데이터 파이프라인 아키텍처, 설계 원칙, 그리고 상세 처리 로직을 기술합니다. 본 프로젝트는 **ELT (Extract, Load, Transform)** 패턴을 기반으로 하여 데이터의 무결성과 재사용성을 극대화하도록 설계되었습니다.

---

## 1. 아키텍처 개요 (Architecture Overview)

우리는 유연한 데이터 처리를 위해 수집(Ingestion)과 가공(Processing)을 명확히 분리하고, 원천 데이터(Raw Data)를 데이터베이스에 불변(Immutable)에 가까운 형태로 보존하는 전략을 취합니다.


### 1.1. 설계 원칙 (Design Principles)
1.  **Raw Data 보존 (Replayability):** 가공되지 않은 원천 데이터를 그대로 저장함으로써, 추후 비즈니스 로직이나 전처리 알고리즘이 변경되더라도 언제든지 원본으로부터 다시 데이터를 생성(Replay)할 수 있습니다.
2.  **ELT 패턴 (Extract-Load-Transform):** 데이터를 수집하자마자 DB에 적재(Load)하고, 이후에 DB 내부에서 혹은 애플리케이션 레벨에서 가공(Transform)하는 방식을 채택하여 파이프라인의 안정성을 높였습니다.
3. **Idempotency (멱등성):** 모든 파이프라인 스크립트는 여러 번 실행되더라도 동일한 결과(최신 상태 유지)를 보장하도록 `Upsert` 로직을 기반으로 구현되었습니다.

### 1.2. 데이터 통합 방법론 (Integration Methodology)
본 프로젝트는 이기종 시스템(DART, NAVER) 간의 유연한 연동을 위해 **RESTful API**를 핵심 통신 규약으로 채택하였으며, 데이터의 특성에 따라 최적의 수집 전략을 혼합하여 사용합니다.

*   **RESTful API 기반 통합 (Primary):**
    *   **HTTP 표준 준수:** `GET` 메서드를 사용하여 리소스를 요청하고, Stateless한 통신 구조를 유지합니다.
    *   **정형 데이터 확보:** DART 공시 정보와 뉴스 메타데이터를 JSON 포맷으로 수신하여 데이터 파싱의 신뢰성을 보장합니다.
    *   **안정성:** `requests` 라이브러리를 활용한 예외 처리(Retry, Timeout) 및 상태 코드 검증 로직을 포함합니다.
*   **Hybrid Collection Strategy:**
    *   API가 제공하지 않는 상세 정보(뉴스 본문 등)는 **Web Scraping** 기술을 제한적으로 사용하여 보완합니다.
    *   **Metadata-First:** API로 신뢰할 수 있는 메타데이터(링크, 제목)를 우선 확보한 후, 해당 링크에 대해서만 타겟팅된 스크래핑을 수행하여 효율성을 높였습니다.

---

## 2. 데이터 흐름 상세 (Data Flow Detail)

### Phase 1: Ingestion (수집) & Loading
*   **Role:** 외부 DART API로부터 데이터를 수집하여 Raw Data 저장소에 적재합니다.
*   **Method:** `data/run_pipeline.py` (Orchestrator)를 통해 실행.
*   **Orchestration Strategy (Task Registry):**
    *   **Task-based Execution:** `--task` 인자를 통해 수집 대상을 동적으로 결정합니다 (예: `dividend`).
    *   **Strategy Pattern:** 데이터 특성에 따라 수집 전략을 다르게 적용합니다.
        *   `quarterly`: 배당 데이터와 같이 분기별 조회가 필요한 경우 1Q~4Q를 자동 순회하여 수집.
        *   `single`: 단일 보고서만 수집 (예정).
*   **Storage Strategy:** `dart_dividends_raw` 테이블
    *   **Snapshot 저장:** API 응답 필드(`thstrm`, `frmtrm` 등)를 그대로 문자열(String) 형태로 저장하여 데이터 유실을 방지합니다.
    *   **중복 방지:** 기업코드, 연도, 보고서코드, 항목(se) 등을 복합키로 하여 중복 데이터 유입 시 최신 값으로 업데이트(Upsert)합니다.

### Phase 2: Processing (전처리) & Transformation
*   **Role:** Raw 데이터를 분석 가능한 형태(Cleaned Data)로 정제하고 구조를 변경합니다.
*   **Method:** `data/processors/` 내 스크립트 실행.
*   **Processing Logic (상세):**
    1.  **Type Casting (형 변환):** `1,000`과 같은 문자열 숫자에서 콤마를 제거하고, `Integer` 또는 `Float` 타입으로 변환합니다. 결측치나 `-` 표기는 `None`으로 처리합니다.
    2.  **Pivoting (구조 변경):**
        *   **Before (Long Format):** `[삼성전자, 2023, 주당배당금, 1444]`, `[삼성전자, 2023, 당기순이익, 15조]` (행 단위로 정보 분산)
        *   **After (Wide Format):** `[삼성전자, 2023, DPS:1444, NetIncome:15조]` (하나의 행에 모든 지표 통합)
        *   **이유:** LLM(RAG)이 데이터를 조회할 때 한 번의 쿼리로 모든 문맥을 파악할 수 있도록 토큰 효율성을 최적화하기 위함입니다.
    3.  **Imputation & Broadcasting (결측 보완 및 전파):**
        *   DART API 특성상 `EPS`, `당기순이익` 등 기업 전체 지표는 주식 종류(`stock_knd`) 구분 없이 별도의 행으로 제공됩니다.
        *   이를 `보통주`와 `우선주` 데이터 행에 각각 병합(Merge)하여, "우선주의 배당성향(DPS/EPS)"과 같은 파생 지표 분석이 단일 행 내에서 가능하도록 구현했습니다.
    4.  **Column Mapping:** 분석에 필요한 핵심 지표(`DPS`, `Yield`, `EPS` 등)만 선별하여 표준화된 영문 컬럼명으로 매핑합니다.

### Phase 3: Serving (활용)
*   **Storage:** `dart_dividends` 테이블 (Mart Layer)
*   **Feature:** 분석 에이전트가 SQL 쿼리 혹은 ORM을 통해 즉시 활용할 수 있는 정형 데이터 셋입니다.

---

## 3. 디렉토리 구조 (Directory Structure)

*   `collectors/`: 외부 소스로부터 데이터를 가져오는 Ingestion 스크립트 모음.
    *   `dart/`: DART API 연동 스크립트.
    *   `crawler/`: NAVER 뉴스 검색 및 본문 수집 스크립트.
*   `processors/`: Raw 데이터를 가공하여 Mart 테이블로 이관하는 전처리 스크립트 모음.
*   `schema/`: SQLAlchemy 기반의 DB 스키마(Model) 정의 파일 (`db_models.py`).
*   `storage/`: (Legacy) 파일 기반 저장소. 현재는 DB 중심 아키텍처로 전환되어 백업 용도 및 크롤링 결과 임시 저장소로 활용됩니다.

---

## 4. 비정형 데이터 수집 (Crawler)

금융 어시스턴트의 분석 범위를 넓히기 위해 정형 데이터(공시) 외에도 뉴스 기사와 같은 비정형 데이터를 수집합니다.

*   **Source:** NAVER News (via Search API)
*   **Target:** 특정 기업(키워드) 관련 최신 기사 본문
*   **Workflow:**
    1.  네이버 검색 API를 통한 뉴스 메타데이터 수집.
    2.  네이버 뉴스 호스팅 링크(`n.news.naver.com`) 대상 본문 텍스트 크롤링.
    3.  수집된 데이터를 `data/storage/raw/crawler/`에 JSON 형태로 저장.
*   **Role in Project:** 향후 RAG(Retrieval-Augmented Generation) 파이프라인의 원천 데이터로 사용되어, 기업의 정량적 지표(배당 등)와 정성적 뉴스 문맥을 결합한 분석을 가능케 합니다.
