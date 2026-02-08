import type { Tool, ActionResult } from './types';
import { listTestsTool } from './listTests';
import { getTestTool } from './getTest';
import { getTopStudentsTool } from './getTopStudents';
import { getStrugglingStudentsTool } from './getStrugglingStudents';
import { listStudentsTool } from './listStudents';
import { getStudentTool } from './getStudent';
import { searchStudentTool } from './searchStudent';
import { getTestStatsTool } from './getTestStats';
import { findAtRiskStudentsTool } from './findAtRiskStudents';
import { getHardestTestTool } from './getHardestTest';
import { getEasiestTestTool } from './getEasiestTest';
import { getClassOverviewTool } from './getClassOverview';
import { compareStudentToClassTool } from './compareStudentToClass';
import { getPassingStudentsTool } from './getPassingStudents';
import { getPerfectScoresTool } from './getPerfectScores';

export type { Tool, ActionResult };

// Register all tools here
const TOOLS: Tool[] = [
  listTestsTool,
  getTestTool,
  getTopStudentsTool,
  getStrugglingStudentsTool,
  getPassingStudentsTool,
  getPerfectScoresTool,
  listStudentsTool,
  getStudentTool,
  searchStudentTool,
  getTestStatsTool,
  getClassOverviewTool,
  findAtRiskStudentsTool,
  getHardestTestTool,
  getEasiestTestTool,
  compareStudentToClassTool,
];

// Generate action list for system prompt
export const getActionsPrompt = (): string => {
  return TOOLS.map(t => t.description).join('\n');
};

// Get loading label for an action
export const getActionLabel = (actionName: string): string => {
  const tool = TOOLS.find(t => t.name === actionName);
  return tool?.loadingLabel || 'Getting data';
};

// Execute an action by name
export const executeAction = async (
  action: string,
  navigate: (path: string) => void
): Promise<ActionResult> => {
  const [funcName, ...args] = action.split(':');
  const arg = args.join(':');

  const tool = TOOLS.find(t => t.name === funcName);
  if (!tool) {
    return { message: `Unknown action: ${funcName}`, suggestions: [] };
  }

  try {
    return await tool.execute(arg, navigate);
  } catch (error) {
    return { message: `Error: ${error instanceof Error ? error.message : 'Failed'}`, suggestions: [] };
  }
};
