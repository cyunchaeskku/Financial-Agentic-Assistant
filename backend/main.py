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
from openai import OpenAI

# Add project root to sys.path to import modules from 'data'
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from data.collectors.crawler.naver_news_crawler import crawl_naver_news

# Load environment variables from parent directory
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=env_path)

app = FastAPI(title="Financial Agent API")

# OpenAI Client Initialization
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Connection
# Docker local default: user/password/financial_db on port 5432
DB_USER = os.getenv("POSTGRES_USER", "user")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "password")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "financial_db")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Financial Agent API is running"}

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
    OpenAI API를 사용하여 챗봇 응답을 스트리밍으로 생성합니다.
    """
    def generate():
        try:
            stream = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": m.role, "content": m.content} for m in request.messages],
                stream=True
            )
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            print(f"Chat Stream Error: {e}")
            yield f"Error: {str(e)}"

    return StreamingResponse(generate(), media_type="text/event-stream")

@app.get("/api/news")
def get_live_news(query: str):
    """
    네이버 뉴스 API를 통해 실시간 뉴스 3개를 가져옵니다.
    """
    try:
        # 본문 크롤링은 속도를 위해 False로 설정 (제목, 요약, 링크만 반환)
        result = crawl_naver_news(query, display=3, sort='sim', crawl_content=False)
        if result and 'items' in result:
            return result['items']
        return []
    except Exception as e:
        print(f"News API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)