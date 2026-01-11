import React from 'react';
import ChatBot from '../components/ChatBot';
import NewsAnalysis from '../components/NewsAnalysis';

const News = () => {
  return (
    <div className="dashboard-container">
      <div className="news-section" style={{ display: 'flex', flexDirection: 'column', padding: '20px' }}>
        <NewsAnalysis />
      </div>
      <div className="chat-section">
        <ChatBot />
      </div>
    </div>
  );
};

export default News;
