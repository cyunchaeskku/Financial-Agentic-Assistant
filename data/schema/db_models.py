"""
[Database Schema Definitions]
SQLAlchemy ORM을 사용한 PostgreSQL 데이터베이스 테이블 스키마 정의 모듈입니다.

Tables:
1. CorpCode (dart_corps): 기업 마스터 정보
2. DartDividendRaw (dart_dividends_raw): 수집된 배당 원천 데이터 (Snapshot, String Type)
3. DartDividend (dart_dividends): 분석용 배당 데이터 (Cleaned, Wide Format, Numeric Type)

DB Connection:
.env 파일의 POSTGRES_URL 정보를 사용하여 엔진 및 세션을 생성합니다.
"""

from sqlalchemy import Column, String, Date, Integer, ForeignKey, create_engine, UniqueConstraint, Float, BigInteger
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import os
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()

class CorpCode(Base):
    """DART 기업 고유번호 테이블"""
    __tablename__ = 'dart_corps'

    corp_code = Column(String(8), primary_key=True, comment='기업고유번호')
    corp_name = Column(String(255), nullable=False, comment='기업명')
    stock_code = Column(String(6), nullable=True, comment='종목코드')
    modify_date = Column(String(8), nullable=False, comment='최종변경일자')

class DartDividendRaw(Base):
    """DART 배당 정보 Raw Data 테이블 (Snapshot)"""
    __tablename__ = 'dart_dividends_raw'

    id = Column(Integer, primary_key=True, autoincrement=True)
    rcept_no = Column(String(14), comment='접수번호')
    corp_code = Column(String(8), nullable=False, comment='기업고유번호')
    corp_name = Column(String(255), comment='기업명')
    bsns_year = Column(String(4), nullable=False, comment='사업연도')
    reprt_code = Column(String(5), nullable=False, comment='보고서코드')
    se = Column(String(100), nullable=False, comment='구분')
    stock_knd = Column(String(50), nullable=True, comment='주식종류')
    thstrm = Column(String(50), comment='당기')
    frmtrm = Column(String(50), comment='전기')
    lwfr = Column(String(50), comment='전전기')
    stlm_dt = Column(String(10), comment='결산일')

    # Upsert를 위한 유니크 제약조건 (중복 방지)
    __table_args__ = (
        UniqueConstraint('corp_code', 'bsns_year', 'reprt_code', 'se', 'stock_knd', name='uix_dividend_raw_identifier'),
    )

class DartDividend(Base):
    """DART 배당 정보 분석용 테이블 (Cleaned & Wide Format)"""
    __tablename__ = 'dart_dividends'

    id = Column(Integer, primary_key=True, autoincrement=True)
    corp_code = Column(String(8), ForeignKey('dart_corps.corp_code'), nullable=False, comment='기업고유번호')
    corp_name = Column(String(255), comment='기업명')
    bsns_year = Column(String(4), nullable=False, comment='사업연도')
    reprt_code = Column(String(5), comment='보고서코드')
    stock_knd = Column(String(50), nullable=True, comment='주식종류 (보통주/우선주)')
    
    # 분석용 지표 (Numeric)
    dps = Column(Integer, comment='주당 배당금(원)')
    dividend_yield = Column(Float, comment='배당 수익률(%)')
    total_dividend = Column(BigInteger, comment='배당금 총액(원)')
    net_income = Column(BigInteger, comment='당기순이익(원)')
    eps = Column(Integer, comment='주당순이익(원)')
    payout_ratio = Column(Float, comment='배당성향(%)')
    
    stlm_dt = Column(String(10), comment='결산일')

    # 유니크 제약조건 (Upsert용)
    __table_args__ = (
        UniqueConstraint('corp_code', 'bsns_year', 'reprt_code', 'stock_knd', name='uix_dividend_clean_identifier'),
    )

    # 관계 설정
    corporation = relationship("CorpCode", backref="dividends")

# DB 연결 설정
DB_URL = f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@localhost:5432/{os.getenv('POSTGRES_DB')}"
engine = create_engine(DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """테이블 생성"""
    Base.metadata.create_all(bind=engine)
