import React, { useState, useCallback, useEffect } from 'react';
import DividendChart from '../components/DividendChart';
import ChatBot from '../components/ChatBot';

const Dashboard = () => {
  // Resizing Logic
  const [chatWidth, setChatWidth] = useState(400); // Initial width
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent) => {
      if (isResizing) {
        const newWidth = window.innerWidth - mouseMoveEvent.clientX;
        
        // Limits: min 350px, max 60% of screen
        if (newWidth > 350 && newWidth < window.innerWidth * 0.6) {
          setChatWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <div className="dashboard-container" style={{ cursor: isResizing ? 'col-resize' : 'default', userSelect: isResizing ? 'none' : 'auto' }}>
      <div className="chart-section" style={{ flex: 1 }}>
        <DividendChart />
      </div>

      {/* Resizer Handle */}
      <div 
        className="resizer" 
        onMouseDown={startResizing}
      />

      <div className="chat-section" style={{ width: chatWidth }}>
        <ChatBot />
      </div>
    </div>
  );
};

export default Dashboard;