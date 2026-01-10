# 개발 일지 (Development Log)

## [2026-01-08] - DART 데이터 자동화 및 DB 환경 구축

### 1. 데이터 파이프라인 자동화 (GitHub Actions)
*   **작업 내용**: DART 기업 고유번호 수집 스크립트(`get_corp_code.py`)를 매일 자동으로 실행하기 위한 워크플로우 구축.
*   **상세 설정**:
    *   `.github/workflows/update_dart_data.yml` 생성.
    *   매일 한국 시간 오전 9시(UTC 00:00) 스케줄링 및 수동 실행(`workflow_dispatch`) 기능 추가.
    *   GitHub Secrets(`DART_API_KEY`)를 통한 보안 관리 및 데이터 변경 시에만 자동 커밋/푸시 로직 구현.

### 2. DART 데이터 동기화 로직 고도화 (Delta Processing)
*   **작업 내용**: 단순 덮어쓰기 방식에서 변경분만 감지하는 방식으로 스크립트 개선.
*   **상세 로직**:
    *   로컬 CSV(과거 스냅샷)와 API 응답(현재 스냅샷) 비교 연산 도입.
    *   신규(New), 수정(Updated), 삭제(Removed) 항목을 `corp_code` 기반으로 탐지.
    *   변경 통계 로그 출력 및 실질적 변경이 있을 때만 파일 I/O 발생하도록 최적화.

### 3. PostgreSQL 데이터베이스 환경 구축 (Docker)
*   **작업 내용**: 로컬 개발 환경의 일관성을 위해 Docker 컨테이너 기반 DB 서버 가동.
*   **상세 설정**:
    *   `docker-compose.yml` 작성: `ankane/pgvector` 이미지를 활용하여 향후 벡터 검색 확장성 확보.
    *   `.env` 파일을 통한 환경 변수 관리 및 `pgdata/` 볼륨 마운트로 데이터 영속성 보장.
    *   `.gitignore` 설정을 통해 DB 내부 데이터 파일이 형상 관리에 포함되지 않도록 조치.

### 4. DB 스키마 설계 및 데이터 적재 (ETL)
*   **작업 내용**: 수집된 CSV 데이터를 관계형 데이터베이스로 이관.
*   **상세 구현**:
    *   `data/db_models.py`: SQLAlchemy ORM을 사용하여 `dart_corps` 테이블 정의.
    *   `data/load_to_db.py`: `ON CONFLICT DO UPDATE`(Upsert) 구문을 사용하여 데이터 정합성 유지 및 중복 방지.
    *   최종 약 114,982건의 기업 고유번호 데이터를 `financial_agent` DB에 적재 완료.

## [2026-01-08] - 데이터 디렉토리 구조 재편 (Refactoring)
*   **작업 내용**: 확장성과 관리 편의성을 위해 'data/' 폴더 구조 리팩토링.
*   **상세 구조**:
    *   `data/schema/`: DB 모델 및 데이터 스키마 정의 (`db_models.py`)
    *   `data/collectors/dart/`: DART 전용 데이터 수집 및 적재 스크립트 (`get_corp_code.py`, `load_to_db.py`)
    *   `data/storage/dart/`: 수집된 원본 파일 저장소 (`corp_code.csv`)
*   **로직 수정**:
    *   스크립트 내 파일 참조 경로를 절대 경로(resolve) 기반으로 수정하여 실행 위치에 상관없이 동작하도록 개선.
    *   GitHub Actions 워크플로우(`update_dart_data.yml`) 내 실행 및 Git 추적 경로 업데이트 완료.
    
## [2026-01-08 23:03:39] - 배당 데이터 수집 및 DB 파이프라인 구축
*   **작업 내용**: 특정 기업의 배당 정보를 수집하고 관계형 DB로 이관하는 프로세스 구축.
*   **상세 구현**:
    *   `data/collectors/dart/get_dividends_sample.py`: 대표 상장사 4곳(삼성전자, SK하이닉스, NAVER, 현대차)의 2023년 사업보고서 기반 배당 데이터 수집 스크립트 작성.
    *   `data/schema/db_models.py`: `dart_dividends` 테이블 모델 정의 및 `dart_corps`와의 외래키(FK) 관계 설정.
    *   `data/collectors/dart/load_dividends_to_db.py`: 수집된 CSV 데이터를 DB에 적재하는 ETL 스크립트 작성 (tqdm 적용).
*   **특이사항**:
    *   대용량 데이터 처리를 고려하여 `tqdm` 라이브러리를 전역적으로 도입하여 진행률 시각화.
    *   배당 데이터의 특성(보고서 내 다중 항목 존재)에 맞춰 유연한 스키마 구조 채택.

## [2026-01-09 23:50] - API 서버 구축 및 데이터 시각화 고도화

### 1. Backend API 서버 구축 (FastAPI)
*   **작업 내용**: PostgreSQL DB와 통신하여 배당 데이터를 제공하는 REST API 구축.
*   **구현 내용**:
    *   `GET /api/dividends`: `dart_dividends`(Mart)와 `dart_corps`(Meta) 테이블을 Join하여 분석용 데이터 제공.
    *   SQL Alias (`AS year`, `AS yield`) 적용으로 하위 호환성 유지 및 DB 스키마 은닉.
    *   CORS(Cross-Origin Resource Sharing) 설정으로 로컬 개발 환경(Port 3000) 연동 허용.

### 2. Frontend 시각화 및 데이터 연동 (Tableau → Plotly 전환)
*   **의사결정 배경 (Pivot)**: 
    *   **데이터 실시간성 한계**: Tableau Public은 정적 CSV 업로드 방식에 의존하여 DB 데이터의 실시간 반영(Real-time updates)이 어려움.
    *   **기술적 부채**: `@tableau/embedding-api` 패키지의 버전 호환성 문제 및 외부 CDN 스크립트 의존성 발생.
    *   **유연성 부족**: DB에서 계산된 복합 지표(NaN 처리, 동적 필터링 등)를 UI에 즉시 반영하기 위해 직접 시각화 라이브러리 도입 결정.
*   **구현 내용**:
    *   **Plotly 도입**: `react-plotly.js`를 사용하여 인터랙티브 시계열 선 그래프 구현.
    *   **데이터 파이프라인 직결**: `FastAPI` ↔ `React` ↔ `Plotly` 구조로 재편하여 DB 데이터가 화면에 즉시 투영되는 구조 확보.
    *   **분석 관점 변경**: 단순 DPS(주당 배당금)에서 투자 수익률 관점의 **Yield(배당 수익률)** 중심으로 시각화 로직 고도화.
    *   `axios` 비동기 통신 및 React Hook(`useEffect`, `useState`) 기반 데이터 상태 관리.

## [2026-01-10] - 배당 차트 데이터 정합성 문제 해결 (분석 및 해결)

### 1. 차트 X축 정렬 오류 및 데이터 중복 이슈 (시행착오)
*   **증상**: Frontend 차트에서 X축(기간) 순서가 뒤섞이고, 동일 시점에 점이 2개씩 찍히며 그래프가 지그재그로 그려지는 현상 발생.
*   **원인 분석**:
    *   **데이터 중복**: DART API 응답 내에 `보통주`와 `우선주` 데이터가 혼재되어 있으나, Backend API가 이를 구분(`stock_knd`)하지 않고 모두 반환함.
    *   **정렬 로직 취약**: Frontend에서 문자열 기반(`localeCompare`)으로 정렬 시, 보고서 코드(`1Q`, `4Q` 등)의 의미적 순서와 텍스트 순서가 우연히 일치할 뿐, 근본적인 시계열 정렬 로직이 부재함.
*   **1차 조치 (Hotfix Attempt)**:
    *   **Backend**: `get_dividends` 쿼리에 `stock_knd` 컬럼 추가.
    *   **Frontend**: `DividendChart.jsx`에서 `stock_knd === '보통주'`인 데이터만 필터링하여 시각화.
*   **잔존 이슈**: 여전히 X축 정렬이 올바르지 않은 문제(뒤죽박죽)가 해결되지 않음.

### 2. 최종 해결 방안 (Backend-Driven Sorting & Filtering)
*   **의사결정**: 데이터의 '단일 진실 공급원(SSOT)' 원칙에 따라, 정렬과 필터링 로직을 백엔드(SQL)로 이관.
*   **구현 상세**:
    *   **SQL 정렬 고도화**: `ORDER BY CAST(bsns_year AS INTEGER) ASC, CASE...` 구문을 사용하여 연도와 분기의 논리적 시계열 순서를 완벽히 보장.
    *   **파라미터 기반 필터링**: `stock_knd` 쿼리 파라미터를 추가하고 기본값을 `'보통주'`로 설정하여 중복 데이터를 원천 차단.
    *   **프론트엔드 단순화**: API가 정렬된 데이터를 보장하므로 프론트엔드의 복잡한 정렬 코드를 제거하고 시각화에만 집중하도록 리팩토링.
### 3. 심화 이슈 해결 (X축 정렬 완전 해결)
*   **증상**: 특정 기업(예: LG)은 4분기 데이터만 존재하고, 삼성전자는 매 분기 데이터가 존재함. 이를 하나의 차트에 그릴 때 Plotly가 X축(Category) 순서를 데이터 입력 순서에 의존하여 처리하면서, 기업 간 데이터가 섞일 때 연도가 뒤로 갔다가 앞으로 오는 현상 재발.
*   **해결**: 프론트엔드(`DividendChart.jsx`)에서 **전체 데이터의 고유한 기간(Year-Quarter)을 추출하여 별도로 정렬(Sort)**한 뒤, Plotly Layout의 `xaxis.categoryarray` 속성에 주입하여 X축 순서를 강제로 고정(Hard-coding)함.
### 4. 사용자 인터랙션 개선 (Multi-select Filter 도입)
*   **작업 내용**: 사용자가 원하는 기업만 골라 비교할 수 있도록 `react-select` 라이브러리를 사용한 검색 가능 드롭다운 메뉴 추가.
*   **구현 상세**:
    *   `frontend/src/components/DividendChart.jsx`: 전체 데이터를 한 번에 로드한 후, 프론트엔드 상태(`selectedOptions`)에 따라 실시간으로 차트 트레이스(Traces)를 필터링하여 렌더링하도록 구현.
    *   **초기 로딩 경험**: 데이터가 있는 경우 '삼성전자'를 기본 선택값으로 제공하여 빈 차트 대신 즉시 시각화 결과를 볼 수 있도록 개선.
*   **장점**: 백엔드 추가 요청 없이 프론트엔드에서 즉각적인 필터링 반응 속도(Zero-latency)를 제공함.

## [2026-01-09] - ELT 아키텍처 전환 및 데이터 파이프라인 고도화

### 1. ELT(Extract-Load-Transform) 아키텍처 도입
*   **목표**: 데이터 처리 로직 변경 시 유연한 대응을 위해 Raw Data 보존 및 가공 단계를 분리.
*   **구현 내용**:
    *   **Collect (Extract & Load)**: `get_dividends.py`가 CSV를 거치지 않고 Raw Data 테이블(`dart_dividends_raw`)에 직접 Upsert.
    *   **Process (Transform)**: `clean_dividends.py`가 Raw DB에서 데이터를 읽어 정제 후 Mart 테이블(`dart_dividends`)에 적재.
    *   **DB 모델 분리**: `DartDividendRaw`(String 중심 Snapshot) vs `DartDividend`(Numeric 중심 Analyzable) 분리.

### 2. 데이터 전처리 로직 고도화 (LLM-Friendly)
*   **Pivoting (피벗)**: 세로형(Long Format)으로 분산된 API 응답을 분석하기 쉬운 가로형(Wide Format)으로 변환.
    *   Before: `[삼성전자, 배당금, 1444]`, `[삼성전자, EPS, 2131]` (2 Rows)
    *   After: `[삼성전자, DPS:1444, EPS:2131]` (1 Row)
*   **Broadcasting (전파)**: 기업 공통 지표(EPS, 순이익)가 주식 종류(보통주/우선주)별 행에 병합되도록 구현하여 단일 행 분석 가능성 확보.
*   **Normalization (정규화)**: 가독성을 위해 DART 보고서 코드(`11011`, `11013` 등)를 분기명(`4Q`, `1Q` 등)으로 변환하는 매핑 로직 적용.

### 3. 디렉토리 구조 및 문서화 (Professionalism)
*   **구조 재편**: `data/processors/` 신설 및 `data/storage/`를 `raw/`와 `processed/`로 구분.
*   **문서화**: `data/README.md` 및 하위 폴더별 README를 통해 ELT 철학, Raw Data 불변성 원칙 등을 면접관 관점에서 전문적으로 기술.

## [2026-01-09 23:30] - Frontend 아키텍처 재구축 (Migration to React)

### 1. Frontend 아키텍처 전환 배경
*   **전환 배경**: 기존 Python/Flask 템플릿 방식의 한계를 극복하고, SPA(Single Page Application) 구조의 유연한 대시보드 확장을 위함.
*   **작업 내용**:
    *   기존 `frontend/` 디렉토리 삭제 및 `create-react-app` 기반 프로젝트 초기화.
    *   `react-plotly.js` 등 현대적인 라이브러리와의 통합을 위해 React 기반 환경 구축 완료.
