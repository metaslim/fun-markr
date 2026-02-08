import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as webllm from '@mlc-ai/web-llm';
import { useContextStore } from '../stores/contextStore';
import { useAssistantStore, MODEL_DISPLAY } from '../stores/assistantStore';
import { listTests } from '../services/api';
import { getActionsPrompt, getActionLabel, executeAction } from '../lib/tools';

interface Message {
  role: 'user' | 'assistant';
  content: string;        // What to display to user
  fullContent?: string;   // What to send to LLM (includes action tag if any)
}

const SYSTEM_PROMPT = `You help teachers analyze test results. You MUST use actions to fetch data.

{context}

## ACTIONS
{actions}

## RULES
1. ALWAYS use actions to get data. NEVER make up data.
2. Keep intro SHORT (1 sentence max), then action tag.
3. For actions needing a test ID:
   - If "Current Test" is shown above → USE THAT ID
   - If user says a test number → use that
   - Otherwise → use [ACTION:listTests] to show available tests
4. ONLY greetings ("hi", "hello") get text-only responses.

## ACTION MAPPING
- "struggling/failing/need help" → [ACTION:getStrugglingStudents:ID]
- "top/best/highest" → [ACTION:getTopStudents:ID]
- "stats/details" → [ACTION:getTestStats:ID]
- "at risk" → [ACTION:findAtRiskStudents]
- "hardest" → [ACTION:getHardestTest]
- "easiest" → [ACTION:getEasiestTest]
- "overview" → [ACTION:getClassOverview]
- "passing" → [ACTION:getPassingStudents:ID]
- "perfect/100%" → [ACTION:getPerfectScores:ID]
- Student name → [ACTION:searchStudent:NAME]

## EXAMPLES
If Current Test is 1234:
  "show top students" → "Here are the top performers! [ACTION:getTopStudents:1234]"
If NO Current Test:
  "who is struggling?" → "Let me show you the tests. [ACTION:listTests]"
User specifies test:
  "struggling on test 5678" → "Checking test 5678. [ACTION:getStrugglingStudents:5678]"`;

const getSuggestionsPrompt = (availableTestIds: string[]) => `Based on the data shown, suggest 2-3 follow-up questions.

Available test IDs: ${availableTestIds.join(', ') || 'none'}

You can ONLY suggest questions that use these actions:
- Show top students in test [ID]
- Show struggling students in test [ID]
- Show test [ID] stats
- Find at-risk students (failing multiple tests)
- Show hardest test
- Show easiest test
- Class overview
- Show passing students in test [ID]
- Show perfect scores in test [ID]
- Look up student [NAME]
- Compare [STUDENT] to class average
- List all tests
- List all students

Return ONLY a JSON array of 2-3 short questions.
Use the actual test IDs from "Available test IDs" above, and student names from the data.`;

interface ParsedResponse {
  message: string;
  action?: string;
  suggestions: string[];
}

/**
 * Parse markdown response from LLM. Extracts actions and suggestions.
 */
const parseResponse = (text: string): ParsedResponse => {
  // Extract action tag [ACTION:...]
  const actionMatch = text.match(/\[ACTION:([^\]]+)\]/);
  const action = actionMatch ? actionMatch[1] : undefined;

  // Extract suggestions from HTML comment: <!-- suggestions: ["a", "b"] -->
  let suggestions: string[] = [];
  const suggestionsMatch = text.match(/<!--\s*suggestions:\s*(\[[\s\S]*?\])\s*-->/);
  if (suggestionsMatch) {
    try {
      const parsed = JSON.parse(suggestionsMatch[1]);
      if (Array.isArray(parsed)) {
        suggestions = parsed.filter(s => typeof s === 'string' && s.trim());
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Remove action tags and suggestion comments from message
  const message = text
    .replace(/\[ACTION:[^\]]+\]/g, '')
    .replace(/<!--\s*suggestions:[\s\S]*?-->/g, '')
    .trim();

  return { message, action, suggestions };
};

// Thinking indicator component
const ThinkingIndicator = ({ step, action }: { step: 'thinking' | 'action'; action?: string }) => {
  const actionLabel = action ? getActionLabel(action.split(':')[0]) : '';

  return (
    <div className="flex flex-col gap-2 text-gray-400 text-sm">
      <div className="flex items-center gap-2">
        {step === 'thinking' ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        <span className={step === 'action' ? 'text-gray-500' : ''}>Thinking</span>
      </div>
      {step === 'action' && (
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>{actionLabel}</span>
        </div>
      )}
    </div>
  );
};

// Follow-up suggestions component
const FollowUpSuggestions = ({
  suggestions,
  onSelect,
  disabled
}: {
  suggestions: { text: string }[];
  onSelect: (text: string) => void;
  disabled: boolean;
}) => {
  if (suggestions.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-1">
      {suggestions.map((suggestion, i) => (
        <button
          key={i}
          onClick={() => onSelect(suggestion.text)}
          disabled={disabled}
          className="flex items-center gap-2 py-1.5 text-left text-sm text-gray-500 hover:text-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <span>{suggestion.text}</span>
        </button>
      ))}
    </div>
  );
};

// Collapse icon
const CollapseIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
);


export function AssistantPanel() {
  const { isOpen, close, engine, isModelLoaded, isModelLoading, loadingStatus, loadingProgress, preloadModel } = useAssistantStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'thinking' | 'action' | null>(null);
  const [currentAction, setCurrentAction] = useState<string | undefined>();
  const [lastSuggestions, setLastSuggestions] = useState<string[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const getContextForAI = useContextStore((state) => state.getContextForAI);
  const clearContext = useContextStore((state) => state.clearContext);
  const setCurrentPage = useContextStore((state) => state.setCurrentPage);
  const setAvailableTests = useContextStore((state) => state.setAvailableTests);
  const availableTests = useContextStore((state) => state.availableTests);
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

  // Load tests when panel opens, and trigger model load if not already loading
  useEffect(() => {
    if (isOpen) {
      // Load available tests
      listTests()
        .then((res) => setAvailableTests(res.tests))
        .catch(() => {});

      // Trigger model load if not loaded/loading (backup in case Layout preload didn't start)
      if (!isModelLoaded && !isModelLoading) {
        preloadModel();
      }
    }
  }, [isOpen, setAvailableTests, isModelLoaded, isModelLoading, preloadModel]);


  // Focus input after model loads
  useEffect(() => {
    if (isModelLoaded && isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isModelLoaded, isOpen]);

  const scrollToBottom = () => {
    messagesContainerRef.current?.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, loadingStep]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !engine) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setLoadingStep('thinking');
    setCurrentAction(undefined);
    setLastSuggestions([]);

    try {
      const context = getContextForAI();
      const systemPrompt = SYSTEM_PROMPT
        .replace('{context}', context)
        .replace('{actions}', getActionsPrompt());

      const conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.fullContent || m.content })),
        { role: 'user', content: userMessage },
      ];

      const response = await getLLMResponse(engine, conversationHistory);
      console.log('[Assistant] LLM response:', response);
      const parsed = parseResponse(response);
      console.log('[Assistant] Parsed action:', parsed.action);

      // If there's an action, execute it and display result with LLM's intro text
      if (parsed.action) {
        setLoadingStep('action');
        setCurrentAction(parsed.action);
        const actionResult = await executeAction(parsed.action, navigate);

        // LLM intro text - strip any hallucinated data (keep only first sentence)
        let introText = parsed.message.trim();

        // Cut at first newline or data pattern - LLM should only say a brief intro
        const cutIndex = introText.search(/\n|Result:|#{1,3}\s|\d+\.\s+\*\*|\d+\.\s+\[/);
        if (cutIndex > 0) {
          introText = introText.slice(0, cutIndex).trim();
        } else if (cutIndex === 0) {
          introText = '';
        }

        const fullMessage = introText
          ? `${introText}\n\n${actionResult.message}`
          : actionResult.message;

        // Update the last assistant message (added by streaming) with action result
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
            newMessages[newMessages.length - 1] = {
              role: 'assistant',
              content: fullMessage,
              fullContent: `[ACTION:${parsed.action}]\nResult: ${actionResult.message}`,
            };
          }
          return newMessages;
        });

        // Get follow-up suggestions from LLM
        await generateSuggestions(actionResult.message);
      } else {
        // For non-action responses, also generate suggestions
        await generateSuggestions(parsed.message);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }]);
    } finally {
      setIsLoading(false);
      setLoadingStep(null);
      setCurrentAction(undefined);
    }
  };

  const getLLMResponse = async (
    eng: webllm.MLCEngineInterface,
    msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<string> => {
    // Add empty assistant message for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    let fullResponse = '';

    const stream = await eng.chat.completions.create({
      messages: msgs,
      temperature: 0.3,
      max_tokens: 500,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      fullResponse += delta;

      // Update message with streamed content (hide action tags while streaming)
      const displayContent = fullResponse.replace(/\[ACTION:[^\]]*\]/g, '').trim();
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
          newMessages[newMessages.length - 1] = { role: 'assistant', content: displayContent };
        }
        return newMessages;
      });
    }

    return fullResponse;
  };

  const generateSuggestions = async (content: string) => {
    if (!engine) {
      setLastSuggestions([]);
      return;
    }
    try {
      const testIds = availableTests.map(t => t.test_id);
      const suggestionsResponse = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: getSuggestionsPrompt(testIds) },
          { role: 'user', content },
        ],
        temperature: 0.5,
        max_tokens: 150,
        stream: false,
      });
      const suggestionsText = suggestionsResponse.choices[0]?.message?.content || '[]';
      // Try to extract JSON array from response
      const jsonMatch = suggestionsText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]);
        if (Array.isArray(suggestions)) {
          setLastSuggestions(suggestions.slice(0, 3));
          return;
        }
      }
      setLastSuggestions([]);
    } catch {
      setLastSuggestions([]);
    }
  };

  const handleClear = async () => {
    setMessages([]);
    setLastSuggestions([]);
    clearContext();
    if (engine) {
      await engine.resetChat();
    }
  };

  const handleNavigate = (route: string) => {
    navigate(route);
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  // Convert suggestions to the format expected by FollowUpSuggestions
  const displaySuggestions = messages.length > 0 && messages[messages.length - 1].role === 'assistant'
    ? lastSuggestions.map(s => ({ text: s }))
    : getSuggestedQuestions().slice(0, 3).map(q => ({ text: q.text }));

  // Use portal to render outside the main layout hierarchy
  return createPortal(
    <>
      {/* Shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Overlay for mobile */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={close}
      />

      {/* Panel - fixed position overlay, does not affect main content layout */}
      <aside
        className={`fixed top-0 right-0 h-screen bg-white border-l border-gray-200 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: 'min(28rem, 100vw)' }}
      >
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">AI Assistant</h2>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                disabled={isLoading}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                title="New chat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            <button
              onClick={close}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              title="Close"
            >
              <CollapseIcon />
            </button>
          </div>
        </header>

        {/* Content */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-6 py-4"
        >
          {!isModelLoaded ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <style>{`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>

              {/* AI Loading Icon */}
              <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 2L8.5 6.5L13 8L8.5 9.5L7 14L5.5 9.5L1 8L5.5 6.5L7 2Z" />
                  <path d="M16 6L17.5 10.5L22 12L17.5 13.5L16 18L14.5 13.5L10 12L14.5 10.5L16 6Z" />
                  <path d="M8 14L9 17L12 18L9 19L8 22L7 19L4 18L7 17L8 14Z" />
                </svg>
              </div>

              {/* Status panel */}
              <div className="bg-white rounded-lg px-5 py-3 border-2 border-gray-300 text-center min-w-[200px]">
                <div className="text-sm font-bold text-gray-900 mb-2">
                  {loadingStatus || `Initializing ${MODEL_DISPLAY}...`}
                </div>
                {/* Power bar */}
                {loadingProgress > 0 && loadingProgress < 1 && (
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
                    <div
                      className="h-full rounded-sm transition-all duration-300"
                      style={{
                        width: `${Math.round(loadingProgress * 100)}%`,
                        background: 'linear-gradient(90deg, #10b981, #059669)',
                      }}
                    />
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400 mt-4">Requires WebGPU support</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Hi there!</h3>
                  <p className="text-gray-500 mb-6">I can help you navigate and understand your test data.</p>
                  <div className="space-y-2">
                    {getSuggestedQuestions().map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(q.query)}
                        className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 text-left hover:border-emerald-300 hover:bg-emerald-50 transition-all"
                      >
                        {q.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i}>
                  {msg.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] px-4 py-2 bg-gray-100 text-gray-900 rounded-2xl">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {msg.content ? (
                        <div className="prose prose-sm prose-gray max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ href, children }) => {
                                if (href?.startsWith('/')) {
                                  return (
                                    <button
                                      onClick={() => handleNavigate(href)}
                                      className="text-emerald-600 hover:text-emerald-700 underline underline-offset-2 decoration-emerald-300 hover:decoration-emerald-500 transition-colors"
                                    >
                                      {children}
                                    </button>
                                  );
                                }
                                return <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">{children}</a>;
                              },
                              code: ({ children }) => (
                                <code className="px-1.5 py-0.5 bg-gray-100 rounded text-emerald-600 text-xs font-mono">{children}</code>
                              ),
                              p: ({ children }) => <p className="mb-3 last:mb-0 text-gray-700 leading-relaxed">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 text-gray-700">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-gray-700">{children}</ol>,
                              table: ({ children }) => (
                                <div className="overflow-x-auto my-3">
                                  <table className="min-w-full text-sm border-collapse">{children}</table>
                                </div>
                              ),
                              thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
                              tbody: ({ children }) => <tbody className="divide-y divide-gray-200">{children}</tbody>,
                              tr: ({ children }) => <tr className="hover:bg-gray-50">{children}</tr>,
                              th: ({ children }) => (
                                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-300">{children}</th>
                              ),
                              td: ({ children }) => (
                                <td className="px-3 py-2 text-gray-600 border-b border-gray-100 [&_button]:inline-flex">{children}</td>
                              ),
                              h1: ({ children }) => <h1 className="text-lg font-bold mb-3 text-gray-900">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-base font-bold mb-2 text-gray-900">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-sm font-semibold mb-2 text-gray-900">{children}</h3>,
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-3 border-emerald-300 pl-4 my-3 text-gray-600 italic">{children}</blockquote>
                              ),
                              hr: () => <hr className="my-4 border-gray-200" />,
                              strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                              em: ({ children }) => <em className="italic">{children}</em>,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <ThinkingIndicator step={loadingStep || 'thinking'} action={currentAction} />
                      )}

                      {/* Follow-up suggestions after last assistant message */}
                      {msg.content && i === messages.length - 1 && !isLoading && (
                        <FollowUpSuggestions
                          suggestions={displaySuggestions}
                          onSelect={handleSuggestionClick}
                          disabled={isLoading}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}

              {loadingStep && (messages.length === 0 || messages[messages.length - 1].content !== '') && (
                <ThinkingIndicator step={loadingStep} action={currentAction} />
              )}
            </div>
          )}
        </div>

        {/* Input */}
        {isModelLoaded && (
          <div className="p-4 border-t border-gray-200 bg-white">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your test data..."
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
            <p className="text-xs text-gray-400 text-center mt-2">
              AI responses may not be accurate. Verify important information.
            </p>
          </div>
        )}
      </aside>
    </>,
    document.body
  );
}
