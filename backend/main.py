from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
import pandas as pd
import numpy as np
import os
import sys
from typing import List, Optional
from dotenv import load_dotenv
from pydantic import BaseModel

# LangChain Imports
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

# Add project root to sys.path to import modules from 'data'
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from data.collectors.crawler.naver_news_crawler import crawl_naver_news

import json
from pathlib import Path

# ... (Previous imports)

# Load environment variables from parent directory
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=env_path)

app = FastAPI(title="Financial Agent API")

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import engine from shared module
from data.schema.db_models import engine

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Financial Agent API is running"}

import requests

# ... (기존 코드 유지)

@app.get("/api/search/corps")
def search_corps(query: str):
    """
    입력된 쿼리에 맞는 기업명 목록을 추천합니다.
    PostgreSQL DB에서 stock_code가 있는 상장사만 검색합니다.
    """
    if not query or len(query) < 1:
        return []
    
    try:
        # 1. SQL: 조건에 맞는 데이터를 모두 가져옵니다 (정렬은 Python에서 처리)
        sql = text("""
            SELECT corp_code, corp_name, stock_code 
            FROM dart_corps 
            WHERE stock_code IS NOT NULL 
              AND stock_code != '' 
              AND corp_name ILIKE :query
        """)
        
        df_matches = pd.read_sql(sql, engine, params={"query": f"%{query}%"})
        
        if df_matches.empty:
            return []

        # 2. Python Sort: 우선순위 점수 계산 (낮을수록 상위)
        # Priority 1: Exact Match (0)
        # Priority 2: Starts With (1)
        # Priority 3: Contains (2)
        query_lower = query.lower()
        
        def calculate_priority(name):
            name_lower = name.lower()
            if name_lower == query_lower:
                return 0
            elif name_lower.startswith(query_lower):
                return 1
            else:
                return 2

        df_matches['priority'] = df_matches['corp_name'].apply(calculate_priority)
        
        # 3. Sort: Priority(오름차순) -> CorpName(가나다순)
        # Python의 문자열 정렬은 유니코드 표준을 따르므로 한글 가나다순이 정확함
        df_matches = df_matches.sort_values(by=['priority', 'corp_name'], ascending=[True, True])
        
        return df_matches[['corp_code', 'corp_name', 'stock_code']].to_dict(orient="records")
    except Exception as e:
        print(f"DB Search Error: {e}")
        return []

import httpx
import asyncio

# ... (기존 import)

@app.get("/api/financial_statements")
async def get_financial_statements(corp_code: str, start_year: str = "2023", end_year: str = "2024"):
    """
    DART API를 통해 특정 기간(start_year ~ end_year)의 모든 분기별 재무 데이터를 병렬로 수집합니다.
    """
    api_key = os.getenv("DART_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="DART API KEY not configured")

    url = "https://opendart.fss.or.kr/api/fnlttSinglAcnt.json"
    
    # 보고서 코드 매핑 (1Q, 2Q, 3Q, 4Q)
    # 1분기: 11013, 반기: 11012, 3분기: 11014, 사업보고서: 11011
    reprt_codes = [
        ("11013", "1Q"), 
        ("11012", "2Q"), 
        ("11014", "3Q"), 
        ("11011", "4Q")
    ]

    tasks = []
    years = range(int(start_year), int(end_year) + 1)

    async with httpx.AsyncClient() as client:
        for year in years:
            for code, q_name in reprt_codes:
                params = {
                    "crtfc_key": api_key,
                    "corp_code": corp_code,
                    "bsns_year": str(year),
                    "reprt_code": code
                }
                # 각 요청을 비동기 태스크로 생성
                tasks.append(fetch_dart_data(client, url, params, str(year), q_name))
        
        # 병렬 실행
        results = await asyncio.gather(*tasks)

    # 결과 필터링 및 평탄화 (Flatten)
    # 에러가 있거나 데이터가 없는 분기는 제외, 유효한 데이터만 하나의 리스트로 합침
    all_data = []
    for res in results:
        if res and res.get('status') == '000' and 'list' in res:
            # 각 데이터 항목에 'period_name' (예: 2023.1Q) 필드 추가
            year = res['year']
            quarter = res['quarter']
            for item in res['list']:
                item['period_name'] = f"{year}.{quarter}"
                # 정렬을 위한 정수형 키 추가 (20231, 20232...)
                item['sort_key'] = int(f"{year}{quarter[0]}") 
                all_data.append(item)

    # 시간순 정렬
    all_data.sort(key=lambda x: x['sort_key'])

    return {"status": "000", "message": "정상", "list": all_data}

async def fetch_dart_data(client, url, params, year, quarter):
    try:
        response = await client.get(url, params=params)
        data = response.json()
        data['year'] = year
        data['quarter'] = quarter
        return data
    except Exception as e:
        print(f"Error fetching {year} {quarter}: {e}")
        return None

# ... (기존 API들 유지)

@app.get("/api/dividends")
def get_dividends(corp_code: Optional[str] = None, stock_knd: str = "보통주"):
    """
    데이터베이스에서 배당 데이터를 가져옵니다.
    주식 종류 필터링 및 시계열 정렬을 백엔드에서 수행하여 데이터 정합성을 보장합니다.
    """
    try:
        # SQL 쿼리 정의 (시계열 정렬 로직 포함)
        query = text("""
            SELECT 
                d.corp_code,
                c.corp_name,
                d.bsns_year AS year,
                d.reprt_code,
                d.stock_knd,
                d.dps,
                d.dividend_yield AS yield,
                d.payout_ratio
            FROM dart_dividends d
            JOIN dart_corps c ON d.corp_code = c.corp_code
            WHERE d.stock_knd = :stock_knd
            ORDER BY 
                d.corp_code,
                CAST(d.bsns_year AS INTEGER) ASC,
                CASE d.reprt_code
                    WHEN '1Q' THEN 1
                    WHEN '2Q' THEN 2
                    WHEN '3Q' THEN 3
                    WHEN '4Q' THEN 4
                    ELSE 9
                END ASC
        """)
        
        params = {"stock_knd": stock_knd}
        
        # 기업 코드로 필터링이 필요한 경우 (확장성 고려)
        if corp_code:
            # 쿼리에 조건 추가 (간단한 구현을 위해 텍스트 조작 대신 파라미터 활용)
            query = text("""
                SELECT 
                    d.corp_code,
                    c.corp_name,
                    d.bsns_year AS year,
                    d.reprt_code,
                    d.stock_knd,
                    d.dps,
                    d.dividend_yield AS yield,
                    d.payout_ratio
                FROM dart_dividends d
                JOIN dart_corps c ON d.corp_code = c.corp_code
                WHERE d.stock_knd = :stock_knd AND d.corp_code = :corp_code
                ORDER BY 
                    CAST(d.bsns_year AS INTEGER) ASC,
                    CASE d.reprt_code
                        WHEN '1Q' THEN 1
                        WHEN '2Q' THEN 2
                        WHEN '3Q' THEN 3
                        WHEN '4Q' THEN 4
                        ELSE 9
                    END ASC
            """)
            params["corp_code"] = corp_code

        df = pd.read_sql(query, engine, params=params)
        
        # JSON 직렬화를 위해 NaN을 None(null)으로 변환
        df = df.replace({np.nan: None})
        
        return df.to_dict(orient="records")

    except Exception as e:
        print(f"Error fetching data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """
    LangChain을 사용하여 챗봇 응답을 스트리밍으로 생성합니다.
    System Prompt와 User History를 체계적으로 관리합니다.
    """
    # LangChain Chat Model 초기화
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        streaming=True,
        api_key=os.getenv("OPENAI_API_KEY")
    )

    # Prompt Template 정의
    prompt = ChatPromptTemplate.from_messages([
        ("system",
        "당신은 전문적인 금융 분석 보조 에이전트입니다.\n"
        "사용자에게 정확하고 신뢰할 수 있는 금융 정보를 제공하세요.\n"
        "제공된 기사나 데이터가 있다면 이를 기반으로 얻을 수 있는 인사이트를 추출하고 답변하세요.\n"
        "'기사 출처: 링크'의 형태로 출처를 밝히세요\n"),
        MessagesPlaceholder(variable_name="history"),
    ])

    # 메시지 변환 (Pydantic -> LangChain)
    history = []
    for m in request.messages:
        if m.role == "user":
            history.append(HumanMessage(content=m.content))
        elif m.role == "assistant":
            history.append(AIMessage(content=m.content))
        elif m.role == "system":
            # 클라이언트에서 시스템 메시지를 보낼 경우 처리 (선택 사항)
            history.append(SystemMessage(content=m.content))

    # Chain 생성
    chain = prompt | llm

    async def generate():
        try:
            # LangChain astream을 사용하여 스트리밍
            async for chunk in chain.astream({"history": history}):
                if chunk.content:
                    yield chunk.content
        except Exception as e:
            print(f"Chat Stream Error: {e}")
            yield f"Error: {str(e)}"

    return StreamingResponse(generate(), media_type="text/event-stream")

# Financial keywords for query augmentation
FINANCIAL_KEYWORDS = ["주가", "실적", "공시", "배당", "증권", "투자", "매출", "영업이익", "수주", "이익"]

@app.get("/api/news")
def get_live_news(query: str):
    """
    네이버 뉴스 API를 통해 실시간 뉴스 3개를 가져옵니다.
    금융 관련 키워드를 자동으로 추가하여 정확도를 높이고 유사도순(sim)으로 정렬합니다.
    """
    try:
        # Query Augmentation: (query) AND (keyword1 | keyword2 | ...)
        keyword_part = " | ".join(FINANCIAL_KEYWORDS)
        augmented_query = f"{query} ({keyword_part})"
        
        # 본문 크롤링 활성화 및 유사도순(sim) 정렬 유지
        result = crawl_naver_news(augmented_query, display=10, sort='sim', crawl_content=True)
        
        if result and 'items' in result:
            return result['items']
        return []
    except Exception as e:
        print(f"News API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)