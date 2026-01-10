# Project TODO List

## [2026-01-09] 배당 동향 분석 및 시각화 (Dividend Trend Analysis)

### 1. 개요 (Overview)
*   기업의 사업 연도(Year) 및 분기(Quarter)별 배당 변화 추이를 파악하고 시각화한다.
*   단발성 조회가 아닌, 시계열(Time-series) 데이터 분석을 목표로 한다.

### 2. 세부 작업 계획 (Action Items)

#### 2.1. 데이터 수집 확장 (Data Collection)
*   [ ] **전체 기업 확대**: 현재 샘플(4개 사)에서 KOSPI/KOSDAQ 주요 기업 혹은 전체로 수집 대상 확대.
*   [x] **기간 확대**: 최근 3~5년 치(2021~2025) 데이터 수집. (삼성전자 2019~2023 완료)
*   [x] **분기별 수집**: 
    *   1분기 보고서 (11013)
    *   반기 보고서 (11012)
    *   3분기 보고서 (11014)
    *   사업 보고서 (11011)
*   [x] **API 스크립트 고도화**: `get_dividends.py` 리팩토링 (Argparse 도입 및 DB 직적재).

#### 2.2. 데이터 전처리 (Preprocessing)
*   [x] `thstrm`(당기) 컬럼의 문자열(String) -> 숫자(Numeric) 변환 및 결측치 처리.
*   [x] 보고서 코드(`reprt_code`)를 사람이 읽기 쉬운 분기 명(`1Q`, `2Q`, `3Q`, `4Q`)으로 매핑.
*   [x] `se`(구분) 컬럼 표준화 (예: '현금배당수익률'만 필터링 -> Pivot & Mapping 완료).

#### 2.3. 시각화 (Visualization)
*   [ ] ~~**라이브러리**: Matplotlib, Seaborn, 혹은 Streamlit(웹 대시보드).~~
    *   [x] **plotly**
    *   [ ] **주요 차트**:
        *   특정 기업의 연도별 배당금 총액 변화 (Bar Chart).
        *   주요 기업 간 배당 수익률 비교 (Line Chart).
        *   분기 배당 실시 기업 비중 변화 (Pie/Trend Chart).
    *   [x] **버그 수정 (Bug Fix)**:
        *   **X축 정렬(Sorting)**: 백엔드 SQL 정렬(CAST 및 CASE 문)을 통해 시계열 정렬 정확도 확보 완료.
        *   **데이터 필터링**: API 쿼리 파라미터를 통한 보통주/우선주 분리 및 중복 제거 완료.

---

## [2026-01-10] 시각화 고도화 및 RAG 파이프라인 설계 (Visualization & RAG Planning)
### 1. Tableau 대시보드 레이아웃 구성
*   [ ] 분석 목적별 대시보드 영역 분할 (Summary / Trend / Deep Dive).
*   [ ] React 앱 내 임베딩 최적화 (모바일/웹 반응형 레이아웃 확인).
*   [ ] 사용자 인터랙션 요소 설계 (연도 필터, 종목 검색 등).
*   [ ] **데이터 연결 고도화**: 현재 CSV 기반 연결을 PostgreSQL 직접 연동(혹은 Tableau Bridge/Hyper API 자동화)으로 전환.

### 2. PDF 데이터 선정 및 확보
*   [ ] 분석 대상 금융상품 설명서 혹은 정책 리포트 선정.
*   [ ] DART 사업보고서 내 '사업의 내용' 섹션 PDF 추출 전략 수립.
*   [ ] 선정된 데이터의 정형/비정형 비중 분석.

### 3. RAG 파이프라인 구현 세부 목표 설정
*   [ ] **PDF 파싱 전략**: 텍스트, 표(Table), 레이아웃 보존 방식 결정.
*   [ ] **Chunking & Embedding**: 금융 도메인 특화 Chunk 크기 및 벡터 모델 선정.
*   [ ] **DB 스키마 확장**: `pgvector`를 활용한 벡터 데이터 적재 설계.
*   [ ] **API 설계**: PDF 업로드 및 자동 벡터화 트리거(Webhook/Event) 구조 설계.