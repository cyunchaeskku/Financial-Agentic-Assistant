# Financial Agentic Assistant

> 금융 오픈 데이터 기반 고객 응대 및 내부 업무 효율화를 위한 AX(AI Transformation) 챗봇 및 업무 비서 프로젝트

---

![alt text](images/dividend_yield_chart.png)

## 1. 프로젝트 개요 (Overview)

본 프로젝트는 금융권에서 공개적으로 제공되는 데이터(DART 공시, 금융상품 설명서, 정책/통계 자료 등)를 활용하여 **고객 경험(CX)을 개선하고, 내부 직원의 업무 효율을 높이는 AX 챗봇**을 단계적으로 구현하는 것을 목표로 합니다.

https://opendart.fss.or.kr/guide/main.do?apiGrpCd=DS001

* **Phase 1**에서는 고객 관점의 질의응답(RAG) 챗봇을 구축하여, 금융상품 및 제도에 대한 정확하고 신뢰 가능한 응답을 제공합니다.
* **Phase 2**에서는 Agentic AI 개념을 도입하여, 고객뿐만 아니라 **기업 내부 직원(상담사·기획자·운영 담당자)**도 활용 가능한 업무 보조 에이전트로 확장합니다.

본 프로젝트는 실제 고객 데이터를 사용하지 않으며, **공식 금융 오픈 데이터와 통계 기반 Synthetic Data**만을 활용함으로써 보안·컴플라이언스 측면에서도 현실적인 AX PoC 접근 방식을 채택합니다.

---

## 2. 전체 아키텍처 개요

* **LLM 기반 자연어 인터페이스**를 중심으로
* RAG(Retrieval-Augmented Generation) → Agentic Workflow로 단계적 확장
* 고객용 / 직원용 모드를 분리하여 실제 금융사 운영 환경을 모사

---

# Phase 1. 금융 고객 응대용 RAG 챗봇

## 3. Phase 1 목표

Phase 1의 목적은 **금융 고객이 스스로 금융상품 및 제도를 이해하고, 신뢰할 수 있는 답변을 즉시 얻을 수 있도록 지원하는 CX 챗봇**을 구현하는 것입니다.

> 핵심 키워드: **정확성 · 신뢰성 · 출처 기반 응답**

---

## 4. Phase 1 유스케이스 (Customer Mode Only)

### 4.1 주요 사용자

* 은행/금융사 **고객(개인)**

### 4.2 대표 질문 예시

* “이 예금 상품은 중도해지 시 불이익이 있나요?”
* “변동금리 대출과 고정금리 대출의 차이는 무엇인가요?”
* “최근 금리 인상 기조에서 어떤 상품이 유리한가요?”

### 4.3 제공 기능

| 기능     | 설명                     |
| ------ | ---------------------- |
| 금융 Q&A | 금융상품, 제도, 정책 관련 질의응답   |
| 출처 표시  | DART/상품설명서 문단 기반 근거 제공 |
| 문서 요약  | 금융상품 설명서 핵심 요약         |
| 용어 설명  | 금융 전문 용어 자연어 해설        |

---

## 5. Phase 1 데이터 구성

### 5.1 데이터 소스

*   **DART 전자공시**
    *   사업보고서 내 금융상품·리스크·고객 정책 관련 서술
*   **NAVER 뉴스 (Search API & Crawler)**
    *   기업 관련 최신 뉴스 본문 수집 (정성적 문맥 분석용)
*   **금융상품 설명서 (PDF)**
    *   예·적금, 대출, 펀드, 카드 상품
*   **한국은행·금융위원회 공개 자료**
    *   금리 정책, 제도 안내 문서


### 5.2 데이터 원칙

* 실제 고객 정보 **미사용**
* 공식 오픈 데이터만 활용
* 모든 응답은 **문서 기반(RAG)**으로 생성

---

## 6. Phase 1 기술 스택

* **LLM**: GPT-4o / Claude 3.5 Sonnet
* **Framework**: LangChain
* **Vector DB**: PostgreSQL + pgvector
* **Backend**: FastAPI
* **Frontend**: React + Plotly.js
* **Data Integration**: RESTful API (DART, Naver), Web Scraping (News Content)
* **Parsing**: PyMuPDF, pdfminer
* **Storage**: PostgreSQL (메타데이터)
* **Docker**: FastAPI 백엔드, PostgreSQL/pgvector DB를 컨테이너화하여 개발-배포 환경 일관성을 유지하고 의존성을 관리합니다.

---

## 7. Phase 1 산출물 (Deliverables)

* 금융 Q&A 웹 챗봇
* 출처가 명시된 응답 결과
* RAG 파이프라인 문서화
* 데이터 시각화
* 데이터 출처 및 컴플라이언스 설명 섹션

---

# Phase 2. 고객·직원 겸용 Agentic AX Assistant

## 8. Phase 2 목표

Phase 2에서는 단순 질의응답을 넘어, **행동(Action)을 수행하는 Agentic AI**로 확장합니다.

* 고객 경험 고도화
* 내부 직원의 고객 데이터 관리·업무 효율 향상

> 핵심 키워드: **Agent · Action · 업무 자동화**

---

## 9. Phase 2 운영 모드

### 9.1 Customer Mode (고객용)

* Phase 1 기능 포함
* 개인 상황 기반 안내(비식별 Synthetic Profile)
* 상품 비교 및 선택 가이드

### 9.2 Employee Mode (직원용)

* 상담사·기획자·운영 담당자 사용
* 고객군 분석 및 요약
* 정책/상품 변경 시 영향 분석

---

## 10. Phase 2 Agentic Use Cases

| 구분 | 유스케이스                 |
| -- | --------------------- |
| 고객 | 상품 비교 요청 → 조건 정리 → 추천 |
| 고객 | 문의 이력 요약 및 다음 액션 안내   |
| 직원 | 고객 유형별 문의 패턴 요약       |
| 직원 | 특정 상품 관련 고객 불만 이슈 정리  |
| 직원 | 신규 상품 출시 시 FAQ 자동 생성  |

---

## 11. Phase 2 Action 예시

* 문서 검색 Action
* 고객 유형 분류 Action
* 요약/리포트 생성 Action
* 내부 정책 체크리스트 생성 Action

---

## 12. Phase 2 기술 스택 확장

* **Agent Framework**: LangGraph
* **State Management**: Redis
* **Evaluation**: RAGAS, Promptfoo
* **Analytics**: Metabase / Superset
* **Synthetic Data Generator**: Python 기반 통계 샘플링

---

## 13. AX 컨설팅 관점에서의 가치

* **고객 응대 품질의 표준화:** AI 기반의 일관된 응답 제공을 통한 서비스 상향 평준화.
* **상담 인력 숙련도 편차 완화:** 복잡한 금융 데이터와 정책을 즉시 요약/시각화하여 저숙련자의 상담 업무 지원.
* **데이터 기반 의사결정 지원:** 단순 텍스트 응답을 넘어 인터랙티브 시각화 대시보드를 제공하여, 고객과 직원의 직관적인 인사이트 도출 및 의사결정을 가속화합니다.
* **고객 데이터 활용 효율 증대:** 흩어진 공시 및 재무 데이터를 통합하여 비즈니스 가치 창출.
* **보안·컴플라이언스 친화적 AI 도입 모델 제시:** 오픈 데이터 기반의 PoC로 실질적인 기술 검증 수행.

---

## 14. 향후 확장 방향

* 타 산업(보험·통신·유통)으로 도메인 확장
* 멀티 채널 연계(콜센터, 앱, 내부 포털)
* KPI 기반 Agent 성능 튜닝

---

## 15. 프로젝트 특장점 및 엔지니어링 철학 (Key Engineering Features)

본 프로젝트는 단순한 기능 구현을 넘어, **실무 수준의 데이터 파이프라인 아키텍처와 운영 안정성**을 목표로 설계되었습니다.

### 1) 시각화 기반의 Insight Delivery
*   **Actionable Insights:** 복잡한 수치 데이터를 인터랙티브 차트(`Plotly`)로 시각화하여, 사용자가 데이터 사이의 관계와 추세를 즉각적으로 파악하고 실제 행동(투자 결정, 정책 변경 등)으로 연결할 수 있는 의사결정 지원 도구를 제공합니다.
*   **Direct Pipeline Visualization:** 백엔드 API와 프론트엔드 시각화 라이브러리를 직결하여, 가공된 DB 데이터가 별도의 수동 작업 없이 즉시 리포트로 전환되는 실무 지향적 구조를 갖췄습니다.

### 2) ELT 아키텍처 기반의 데이터 보존성 (Data Integrity)
*   **Raw Data Immutability:** API로부터 수집된 원천 데이터를 가공 없이 `Snapshot` 형태로 우선 적재(Load)한 후, 별도의 단계에서 가공(Transform)하는 ELT 패턴을 채택했습니다.
*   **Replayability:** 비즈니스 로직이나 전처리 알고리즘이 변경되더라도, 보존된 Raw Data로부터 언제든지 깨끗한 데이터셋을 재생성(Replay)할 수 있는 유연성을 확보했습니다.

### 2) 운영 안정성을 위한 멱등성 보장 (Idempotency)
*   **Robust Pipeline:** 모든 데이터 적재 프로세스는 `Upsert` 메커니즘과 정교한 `Unique Constraint` 설계를 기반으로 구현되었습니다.
*   **Safety:** 네트워크 오류나 시스템 중단으로 파이프라인을 재실행하더라도 데이터 중복이나 정합성 훼손이 발생하지 않도록 설계하여 운영 복원력을 극대화했습니다.

### 3) LLM/RAG 최적화 데이터 스키마 (AI-Ready Schema)
*   **Token Efficiency:** 세로형(Long Format)으로 분산된 금융 공시 데이터를 분석에 용이한 가로형(Wide Format)으로 피벗팅(Pivoting)하여 LLM의 Context Window 효율을 높였습니다.
*   **Contextual Broadcasting:** 기업 전체 지표(EPS, 순이익)를 개별 주식 종류(보통주/우선주) 행에 병합하여, 에이전트가 단일 레코드 조회만으로도 복합적인 재무 비율 분석을 수행할 수 있도록 최적화했습니다.

### 4) Task Registry & Strategy 패턴 기반 오케스트레이션 (Advanced Orchestration)
*   **Decoupled Architecture:** 수집(Collector)과 가공(Processor)의 로직을 완전히 분리하고, 중앙 오케스트레이터(`run_pipeline.py`)가 이를 제어하는 구조를 갖췄습니다.
*   **Task Registry:** 새로운 데이터 타입 추가 시 핵심 엔진의 수정 없이 설정(Registry) 등록만으로 파이프라인 확장이 가능하도록 설계되었습니다.
*   **Dynamic Strategy:** 데이터의 성격(분기별 순회, 단일 수집 등)에 따라 최적의 수집 전략(Strategy)을 동적으로 선택하여 실행하는 전문성을 갖추고 있습니다.

---

> “실제 고객 데이터 없이도, 현실적인 AX 시나리오는 충분히 구현 가능하다”는 점을 증명하는 것을 핵심 가치로 삼습니다.
