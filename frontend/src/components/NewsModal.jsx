import React, { useEffect, useRef } from 'react';

const NewsModal = ({ news, onClose }) => {
  const modalRef = useRef(null);

  // 모달 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // ESC 키 누르면 닫기
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!news) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" ref={modalRef}>
        <div className="modal-header">
          <h3>{news.title}</h3>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-meta">
          <span className="modal-date">{new Date(news.pubDate).toLocaleString()}</span>
          <a href={news.link} target="_blank" rel="noopener noreferrer" className="original-link">원문 보기 &#8599;</a>
        </div>
        <div className="modal-body">
          {news.content ? (
            <div className="news-text">{news.content}</div>
          ) : (
            <div className="news-fallback">
              <p>{news.description}</p>
              <p className="fallback-note">(본문 내용을 불러올 수 없습니다. 원문 보기를 클릭하세요.)</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          backdrop-filter: blur(2px);
        }
        .modal-content {
          background-color: white;
          width: 90%;
          max-width: 800px;
          height: 80%;
          border-radius: 12px;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .modal-header {
          padding: 20px 25px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .modal-header h3 {
          margin: 0;
          font-size: 1.3rem;
          color: #2c3e50;
          line-height: 1.4;
          flex: 1;
        }
        .close-button {
          background: none;
          border: none;
          font-size: 2rem;
          line-height: 1;
          color: #999;
          cursor: pointer;
          margin-left: 20px;
          padding: 0;
        }
        .close-button:hover {
          color: #333;
        }
        .modal-meta {
          padding: 10px 25px;
          background-color: #f8f9fa;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #eee;
          font-size: 0.9rem;
        }
        .modal-date {
          color: #7f8c8d;
        }
        .original-link {
          color: #3498db;
          text-decoration: none;
          font-weight: 500;
        }
        .original-link:hover {
          text-decoration: underline;
        }
        .modal-body {
          padding: 25px;
          overflow-y: auto;
          flex: 1;
          line-height: 1.8;
          font-size: 1rem;
          color: #333;
        }
        .news-text {
          white-space: pre-wrap; /* 줄바꿈 보존 */
        }
        .fallback-note {
          margin-top: 15px;
          font-size: 0.9rem;
          color: #95a5a6;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default NewsModal;
