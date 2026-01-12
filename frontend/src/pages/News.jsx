import React, { useState, useCallback, useEffect } from 'react';
import ChatBot from '../components/ChatBot';
import NewsAnalysis from '../components/NewsAnalysis';

const News = () => {
  // Resizing Logic
  const [chatWidth, setChatWidth] = useState(450); // Initial width
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
        // Calculate new width: Total Window Width - Mouse X Position
        // Adjusting for some margin/padding if necessary
        const newWidth = window.innerWidth - mouseMoveEvent.clientX;
        
        // Set limits (min 350px, max 50% of screen)
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
      <div className="news-section" style={{ display: 'flex', flexDirection: 'column', padding: '20px' }}>
        <NewsAnalysis />
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

export default News;