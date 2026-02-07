import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as webllm from '@mlc-ai/web-llm';
import ReactMarkdown from 'react-markdown';
import { useContextStore } from '../stores/contextStore';
import { listTests, getAggregate, healthCheck, getStudent, getStudentTestResult, getTestStudents, listStudents } from '../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const MODEL_ID = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
const MODEL_DISPLAY = 'Llama 3.2 3B';

const SYSTEM_PROMPT = `You help users with the Markr test dashboard. Be brief and helpful.

{context}

## AVAILABLE FUNCTIONS
You can call these functions to get live data. Use format: [CALL:function_name:argument]

Tests:
- [CALL:getTest:TEST_ID] - Get test stats (mean, count, percentiles)
- [CALL:listTests:] - List all tests with summaries
- [CALL:getTestStudents:TEST_ID] - List all students in a test with scores

Students:
- [CALL:listStudents:] - List all students
- [CALL:getStudent:STUDENT_NUMBER] - Get student's all test results
- [CALL:getStudentResult:STUDENT_NUMBER,TEST_ID] - Get specific result

System:
- [CALL:checkHealth:] - Check API status

IMPORTANT: ALWAYS call a function when user asks about data! Call first, then explain results.

Examples:
- "How did student 002299 do?" → [CALL:getStudent:002299]
- "Who are the top students in test 9863?" → [CALL:getTestStudents:9863]
- "How many students are there?" → [CALL:listStudents:]

## NAVIGATION LINKS
Use [[/path]] to create clickable links:
- [[/tests]] - all tests
- [[/tests/9863]] - specific test
- [[/tests/9863/students]] - students in test
- [[/students]] - all students
- [[/students/002299]] - specific student
- [[/import]] - import page

Always suggest relevant links after answering! Example: "View details at [[/students/002299]]"

Be concise but always provide actionable next steps.`;


export function ChatAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [engine, setEngine] = useState<webllm.MLCEngineInterface | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const getContextForAI = useContextStore((state) => state.getContextForAI);
  const clearContext = useContextStore((state) => state.clearContext);
  const setCurrentPage = useContextStore((state) => state.setCurrentPage);
  const setAvailableTests = useContextStore((state) => state.setAvailableTests);
  const getSuggestedQuestions = useContextStore((state) => state.getSuggestedQuestions);

  // Update current page when location changes
  useEffect(() => {
    const pathToTitle: Record<string, string> = {
      '/': 'Dashboard',
      '/import': 'Import Results',
    };
    const title = pathToTitle[location.pathname] ||
      (location.pathname.startsWith('/tests/') ? `Test ${location.pathname.split('/')[2]}` : 'Page');
    setCurrentPage(location.pathname, title);
  }, [location.pathname, setCurrentPage]);

  // Load available tests when chat opens
  useEffect(() => {
    if (isOpen) {
      listTests()
        .then((res) => setAvailableTests(res.tests))
        .catch(() => {}); // Silently fail if API unavailable
    }
  }, [isOpen, setAvailableTests]);

  const scrollToBottom = () => {
    messagesContainerRef.current?.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const initModel = async () => {
    try {
      setLoadingStatus(`Initializing ${MODEL_DISPLAY}...`);

      const newEngine = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (progress: webllm.InitProgressReport) => {
          if (progress.progress !== undefined) {
            const isDownloading = progress.text?.toLowerCase().includes('download') ||
                                  progress.text?.toLowerCase().includes('fetch');
            const statusText = isDownloading ? 'Downloading' : 'Loading';
            setLoadingStatus(`${statusText} ${MODEL_DISPLAY}: ${Math.round(progress.progress * 100)}%`);
          }
        },
      });

      setEngine(newEngine);
      setIsModelLoaded(true);
      setLoadingStatus('');
    } catch (error) {
      console.error('Failed to initialize LLM:', error);
      setLoadingStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleOpen = async () => {
    setIsOpen(true);
    if (!isModelLoaded && !engine) {
      await initModel();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !engine) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const context = getContextForAI();
      const systemPrompt = SYSTEM_PROMPT.replace('{context}', context);

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      // Build conversation history
      const conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: userMessage },
      ];

      // First LLM call
      let response = await streamResponse(engine, conversationHistory);

      // Check for function calls and execute them (max 3 iterations)
      let iterations = 0;
      while (iterations < 3) {
        const { finalResponse, hadFunctionCall } = await processResponse(response);

        if (!hadFunctionCall) break;

        // Show that we're fetching data
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { role: 'assistant', content: '🔍 Fetching data...' };
          return newMessages;
        });

        // Add function result to conversation and get new response
        conversationHistory.push({ role: 'assistant', content: response });
        conversationHistory.push({ role: 'user', content: `Function result: ${finalResponse}. Now provide a helpful response to the user based on this data.` });

        response = await streamResponse(engine, conversationHistory);
        iterations++;
      }

      // Final response is already set by streamResponse
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to stream LLM response
  const streamResponse = async (
    eng: webllm.MLCEngineInterface,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<string> => {
    const stream = await eng.chat.completions.create({
      messages,
      temperature: 0.3,
      max_tokens: 300,
      stream: true,
    });

    let response = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        response += content;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { role: 'assistant', content: response };
          return newMessages;
        });
      }
    }
    return response;
  };

  const handleClear = async () => {
    setMessages([]);
    clearContext();
    if (engine) {
      await engine.resetChat();
    }
  };

  const handleNavigate = (route: string) => {
    navigate(route);
    setIsOpen(false);
  };

  // Execute function calls from LLM
  const executeFunctionCall = async (call: string): Promise<string> => {
    const match = call.match(/\[CALL:(\w+):([^\]]*)\]/);
    if (!match) return '';

    const [, funcName, arg] = match;

    try {
      switch (funcName) {
        case 'getTest': {
          const testId = arg.trim();
          if (!testId) return 'Error: No test ID provided';
          const data = await getAggregate(testId);
          return `Test ${testId}: ${data.count} students, mean: ${data.mean.toFixed(1)}%, min: ${data.min.toFixed(1)}%, max: ${data.max.toFixed(1)}%, median: ${data.p50.toFixed(1)}%, std dev: ${data.stddev.toFixed(1)}, P25: ${data.p25.toFixed(1)}%, P75: ${data.p75.toFixed(1)}%`;
        }
        case 'listTests': {
          const result = await listTests();
          if (result.tests.length === 0) return 'No tests available. Import some test results first.';
          return `Available tests: ${result.tests.map(t => `Test ${t.test_id} (${t.count} students, ${t.mean.toFixed(1)}% avg)`).join(', ')}`;
        }
        case 'getTestStudents': {
          const testId = arg.trim();
          if (!testId) return 'Error: No test ID provided';
          const result = await getTestStudents(testId);
          const top5 = result.students.slice(0, 5);
          const bottom5 = result.students.slice(-5).reverse();
          const formatStudent = (s: typeof result.students[0]) => `${s.student_name || s.student_number} (${s.percentage}%)`;
          return `Test ${testId} has ${result.count} students. Top 5: ${top5.map(formatStudent).join(', ')}. Bottom 5: ${bottom5.map(formatStudent).join(', ')}`;
        }
        case 'listStudents': {
          const result = await listStudents();
          if (result.students.length === 0) return 'No students found. Import some test results first.';
          const sample = result.students.slice(0, 10);
          return `Total: ${result.count} students. First 10: ${sample.map(s => `${s.name || 'Unknown'} (${s.student_number})`).join(', ')}${result.count > 10 ? '...' : ''}`;
        }
        case 'getStudent': {
          const studentNum = arg.trim();
          if (!studentNum) return 'Error: No student number provided';
          const result = await getStudent(studentNum);
          const studentName = result.results[0]?.student_name || studentNum;
          return `${studentName} (${studentNum}) has ${result.count} test(s): ${result.results.map(r => `Test ${r.test_id}: ${r.marks_obtained}/${r.marks_available} (${r.percentage}%)`).join(', ')}`;
        }
        case 'getStudentResult': {
          const [studentNum, testId] = arg.split(',').map(s => s.trim());
          if (!studentNum || !testId) return 'Error: Need student number and test ID (format: STUDENT,TEST_ID)';
          const result = await getStudentTestResult(studentNum, testId);
          return `Student ${studentNum} on Test ${testId}: ${result.marks_obtained}/${result.marks_available} = ${result.percentage}%`;
        }
        case 'checkHealth': {
          const health = await healthCheck();
          return `API status: ${health.status}`;
        }
        default:
          return `Unknown function: ${funcName}`;
      }
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : 'Failed to execute function'}`;
    }
  };

  // Check if response contains function calls and execute them
  const processResponse = async (response: string): Promise<{ finalResponse: string; hadFunctionCall: boolean }> => {
    const functionCallRegex = /\[CALL:\w+:[^\]]*\]/g;
    const calls = response.match(functionCallRegex);

    if (!calls || calls.length === 0) {
      return { finalResponse: response, hadFunctionCall: false };
    }

    // Execute all function calls
    const results: string[] = [];
    for (const call of calls) {
      const result = await executeFunctionCall(call);
      results.push(result);
    }

    return {
      finalResponse: results.join('\n'),
      hadFunctionCall: true,
    };
  };

  // Closed state - Floating button
  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        {/* Speech bubble */}
        <div
          onClick={handleOpen}
          className="absolute bottom-16 right-0 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-lg cursor-pointer animate-bounce"
          style={{ animationDuration: '2s' }}
        >
          <div className="text-sm font-medium text-gray-700">Need help?</div>
          <div className="absolute bottom-0 right-6 w-3 h-3 bg-white border-r border-b border-gray-200 transform rotate-45 translate-y-1.5" />
        </div>

        {/* Avatar button */}
        <button
          onClick={handleOpen}
          className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-2xl"
          title="AI Assistant"
        >
          💬
        </button>
      </div>
    );
  }

  // Open state - Chat panel
  return (
    <div className="fixed bottom-6 right-6 w-96 h-[32rem] bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-emerald-500 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">💬</span>
          <span className="font-semibold text-white">Markr Assistant</span>
        </div>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-lg transition-colors"
          >
            ×
          </button>
        </div>
      </div>

      {/* Messages / Loading */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"
      >
        {!isModelLoaded ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            {loadingStatus ? (
              <>
                <div className="w-12 h-12 border-3 border-gray-200 border-t-emerald-500 rounded-full animate-spin mb-4" />
                <div className="text-gray-600 text-sm mb-2">{loadingStatus}</div>
                <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{
                      width: loadingStatus.includes('%')
                        ? loadingStatus.match(/(\d+)%/)?.[1] + '%'
                        : '0%',
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl mb-4">💬</div>
                <p className="text-gray-600 mb-2">Load local AI model to chat</p>
                <p className="text-xs text-gray-400 mb-4">Requires WebGPU support</p>
                <button
                  onClick={initModel}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
                >
                  Load Model
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {messages.length === 0 && (
              <div className="text-center py-4">
                <p className="text-gray-600 mb-4">Hi! I can help you navigate and understand your test data.</p>
                <div className="space-y-2">
                  {getSuggestedQuestions().map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(q.query)}
                      className="block w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-700 text-sm text-left hover:border-emerald-300 hover:bg-emerald-50 transition-all"
                    >
                      {q.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                <div
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-emerald-500 text-white rounded-br-md'
                        : 'bg-white border border-gray-200 text-gray-700 rounded-bl-md'
                    }`}
                  >
                    {msg.content ? (
                      msg.role === 'assistant' ? (
                        // Render markdown with custom link handling
                        <div className="prose prose-sm prose-gray max-w-none">
                          <ReactMarkdown
                            components={{
                              // Custom link renderer for navigation
                              a: ({ href, children }) => {
                                // Check if it's an internal route
                                if (href?.startsWith('/')) {
                                  return (
                                    <button
                                      onClick={() => handleNavigate(href)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg font-medium hover:bg-emerald-200 transition-colors no-underline"
                                    >
                                      {children}
                                      <span className="text-xs">→</span>
                                    </button>
                                  );
                                }
                                return <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">{children}</a>;
                              },
                              // Style code blocks
                              code: ({ children }) => (
                                <code className="px-1.5 py-0.5 bg-gray-100 rounded text-emerald-600 text-xs font-mono">{children}</code>
                              ),
                              // Style paragraphs
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              // Style lists
                              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                            }}
                          >
                            {/* Convert [[route]] syntax to markdown links */}
                            {msg.content.replace(/\[\[(\/[^\]]+)\]\]/g, '[$1]($1)')}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )
                    ) : (
                      <span className="flex gap-1">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )}
                  </div>
                </div>

                {/* Follow-up suggestions after last assistant message */}
                {msg.role === 'assistant' && msg.content && i === messages.length - 1 && !isLoading && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getSuggestedQuestions().slice(0, 3).map((q, j) => (
                      <button
                        key={j}
                        onClick={() => setInput(q.query)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-emerald-100 text-gray-600 hover:text-emerald-700 text-xs rounded-full transition-colors"
                      >
                        {q.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Input */}
      {isModelLoaded && (
        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 flex gap-2 bg-white">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your test data..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-medium transition-colors"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
