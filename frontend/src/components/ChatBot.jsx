import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import GlassInputForm from './GlassInputForm';
import { useFinancialContext } from '../store/FinancialContext';

const ChatBot = () => {
  const { 
    chatMessages, setChatMessages,
    isAnalysisMode, setIsAnalysisMode,
    selectedNewsItems
  } = useFinancialContext();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dotCount, setDotCount] = useState(1);
  const messagesEndRef = useRef(null);

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // 화면에 표시할 메시지 (순수 사용자 입력)
    const displayUserMessage = { role: 'user', content: input };
    setChatMessages(prev => [...prev, displayUserMessage]);
    
    setInput('');
    setIsLoading(true);

    try {
      // API에 전송할 메시지 목록 구성
      let apiMessages = [...chatMessages, displayUserMessage].map(m => ({ role: m.role, content: m.content }));

      // 분석 모드이고 선택된 기사가 있다면 컨텍스트 주입 (마지막 메시지 변형)
      if (isAnalysisMode && selectedNewsItems && selectedNewsItems.length > 0) {
        const contextString = selectedNewsItems.map((news, idx) => (
          `[기사 ${idx + 1}]\n제목: ${news.title}\n링크: ${news.link}\n내용: ${news.content || news.description || '내용 없음'}\n`
        )).join('\n');

        const lastMsgIndex = apiMessages.length - 1;
        apiMessages[lastMsgIndex].content = `[참고 자료]\n${contextString}\n\n[질문]\n${input}`;
      }

      // 1. 초기 빈 메시지 추가 (스트리밍될 내용을 담을 공간)
      setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);

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
    <div className="chatbot-container">
      <div className="chatbot-header">
        <h3>AI Financial Assistant</h3>
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
      </div>
      <div className="chatbot-messages">
        {chatMessages.map((msg, index) => {
          // 스트리밍 시작 전(빈 메시지)인 경우 렌더링하지 않음 (로딩 버블과 중복 방지)
          if (msg.role === 'assistant' && !msg.content) return null;
          
          return (
            <div key={index} className={`message-bubble ${msg.role}`}>
              <div className="message-content">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
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
        <div ref={messagesEndRef} />
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
  );
};

export default ChatBot;
