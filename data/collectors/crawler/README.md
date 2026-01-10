# NAVER News Crawler

본 모듈은 네이버 검색 API와 웹 크롤링 기술을 결합하여 특정 기업에 대한 최신 뉴스 데이터를 수집합니다.

## 1. 주요 기능 (Features)

*   **뉴스 검색:** NAVER Search API를 사용하여 특정 키워드(기업명)와 관련된 최신 뉴스 메타데이터를 가져옵니다.
*   **본문 자동 추출:** 검색 결과 중 네이버 뉴스 호스팅 페이지(`n.news.naver.com`)에 한해 본문 전체 텍스트를 자동으로 크롤링합니다.
*   **JSON 저장:** 수집된 메타데이터와 본문을 결합하여 분석에 용이한 JSON 포맷으로 저장합니다.

## 2. 구성 파일 (Files)

*   `naver_news_crawler.py`: 검색 API 호출 및 본문 수집을 처리하는 통합 스크립트.

## 3. 사용법 (Usage)

`.env` 파일에 `NAVER_CLIENT_ID`와 `NAVER_CLIENT_SECRET`이 설정되어 있어야 합니다.

```bash
python data/collectors/crawler/naver_news_crawler.py
```

## 4. 저장 위치 (Storage)

수집된 원천 데이터는 다음 경로에 저장됩니다:
`data/storage/raw/crawler/naver_news_{keyword}.json`

---
*주의: 웹 크롤링 시 대상 사이트의 이용 약관을 준수하며, API 및 서버에 부하를 주지 않도록 요청 간 딜레이를 포함하고 있습니다.*
