import React, { useState, useEffect } from 'react';
import axios from 'axios';
import NewsModal from './NewsModal';
import GlassInputForm from './GlassInputForm';
import { useFinancialContext } from '../store/FinancialContext';

const NewsAnalysis = () => {
  const { 
    newsQuery, setNewsQuery, 
    newsList, setNewsList, 
    selectedNewsItems, setSelectedNewsItems,
    isAnalysisMode
  } = useFinancialContext();

  const [isLoading, setIsLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState(null);
  const [selectedNews, setSelectedNews] = useState(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    let timer;
    if (showToast) {
      timer = setTimeout(() => {
        setShowToast(false);
      }, 2000);
    }
    return () => clearTimeout(timer);
  }, [showToast]);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!newsQuery.trim() || isLoading) return;

    setIsLoading(true);
    setErrorStatus(null);
    setNewsList([]);
    // 검색 시 선택 초기화
    if (setSelectedNewsItems) setSelectedNewsItems([]);

    try {
      const response = await axios.get(`http://localhost:8000/api/news?query=${encodeURIComponent(newsQuery)}`, {
        timeout: 15000 
      });
      
      if (response.data && response.data.length > 0) {
        setNewsList(response.data);
      } else {
        setErrorStatus('search_empty');
      }
    } catch (error) {
      console.error('News fetch error:', error);
      if (error.code === 'ECONNABORTED') {
        setErrorStatus('timeout');
      } else {
        setErrorStatus('error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewsClick = (news) => {
    setSelectedNews(news);
  };

  const toggleContextSelection = (e, news) => {
    e.stopPropagation(); // 카드 클릭 이벤트(모달 열기) 방지
    
    if (!isAnalysisMode) {
      setShowToast(true);
      return;
    }

    if (setSelectedNewsItems) {
      setSelectedNewsItems(prev => {
        const isSelected = prev.some(item => item.link === news.link);
        if (isSelected) {
          return prev.filter(item => item.link !== news.link);
        } else {
          return [...prev, news];
        }
      });
    }
  };

  const closeModal = () => {
    setSelectedNews(null);
  };

  // 안전한 렌더링을 위해 기본값 처리
  const safeSelectedItems = selectedNewsItems || [];

  return (
    <div className="news-analysis-container">
      <div className="search-bar-container">
        <GlassInputForm
          value={newsQuery}
          onChange={(e) => setNewsQuery(e.target.value)}
          onSubmit={handleSearch}
          placeholder="분석할 기업명을 입력하세요."
          disabled={isLoading}
          buttonText={isLoading ? '검색 중...' : '확인'}
        />
      </div>

      <div className="analysis-divider"></div>

      <div className="news-list-scrollable">
        {newsList.length > 0 ? (
          newsList.map((news, index) => {
            const isChecked = safeSelectedItems.some(item => item.link === news.link);
            return (
              <div key={index} className="news-item-card" onClick={() => handleNewsClick(news)}>
                <div 
                  className={`news-checkbox ${isChecked ? 'checked' : ''} ${!isAnalysisMode ? 'disabled' : ''}`}
                  onClick={(e) => toggleContextSelection(e, news)}
                >
                  {isChecked && (
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 5L4 8L11 1" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div className="news-title">{news.title}</div>
                <p className="news-description">{news.description}</p>
                <span className="news-date">{new Date(news.pubDate).toLocaleDateString()}</span>
              </div>
            );
          })
        ) : (
          <div className="empty-news">
            {isLoading ? (
              <div className="loading-state">기사를 불러오고 있습니다... (본문 수집 중)</div>
            ) : (
              <div className="fallback-state">
                {errorStatus === 'timeout' && '요청 시간이 초과되었습니다. 다시 시도해 주세요.'}
                {errorStatus === 'search_empty' && `'${newsQuery}'에 대한 최신 뉴스가 없습니다.`}
                {errorStatus === 'error' && '뉴스 검색 중 오류가 발생했습니다.'}
                {!errorStatus && '검색어를 입력하고 확인 버튼을 눌러주세요.'}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* 상세 뉴스 모달 */}
      <NewsModal news={selectedNews} onClose={closeModal} />
      
      {/* Toast Notification */}
      {showToast && (
        <div className="toast-notification">
          기사 분석 모드를 켜주세요
        </div>
      )}

      <style jsx>{`
        .news-analysis-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          position: relative; /* Toast 위치 기준점 */
        }
        .search-bar-container {
          margin-bottom: 0;
        }
        .analysis-divider {
          height: 2px;
          background: linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,0.12), rgba(0,0,0,0));
          margin: 30px 0 15px 0; /* 상단 30px, 하단 15px (나머지 15px는 패딩으로 확보) */
          width: 100%;
        }
        /* search-form, search-input, search-button removed */
        .news-list-scrollable {
          flex: 1;
          overflow-y: auto;
          padding: 15px 10px 15px 0; /* 상단 패딩 15px 부활 (카드 호버 공간 확보) */
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .news-item-card {
          padding: 22px;
          border: 1px solid rgba(0,0,0,0.04);
          border-radius: 12px;
          background-color: #ffffff;
          box-shadow: 0 2px 10px rgba(0,0,0,0.03);
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          cursor: pointer;
          position: relative; /* 체크박스 배치를 위한 기준점 */
        }
        .news-item-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 30px rgba(0,0,0,0.08);
          border-color: rgba(52, 152, 219, 0.3);
        }
        .news-checkbox {
          position: absolute;
          top: 15px;
          right: 15px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid #dfe6e9;
          background-color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          z-index: 5;
        }
        .news-checkbox:hover {
          border-color: #3498db;
          transform: scale(1.1);
        }
        .news-checkbox.disabled {
          background-color: #f1f2f6;
          border-color: #e0e0e0;
          cursor: not-allowed;
          opacity: 0.6;
          /* pointer-events: none; 제거: 클릭 이벤트를 받아야 함 */
        }
        .news-checkbox.checked {
          background-color: #2ecc71; /* 분석 모드 스위치와 동일한 초록색 */
          border-color: #2ecc71;
        }
        .checkmark {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .news-title {
          display: block;
          font-size: 1.15rem;
          font-weight: 700;
          color: #2d3436; /* 신뢰감을 주는 짙은 그레이 */
          margin-bottom: 12px;
          line-height: 1.4;
        }
        .news-description {
          font-size: 0.95rem;
          color: #636e72; /* 차분한 본문 색상 */
          line-height: 1.6;
          margin-bottom: 15px;
        }
        .news-date {
          font-size: 0.85rem;
          color: #b2bec3;
          font-weight: 500;
        }
        .empty-news {
          text-align: center;
          margin-top: 80px;
          color: #b2bec3;
        }
        .fallback-state {
          font-size: 1.1rem;
          color: #636e72;
        }
        .toast-notification {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(0, 0, 0, 0.75);
          color: white;
          padding: 10px 20px;
          border-radius: 20px;
          font-size: 0.9rem;
          z-index: 1000;
          animation: fadeInOut 2s ease-in-out;
          pointer-events: none;
        }
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translate(-50%, 10px); }
          10% { opacity: 1; transform: translate(-50%, 0); }
          90% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -10px); }
        }
      `}</style>
    </div>
  );
};

export default NewsAnalysis;