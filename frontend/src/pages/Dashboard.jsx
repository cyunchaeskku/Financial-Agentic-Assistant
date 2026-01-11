import React from 'react';
import DividendChart from '../components/DividendChart';
import ChatBot from '../components/ChatBot';

const Dashboard = () => {
  return (
    <div className="dashboard-container">
      <div className="chart-section">
        <DividendChart />
      </div>
      <div className="chat-section">
        <ChatBot />
      </div>
    </div>
  );
};

export default Dashboard;
