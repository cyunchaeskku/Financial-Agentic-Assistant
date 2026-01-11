import React from 'react';
import './App.css';
import DividendChart from './components/DividendChart';
import ChatBot from './components/ChatBot';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Financial Agent Dashboard</h1>
      </header>
      <main className="App-main">
        <div className="dashboard-container">
          <div className="chart-section">
            <DividendChart />
          </div>
          <div className="chat-section">
            <ChatBot />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
