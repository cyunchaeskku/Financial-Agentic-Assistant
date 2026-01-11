import React, { useState, useRef, useEffect } from 'react';

const ChatBot = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '안녕하세요! 금융 데이터 분석 보조 에이전트입니다. 궁금하신 점을 물어보세요.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 1. 초기 빈 메시지 추가 (스트리밍될 내용을 담을 공간)
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content }))
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
        setMessages(prev => {
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
      setMessages(prev => {
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
      </div>
      <div className="chatbot-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message-bubble ${msg.role}`}>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="message-bubble assistant">
            <div className="message-content loading">답변을 생성 중입니다...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form className="chatbot-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          전송
        </button>
      </form>
    </div>
  );
};

export default ChatBot;
