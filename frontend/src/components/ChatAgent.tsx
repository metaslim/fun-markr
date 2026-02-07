import { useState, useRef, useEffect } from 'react';
import { initLLM, isLLMReady, streamChat, resetChat } from '../services/llm';
import { useChatStore } from '../stores/chatStore';
import { useContextStore } from '../stores/contextStore';

export function ChatAgent() {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [initProgress, setInitProgress] = useState<{ text: string; progress: number } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, addMessage, setLoading, clearMessages } = useChatStore();
  const clearContext = useContextStore((state) => state.clearContext);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInit = async () => {
    if (isInitialized || isLLMReady()) {
      setIsInitialized(true);
      return;
    }

    try {
      await initLLM((progress) => {
        setInitProgress(progress);
      });
      setIsInitialized(true);
      setInitProgress(null);
    } catch (err) {
      console.error('Failed to init LLM:', err);
      setInitProgress({ text: 'Failed to load model', progress: 0 });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !isInitialized) return;

    const userMessage = input.trim();
    setInput('');

    addMessage({ role: 'user', content: userMessage });
    setLoading(true);

    try {
      let response = '';
      addMessage({ role: 'assistant', content: '' });

      await streamChat(userMessage, (chunk) => {
        response += chunk;
        // Update the last message
        useChatStore.setState((state) => {
          const newMessages = [...state.messages];
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: response,
          };
          return { messages: newMessages };
        });
      });
    } catch (err) {
      addMessage({
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    clearMessages();
    clearContext();
    await resetChat();
  };

  if (!isOpen) {
    return (
      <button
        className="chat-toggle"
        onClick={() => {
          setIsOpen(true);
          handleInit();
        }}
      >
        AI Assistant
      </button>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span>AI Assistant</span>
        <div>
          <button onClick={handleClear} className="chat-btn">Clear</button>
          <button onClick={() => setIsOpen(false)} className="chat-btn">×</button>
        </div>
      </div>

      {!isInitialized && initProgress && (
        <div className="chat-init">
          <p>{initProgress.text}</p>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${initProgress.progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {!isInitialized && !initProgress && (
        <div className="chat-init">
          <p>Click to load AI model (requires WebGPU)</p>
          <button onClick={handleInit} className="btn">Load Model</button>
        </div>
      )}

      {isInitialized && (
        <>
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <p>Hi! I can help you understand your test data.</p>
                <p>Try asking:</p>
                <ul>
                  <li>"What's the average score for test 9863?"</li>
                  <li>"How do I import new results?"</li>
                  <li>"Compare the tests I've viewed"</li>
                </ul>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role}`}>
                <div className="chat-bubble">{msg.content}</div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.content === '' && (
              <div className="chat-message assistant">
                <div className="chat-bubble typing">...</div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="chat-input-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your test data..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !input.trim()}>
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
