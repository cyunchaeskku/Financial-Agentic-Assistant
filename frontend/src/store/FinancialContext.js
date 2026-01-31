import React, { createContext, useState, useContext } from 'react';

const FinancialContext = createContext();

export const useFinancialContext = () => useContext(FinancialContext);

export const FinancialProvider = ({ children }) => {
  // --- News State ---
  const [newsQuery, setNewsQuery] = useState('');
  const [newsList, setNewsList] = useState([]);
  const [selectedNewsItems, setSelectedNewsItems] = useState([]);
  const [isAnalysisMode, setIsAnalysisMode] = useState(false);
  
  // --- ChatBot State ---
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: '안녕하세요! 금융 데이터 분석 보조 에이전트입니다. 궁금하신 점을 물어보세요.' }
  ]);

  // --- UI State (Resizing) ---
  const [chatWidth, setChatWidth] = useState(400);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);

  // --- Chart State ---
  const [selectedChartCorps, setSelectedChartCorps] = useState([]);

  const value = {
    newsQuery, setNewsQuery,
    newsList, setNewsList,
    selectedNewsItems, setSelectedNewsItems,
    isAnalysisMode, setIsAnalysisMode,
    chatMessages, setChatMessages,
    chatWidth, setChatWidth,
    isChatCollapsed, setIsChatCollapsed,
    selectedChartCorps, setSelectedChartCorps
  };

  return (
    <FinancialContext.Provider value={value}>
      {children}
    </FinancialContext.Provider>
  );
};
