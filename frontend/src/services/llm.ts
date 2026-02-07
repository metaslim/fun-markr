import * as webllm from '@mlc-ai/web-llm';
import { useContextStore } from '../stores/contextStore';

let engine: webllm.MLCEngineInterface | null = null;
let isInitializing = false;

// SmolLM2 is smaller (~200MB) and faster than Llama-3.2-3B (~2GB)
// Good enough for simple Q&A about structured data
const MODEL_ID = 'SmolLM2-360M-Instruct-q4f16_1-MLC';

export type InitCallback = (progress: { text: string; progress: number }) => void;

export async function initLLM(onProgress?: InitCallback): Promise<void> {
  if (engine || isInitializing) return;

  isInitializing = true;

  try {
    engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (progress: webllm.InitProgressReport) => {
        onProgress?.({
          text: progress.text,
          progress: progress.progress,
        });
      },
    });
  } finally {
    isInitializing = false;
  }
}

export function isLLMReady(): boolean {
  return engine !== null;
}

export async function chat(userMessage: string): Promise<string> {
  if (!engine) {
    throw new Error('LLM not initialized. Call initLLM() first.');
  }

  const context = useContextStore.getState().getContextForAI();

  const systemPrompt = `You are a helpful assistant for the Markr test results dashboard. You help users understand their test data and navigate the application.

${context}

Instructions:
- Answer questions about the test data shown above
- Help users navigate to different pages (provide URLs like /tests/1234)
- Explain statistics (mean, percentiles, std dev)
- Suggest actions based on what the user wants to do
- Be concise and helpful
- If you don't have data for a specific test, suggest the user navigate to view it first`;

  const response = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content || 'No response generated.';
}

export async function streamChat(
  userMessage: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  if (!engine) {
    throw new Error('LLM not initialized. Call initLLM() first.');
  }

  const context = useContextStore.getState().getContextForAI();

  const systemPrompt = `You are a helpful assistant for the Markr test results dashboard. You help users understand their test data and navigate the application.

${context}

Instructions:
- Answer questions about the test data shown above
- Help users navigate to different pages (provide URLs like /tests/1234)
- Explain statistics (mean, percentiles, std dev)
- Suggest actions based on what the user wants to do
- Be concise and helpful
- If you don't have data for a specific test, suggest the user navigate to view it first`;

  const stream = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 500,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      onChunk(content);
    }
  }
}

export async function resetChat(): Promise<void> {
  if (engine) {
    await engine.resetChat();
  }
}
