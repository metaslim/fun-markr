export interface ActionResult {
  message: string;
  suggestions: string[];
}

export interface Tool {
  name: string;
  description: string;
  loadingLabel: string;
  execute: (arg: string, navigate: (path: string) => void) => Promise<ActionResult>;
}
