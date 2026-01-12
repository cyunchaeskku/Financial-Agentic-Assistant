import React, { useState } from 'react';
import DividendChart from '../components/DividendChart';
import ChatBot from '../components/ChatBot';
import NewsAnalysis from '../components/NewsAnalysis';

const Dashboard = () => {
  const [isAnalysisMode, setIsAnalysisMode] = useState(false);
  const [selectedNewsItems, setSelectedNewsItems] = useState([]);

  return (
    <div className="dashboard-container">
      <div className="chart-section">
        <DividendChart />
      </div>
      <div className="news-section">
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

export default Dashboard;