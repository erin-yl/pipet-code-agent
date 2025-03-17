import * as vscode from 'vscode';
import { generateComment } from './comments';
import { generateReview } from './review';
import { generateName } from './name';
import { generateSummary } from './summary';

export function activate(context: vscode.ExtensionContext) {
  vscode.commands.registerCommand('pipet-code-agent.commentCode', generateComment);
  vscode.commands.registerCommand('pipet-code-agent.reviewCode', generateReview);
  vscode.commands.registerCommand('pipet-code-agent.nameFunction', generateName);
  vscode.commands.registerCommand('pipet-code-agent.summarizeCode', generateSummary);
}

export function deactivate() { }