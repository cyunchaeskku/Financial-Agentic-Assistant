import React, { useState } from 'react';
import axios from 'axios';

const NewsAnalysis = () => {
  const [query, setQuery] = useState('');
  const [newsList, setNewsList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState(null);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setErrorStatus(null);
    setNewsList([]);

    try {
      const response = await axios.get(`http://localhost:8000/api/news?query=${encodeURIComponent(query)}`, {
        timeout: 7000 // 7초 타임아웃 설정
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

  return (
    <div className="news-analysis-container">
      <div className="search-bar-container">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="분석할 기업명을 입력하세요."
            className="search-input"
          />
          <button type="submit" className="search-button" disabled={isLoading}>
            {isLoading ? '검색 중...' : '확인'}
          </button>
        </form>
      </div>

      <div className="news-list-scrollable">
        {newsList.length > 0 ? (
          newsList.map((news, index) => (
            <div key={index} className="news-item-card">
              <a href={news.link} target="_blank" rel="noopener noreferrer" className="news-title">
                {news.title}
              </a>
              <p className="news-description">{news.description}</p>
              <span className="news-date">{new Date(news.pubDate).toLocaleDateString()}</span>
            </div>
          ))
        ) : (
          <div className="empty-news">
            {isLoading ? (
              <div className="loading-state">기사를 불러오고 있습니다...</div>
            ) : (
              <div className="fallback-state">
                {errorStatus === 'timeout' && '요청 시간이 초과되었습니다. 다시 시도해 주세요.'}
                {errorStatus === 'search_empty' && `'${query}'에 대한 최신 뉴스가 없습니다.`}
                {errorStatus === 'error' && '뉴스 검색 중 오류가 발생했습니다.'}
                {!errorStatus && '검색어를 입력하고 확인 버튼을 눌러주세요.'}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .news-analysis-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
        }
        .search-bar-container {
          margin-bottom: 20px;
        }
        .search-form {
          display: flex;
          gap: 10px;
        }
        .search-input {
          flex: 1;
          padding: 12px 15px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 1rem;
        }
        .search-button {
          padding: 10px 25px;
          background-color: #2c3e50;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
        }
        .search-button:hover {
          background-color: #34495e;
        }
        .news-list-scrollable {
          flex: 1;
          overflow-y: auto;
          padding-right: 10px;
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .news-item-card {
          padding: 15px;
          border: 1px solid #eee;
          border-radius: 10px;
          background-color: #f9f9f9;
          transition: transform 0.2s;
        }
        .news-item-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.05);
        }
        .news-title {
          display: block;
          font-size: 1.1rem;
          font-weight: 600;
          color: #2980b9;
          text-decoration: none;
          margin-bottom: 8px;
        }
        .news-title:hover {
          text-decoration: underline;
        }
        .news-description {
          font-size: 0.9rem;
          color: #666;
          line-height: 1.5;
          margin-bottom: 10px;
        }
        .news-date {
          font-size: 0.8rem;
          color: #999;
        }
        .empty-news {
          text-align: center;
          margin-top: 50px;
          color: #95a5a6;
        }
      `}</style>
    </div>
  );
};

export default NewsAnalysis;
