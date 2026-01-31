import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import Dashboard2 from './pages/Dashboard2';
import News from './pages/News';
import { FinancialProvider } from './store/FinancialContext';

function App() {
  return (
    <Router>
      <FinancialProvider>
        <div className="App">
          <header className="App-header">
            <div className="header-content">
              <h1>Financial Agentic Assistant</h1>
              <nav className="header-nav">
                <Link to="/dashboard" className="nav-link">Dashboard</Link>
                <Link to="/dashboard2" className="nav-link">FS Analysis</Link>
                <Link to="/news" className="nav-link">News</Link>
              </nav>
            </div>
          </header>
          <main className="App-main">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard2" element={<Dashboard2 />} />
              <Route path="/news" element={<News />} />
            </Routes>
          </main>
        </div>
      </FinancialProvider>
    </Router>
  );
}

export default App;