import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { useFinancialContext } from '../store/FinancialContext';
import NewsModal from '../components/NewsModal';

// 아이콘 사용을 위해 font-awesome 대신 텍스트나 SVG 아이콘 사용 (프로젝트에 font-awesome 설치 여부 불확실)
// 여기서는 간단한 SVG 아이콘을 직접 정의하여 사용합니다.

const NewsGrid = () => {
  const { 
    newsQuery, setNewsQuery, 
    newsList, setNewsList, 
    chatMessages, setChatMessages,
    isAnalysisMode, setIsAnalysisMode,
    selectedNewsItems, setSelectedNewsItems
  } = useFinancialContext();

  const [isLoading, setIsLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedNews, setSelectedNews] = useState(null); // 모달용
  const messagesEndRef = useRef(null);

  // 뉴스 검색 (Enter 키)
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!newsQuery.trim() || isLoading) return;

    setIsLoading(true);
    setNewsList([]);
    if (setSelectedNewsItems) setSelectedNewsItems([]); // 검색 시 선택 초기화

    try {
      // API 호출 (기존 NewsAnalysis 로직)
      const response = await axios.get(`http://localhost:8000/api/news?query=${encodeURIComponent(newsQuery)}`, {
        timeout: 15000 
      });
      if (response.data && response.data.length > 0) {
        setNewsList(response.data);
      }
    } catch (error) {
      console.error('News fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 챗봇 메시지 전송
  const handleSendMessage = async (inputOveride = null) => {
    const messageContent = inputOveride || chatInput;
    if (!messageContent.trim() || isChatLoading) return;

    // 사용자 메시지 표시
    const displayUserMessage = { role: 'user', content: messageContent };
    setChatMessages(prev => [...prev, displayUserMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
        let apiMessages = [...chatMessages, displayUserMessage].map(m => ({ role: m.role, content: m.content }));

        // 분석 모드이고 선택된 기사가 있다면 컨텍스트 주입
        // (UI상에서 'AI 분석' 버튼을 누르면 해당 기사가 자동으로 선택된 상태로 간주하거나, 
        //  현재 선택된 기사들을 컨텍스트로 넣음)
        if (isAnalysisMode && selectedNewsItems && selectedNewsItems.length > 0) {
            const contextString = selectedNewsItems.map((news, idx) => (
              `[기사 ${idx + 1}]
제목: ${news.title}
링크: ${news.link}
내용: ${news.content || news.description || '내용 없음'}
`
            )).join('\n');
    
            const lastMsgIndex = apiMessages.length - 1;
            apiMessages[lastMsgIndex].content = `[참고 자료]\n${contextString}\n\n[질문]\n${messageContent}`;
        }

        // 스트리밍을 위한 빈 메시지 추가
        setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        const response = await fetch('http://localhost:8000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: apiMessages }),
        });

        if (!response.body) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;

        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            const chunkValue = decoder.decode(value, { stream: true });

            setChatMessages(prev => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                newMessages[lastIndex] = {
                    ...newMessages[lastIndex],
                    content: newMessages[lastIndex].content + chunkValue
                };
                return newMessages;
            });
        }
    } catch (error) {
        console.error('Chat Error:', error);
        setChatMessages(prev => [...prev, { role: 'assistant', content: '오류가 발생했습니다.' }]);
    } finally {
        setIsChatLoading(false);
    }
  };

  // AI 분석 버튼 클릭 핸들러
  const handleAnalyzeClick = (e, news) => {
      e.stopPropagation(); // 카드 클릭 방지
      // 1. 해당 뉴스를 선택 상태로 설정 (분석 모드 켜기)
      if (setSelectedNewsItems) setSelectedNewsItems([news]);
      if (!isAnalysisMode) setIsAnalysisMode(true); 
      
      // 2. 챗봇에 분석 요청 메시지 전송
      handleSendMessage(`'${news.title}' 기사의 핵심 내용을 분석하고 시사점을 알려줘.`);
  };

  // 카드 클릭 시 모달 오픈
  const handleCardClick = (news) => {
      setSelectedNews(news);
  };

  // 챗봇 스크롤 하단 고정
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);


  return (
    <div className="news-grid-page">
      {/* --- Left Panel: News Feed --- */}
      <main className="news-panel">
        <div className="panel-header">
          <div className="panel-title">Naver News Feed</div>
          <form className="search-bar" onSubmit={handleSearch}>
            <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
                type="text" 
                placeholder="키워드 검색 (예: 삼성전자, DX, 생성형 AI)" 
                value={newsQuery}
                onChange={(e) => setNewsQuery(e.target.value)}
            />
          </form>
        </div>

        <div className="news-grid">
            {newsList.length > 0 ? (
                newsList.map((news, index) => (
                    <article key={index} className="news-card" onClick={() => handleCardClick(news)}>
                        <div>
                            <div className="news-meta">
                                <span className="news-source">뉴스</span>
                                <time>{new Date(news.pubDate).toLocaleDateString()}</time>
                            </div>
                            <h3 className="news-title" dangerouslySetInnerHTML={{ __html: news.title }}></h3>
                            <p className="news-summary" dangerouslySetInnerHTML={{ __html: news.description }}></p>
                        </div>
                        <div className="card-footer">
                            <button className="btn-analyze" onClick={(e) => handleAnalyzeClick(e, news)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                                </svg>
                                AI 분석
                            </button>
                        </div>
                    </article>
                ))
            ) : (
                <div className="empty-state">
                    {isLoading ? '검색 중입니다...' : '검색 결과가 없습니다. 키워드를 입력해보세요.'}
                </div>
            )}
        </div>
      </main>

      {/* --- Right Panel: Chatbot --- */}
      <aside className="chat-panel">
        <div className="chat-header">
            <div className="chat-title">
                <span className="status-dot"></span> Insight Assistant
            </div>
            <div className="chat-subtitle">LLM-powered News Analyst</div>
            <div className="chat-mode-switch">
                 {/* 분석 모드 토글 (선택적 표시) */}
                 <label style={{display: 'flex', alignItems: 'center', fontSize: '0.8rem', gap: '5px', cursor: 'pointer'}}>
                    <input 
                        type="checkbox" 
                        checked={isAnalysisMode} 
                        onChange={() => setIsAnalysisMode(!isAnalysisMode)} 
                    />
                    Context Mode
                 </label>
            </div>
        </div>

        <div className="chat-messages">
            {chatMessages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role === 'user' ? 'user' : 'bot'}`}>
                    <div className="msg-bubble">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    <div className="msg-meta">
                        <span>{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                    </div>
                </div>
            ))}
            {isChatLoading && chatMessages[chatMessages.length - 1]?.role === 'user' && (
                <div className="message bot">
                    <div className="msg-bubble">
                         <span className="typing-indicator">...</span>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
            <div className="input-wrapper">
                <textarea 
                    className="chat-input" 
                    placeholder="기사에 대해 질문하세요..." 
                    rows="1"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                    }}
                ></textarea>
                <button className="btn-send" onClick={() => handleSendMessage()}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        </div>
      </aside>

      {/* Modal */}
      <NewsModal news={selectedNews} onClose={() => setSelectedNews(null)} />

      {/* Styles (Scoped) */}
      <style jsx>{`
        /* --- Base & Layout --- */
        .news-grid-page {
            display: flex;
            height: calc(100vh - 80px); /* Header height approx */
            background-color: #F3F4F6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow: hidden;
        }

        /* --- Left Panel: News Feed --- */
        .news-panel {
            flex: 3;
            padding: 24px 40px;
            overflow-y: auto;
            border-right: 1px solid #E5E7EB;
        }

        .panel-header {
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .panel-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: #111827;
        }

        .search-bar {
            position: relative;
            width: 400px;
        }

        .search-icon {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: #6B7280;
        }

        .search-bar input {
            width: 100%;
            padding: 10px 16px 10px 40px;
            border: 1px solid #E5E7EB;
            border-radius: 8px;
            font-size: 0.95rem;
            outline: none;
            transition: all 0.2s;
        }

        .search-bar input:focus {
            border-color: #2563EB;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        /* News Cards Grid */
        .news-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            padding-bottom: 40px;
        }

        .news-card {
            background: #fff;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            border: 1px solid #E5E7EB;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 280px;
            cursor: pointer;
        }

        .news-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            border-color: #2563EB;
        }

        .news-meta {
            display: flex;
            justify-content: space-between;
            font-size: 0.8rem;
            color: #6B7280;
            margin-bottom: 12px;
        }

        .news-source {
            font-weight: 600;
            color: #2563EB;
            background: #EFF6FF;
            padding: 2px 8px;
            border-radius: 4px;
        }

        .news-title {
            font-size: 1.1rem;
            font-weight: 700;
            line-height: 1.4;
            margin-bottom: 10px;
            color: #111827;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .news-summary {
            font-size: 0.9rem;
            color: #4B5563;
            line-height: 1.5;
            margin-bottom: 16px;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
            flex-grow: 1;
        }

        .card-footer {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            border-top: 1px solid #F3F4F6;
            padding-top: 12px;
        }

        .btn-analyze {
            background-color: #fff;
            color: #2563EB;
            border: 1px solid #E5E7EB;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .btn-analyze:hover {
            background-color: #EFF6FF;
            border-color: #2563EB;
        }

        /* --- Right Panel: Chatbot --- */
        .chat-panel {
            flex: 1;
            background-color: #FFFFFF;
            display: flex;
            flex-direction: column;
            box-shadow: -1px 0 0 0 #E5E7EB;
            min-width: 350px;
            z-index: 10;
        }

        .chat-header {
            padding: 20px;
            border-bottom: 1px solid #E5E7EB;
            background: #fff;
        }

        .chat-title {
            font-weight: 700;
            font-size: 1rem;
            display: flex;
            align-items: center;
            gap: 8px;
            color: #111827;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            background-color: #10B981;
            border-radius: 50%;
            display: inline-block;
        }

        .chat-subtitle {
            font-size: 0.8rem;
            color: #6B7280;
            margin-top: 4px;
            margin-left: 16px;
        }

        .chat-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 16px;
            background-color: #F9FAFB;
        }

        /* Message Bubbles */
        .message {
            max-width: 90%;
            line-height: 1.5;
            font-size: 0.9rem;
            position: relative;
        }

        .message.bot {
            align-self: flex-start;
        }

        .message.user {
            align-self: flex-end;
        }

        .msg-bubble {
            padding: 12px 16px;
            border-radius: 12px;
            position: relative;
            word-break: break-word;
        }

        .message.bot .msg-bubble {
            background-color: #fff;
            border: 1px solid #E5E7EB;
            border-top-left-radius: 0;
            color: #111827;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }

        .message.user .msg-bubble {
            background-color: #2563EB;
            color: white;
            border-top-right-radius: 0;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        
        .message.user .msg-bubble p {
            margin: 0;
        }

        .msg-meta {
            font-size: 0.7rem;
            color: #6B7280;
            margin-top: 4px;
            display: flex;
            gap: 6px;
        }

        .message.user .msg-meta {
            justify-content: flex-end;
        }

        /* Chat Input Area */
        .chat-input-area {
            padding: 20px;
            background-color: #fff;
            border-top: 1px solid #E5E7EB;
        }

        .input-wrapper {
            position: relative;
            display: flex;
            gap: 10px;
        }

        .chat-input {
            flex: 1;
            padding: 12px;
            border: 1px solid #E5E7EB;
            border-radius: 8px;
            resize: none;
            height: 50px;
            font-family: inherit;
            outline: none;
            font-size: 0.9rem;
        }

        .chat-input:focus {
            border-color: #2563EB;
        }

        .btn-send {
            width: 50px;
            height: 50px;
            background-color: #2563EB;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .btn-send:hover {
            background-color: #1D4ED8;
        }
        
        .empty-state {
            grid-column: 1 / -1;
            text-align: center;
            padding: 60px;
            color: #9CA3AF;
            font-size: 1.1rem;
        }
      `}</style>
    </div>
  );
};

export default NewsGrid;
