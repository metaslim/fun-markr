import { create } from 'zustand';
import * as webllm from '@mlc-ai/web-llm';

// Qwen 2.5 7B - better instruction following
const MODEL_ID = 'Qwen2.5-7B-Instruct-q4f16_1-MLC';
export const MODEL_DISPLAY = 'Qwen 2.5 7B';

interface AssistantState {
  isOpen: boolean;
  engine: webllm.MLCEngineInterface | null;
  isModelLoaded: boolean;
  isModelLoading: boolean;
  loadingStatus: string;
  loadingProgress: number;
  open: () => void;
  close: () => void;
  toggle: () => void;
  preloadModel: () => Promise<void>;
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  isOpen: false,
  engine: null,
  isModelLoaded: false,
  isModelLoading: false,
  loadingStatus: '',
  loadingProgress: 0,
  open: () => {
    set({ isOpen: true });
    // Lazy-load model on first open instead of on page load
    get().preloadModel();
  },
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  preloadModel: async () => {
    const { isModelLoaded, isModelLoading } = get();

    // Don't load if already loaded or currently loading
    if (isModelLoaded || isModelLoading) return;

    set({ isModelLoading: true, loadingStatus: `Initializing ${MODEL_DISPLAY}...` });

    try {
      const newEngine = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (progress: webllm.InitProgressReport) => {
          if (progress.progress !== undefined) {
            const isDownloading = progress.text?.toLowerCase().includes('download') ||
                                  progress.text?.toLowerCase().includes('fetch');
            const statusText = isDownloading ? 'Downloading' : 'Loading';
            set({
              loadingStatus: `${statusText} ${MODEL_DISPLAY}: ${Math.round(progress.progress * 100)}%`,
              loadingProgress: progress.progress,
            });
          }
        },
      });

      set({
        engine: newEngine,
        isModelLoaded: true,
        isModelLoading: false,
        loadingStatus: '',
        loadingProgress: 1,
      });
    } catch (error) {
      console.error('Failed to initialize LLM:', error);
      set({
        isModelLoading: false,
        loadingStatus: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  },
}));
