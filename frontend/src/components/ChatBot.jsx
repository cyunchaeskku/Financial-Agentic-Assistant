import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import GlassInputForm from './GlassInputForm';
import { useFinancialContext } from '../store/FinancialContext';

const ChatBot = ({ isCollapsed, onToggleCollapse }) => {
  const location = useLocation();
  const { 
    chatMessages, setChatMessages,
    isAnalysisMode, setIsAnalysisMode,
    selectedNewsItems
  } = useFinancialContext();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dotCount, setDotCount] = useState(1);
  const messagesContainerRef = useRef(null);

  // 로딩 중 점 애니메이션 효과
  useEffect(() => {
    let interval;
    if (isLoading) {
      interval = setInterval(() => {
        setDotCount(prev => (prev % 3) + 1);
      }, 500);
    } else {
      setDotCount(1);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const { scrollHeight, clientHeight } = messagesContainerRef.current;
      messagesContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (!isCollapsed) {
      // 약간의 지연을 두어 렌더링 후 스크롤되도록 함
      setTimeout(scrollToBottom, 100);
    }
  }, [chatMessages, isCollapsed]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // 화면에 표시할 메시지 (순수 사용자 입력)
    const displayUserMessage = { role: 'user', content: input };
    setChatMessages(prev => [...prev, displayUserMessage]);
    
    setInput('');
    setIsLoading(true);

    try {
      // API에 전송할 메시지 목록 구성 (최근 3쌍 = 6개 메시지로 제한)
      let allMessages = [...chatMessages, displayUserMessage].map(m => ({ role: m.role, content: m.content }));
      
      // Context Window: 최근 6개 메시지만 선택
      let apiMessages = allMessages.slice(-6);
      
      let isReportGeneration = false;

      // [핵심 조건] 분석 모드이고 선택된 기사가 있을 때만 시스템 프롬프트 강화 및 리포트 태깅
      if (isAnalysisMode && selectedNewsItems && selectedNewsItems.length > 0) {
        isReportGeneration = true;
        const contextString = selectedNewsItems.map((news, idx) => (
          `[기사 ${idx + 1}]\n제목: ${news.title}\n링크: ${news.link}\n내용: ${news.content || news.description || '내용 없음'}\n`
        )).join('\n');

        // 사용자 메시지에 컨텍스트 주입
        const lastMsgIndex = apiMessages.length - 1;
        apiMessages[lastMsgIndex].content = `[참고 자료]\n${contextString}\n\n[보고서 작성 요청]\n${input}`;

        // 전략 기획실 베테랑 페르소나 주입
        const expertSystemPrompt = {
            role: 'system',
            content: `당신은 기업 기획전략실에서 20년간 근무한 베테랑 전략 담당자입니다.
최고경영진의 의사결정을 돕는 전략 보고서를 Markdown 형식으로 작성하십시오.

[작성 원칙]
1. 비즈니스 관점의 전문성: 산업 동향과 재무적 함의를 깊이 있게 분석하십시오.
2. 사실(Fact)과 해석(Insight) 구분: 핵심 중심의 시사점을 도출하십시오.
3. 전략적 대응 방향: 리스크, 기회, 대응 방향을 함께 제시하십시오.
4. 가독성 최우선: Markdown 제목, 불릿, 표를 적극 활용하십시오.`
        };
        
        // 메시지 내역 맨 앞에 특수 시스템 지시문 추가
        apiMessages.unshift(expertSystemPrompt);
      }

      // 1. 메시지 객체 생성 (isReport 플래그 포함)
      setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: '', 
          isReport: isReportGeneration,
          timestamp: new Date().toISOString()
      }]);

      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages
        }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        const chunkValue = decoder.decode(value, { stream: true });

        // 실시간으로 마지막 메시지(Assistant 응답) 업데이트
        setChatMessages(prev => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          
          // 중요: 기존 객체를 직접 수정하지 않고, 새로운 객체로 교체 (불변성 유지)
          newMessages[lastIndex] = {
            ...newMessages[lastIndex],
            content: newMessages[lastIndex].content + chunkValue
          };
          
          return newMessages;
        });
      }

    } catch (error) {
      console.error('Chat Error:', error);
      setChatMessages(prev => {
        const newMessages = [...prev];
        // 에러 발생 시 마지막 빈 메시지를 에러 메시지로 교체 혹은 추가
        if (newMessages[newMessages.length - 1].role === 'assistant' && newMessages[newMessages.length - 1].content === '') {
             newMessages[newMessages.length - 1].content = '오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else {
             newMessages.push({ role: 'assistant', content: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`chatbot-container ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="chatbot-header" style={{ justifyContent: isCollapsed ? 'center' : 'space-between', padding: isCollapsed ? '15px 0' : '15px 20px' }}>
        <button 
           className="collapse-btn" 
           onClick={onToggleCollapse}
           title={isCollapsed ? "Expand" : "Collapse"}
           style={{ 
             background: 'none', 
             border: 'none', 
             color: 'white', 
             cursor: 'pointer', 
             padding: '5px',
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             marginRight: isCollapsed ? '0' : '10px',
             zIndex: 20 // Ensure button is always clickable
           }}
         >
           {isCollapsed ? (
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <polyline points="15 18 9 12 15 6"></polyline>
             </svg>
           ) : (
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <polyline points="9 18 15 12 9 6"></polyline>
             </svg>
           )}
        </button>

        <div className="header-content-wrapper" style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', opacity: isCollapsed ? 0 : 1, transition: 'opacity 0.2s ease', pointerEvents: isCollapsed ? 'none' : 'auto' }}>
          <h3 style={{ flex: 1 }}>AI Financial Assistant</h3>
          {location.pathname === '/news' && (
            <div className="analysis-toggle-container">
              <div className="label-with-tooltip">
                <span className="analysis-toggle-label">기사 분석 모드</span>
                <div className="tooltip-container">
                  <span className="info-icon">?</span>
                  <span className="tooltip-text">검색된 기사 내용을 분석 문맥에 포함합니다.</span>
                </div>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={isAnalysisMode}
                  onChange={() => setIsAnalysisMode(!isAnalysisMode)}
                />
                <span className="slider"></span>
              </label>
            </div>
          )}
        </div>
      </div>
      
      <div className="chatbot-body-wrapper" style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
        opacity: isCollapsed ? 0 : 1, 
        transition: 'opacity 0.2s ease',
        pointerEvents: isCollapsed ? 'none' : 'auto'
      }}>
          <div className="chatbot-messages" ref={messagesContainerRef}>
            {chatMessages.map((msg, index) => {
              // 스트리밍 시작 전(빈 메시지)인 경우 렌더링하지 않음 (로딩 버블과 중복 방지)
              if (msg.role === 'assistant' && !msg.content) return null;
              
              return (
                <div key={index} className={`message-bubble ${msg.role}`}>
                  <div className="message-content">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {/* 리포트일 경우 내보내기 버튼 표시 */}
                  {msg.isReport && msg.content && (
                    <div className="report-actions" style={{ 
                        marginTop: '12px', 
                        paddingTop: '10px', 
                        borderTop: '1px solid rgba(0,0,0,0.08)',
                        display: 'flex',
                        justifyContent: 'flex-end'
                    }}>
                        <button 
                            onClick={() => {
                                const blob = new Blob([msg.content], { type: 'text/markdown' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                const dateStr = new Date(msg.timestamp).toISOString().slice(0, 10).replace(/-/g, '');
                                a.href = url;
                                a.download = `Report_${dateStr}.md`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            }}
                            title="Download as Markdown"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(44, 62, 80, 0.05)',
                                border: '1px solid rgba(44, 62, 80, 0.2)',
                                borderRadius: '6px',
                                padding: '5px 10px',
                                fontSize: '0.75rem',
                                color: '#2c3e50',
                                cursor: 'pointer',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(44, 62, 80, 0.1)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(44, 62, 80, 0.05)'}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Export Report
                        </button>
                    </div>
                  )}
                </div>
              );
            })}
            {/* 로딩 중이고, 아직 마지막 메시지(Assistant)에 내용이 들어오지 않았을 때만 로딩 버블 표시 */}
            {isLoading && chatMessages.length > 0 && 
             (chatMessages[chatMessages.length - 1].role !== 'assistant' || !chatMessages[chatMessages.length - 1].content) && (
              <div className="message-bubble assistant">
                <div className="message-content loading">
                  답변을 생성 중입니다{'.'.repeat(dotCount)}
                </div>
              </div>
            )}
          </div>
          
          <GlassInputForm
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onSubmit={handleSendMessage}
            placeholder="질문을 입력하세요..."
            disabled={isLoading}
            isSubmitDisabled={!input.trim()}
            buttonText="전송"
            className="chatbot-bottom-fixed"
          />
          
          {/* Liquid Glass SVG Filter Definition */}
          <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
            <defs>
              <filter id="liquid-glass-filter">
                {/* 1. 부드러운 유동적 노이즈 생성 (물결 느낌) */}
                <feTurbulence 
                  type="fractalNoise" 
                  baseFrequency="0.015" 
                  numOctaves="3" 
                  result="fluidNoise" 
                />
                {/* 2. 노이즈를 약간 흐리게 하여 거친 느낌 제거 */}
                <feGaussianBlur 
                  in="fluidNoise" 
                  stdDeviation="2" 
                  result="smoothNoise" 
                />
                {/* 3. 배경 이미지(SourceGraphic)를 노이즈 맵(smoothNoise)에 따라 굴절시킴 */}
                <feDisplacementMap 
                  in="SourceGraphic" 
                  in2="smoothNoise" 
                  scale="30" 
                  xChannelSelector="R" 
                  yChannelSelector="G" 
                />
              </filter>
            </defs>
          </svg>
      </div>
    </div>
  );
};

export default ChatBot;
