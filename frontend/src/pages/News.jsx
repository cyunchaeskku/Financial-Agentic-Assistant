import React, { useState } from 'react';
import ChatBot from '../components/ChatBot';
import NewsAnalysis from '../components/NewsAnalysis';

const News = () => {
  const [isAnalysisMode, setIsAnalysisMode] = useState(false);
  const [selectedNewsItems, setSelectedNewsItems] = useState([]);

  return (
    <div className="dashboard-container">
      <div className="news-section" style={{ display: 'flex', flexDirection: 'column', padding: '20px' }}>
        <NewsAnalysis 
          isAnalysisMode={isAnalysisMode} 
          selectedNewsItems={selectedNewsItems}
          setSelectedNewsItems={setSelectedNewsItems}
        />
      </div>
      <div className="chat-section">
        <ChatBot 
          isAnalysisMode={isAnalysisMode} 
          setIsAnalysisMode={setIsAnalysisMode} 
          selectedNewsItems={selectedNewsItems}
        />
      </div>
    </div>
  );
};

export default News;
