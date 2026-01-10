import React from 'react';
import './App.css';
import DividendChart from './components/DividendChart';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Financial Agent Dashboard</h1>
      </header>
      <main className="App-main">
        <div className="chart-container">
          <DividendChart />
        </div>
      </main>
    </div>
  );
}

export default App;
