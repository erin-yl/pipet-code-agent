import * as vscode from 'vscode';

import { GoogleGenerativeAI } from '@google/generative-ai';

// Provide instructions for the AI language model
const PROMPT = `
Summarize the following code within three sentences. The summary should clearly 
and concisely state its purpose, functionality, and critical logic or features 
needed to understand it.`

export async function generateSummary() {
  vscode.window.showInformationMessage('Generating summary...');

  const modelName = vscode.workspace.getConfiguration().get<string>('google.gemini.textModel', 'models/gemini-2.0-flash');

  // Get API Key from local user configuration
  const apiKey = vscode.workspace.getConfiguration().get<string>('google.gemini.apiKey');
  if (!apiKey) {
    vscode.window.showErrorMessage('API key not configured. Check your settings.');
    return;
  }

  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({model: modelName});

  // Text selection
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    console.debug('Abandon: no open text editor.');
    return;
  }

  const selection = editor.selection;
  const selectedCode = editor.document.getText(selection);

  // Build the full prompt using the template.
  const fullPrompt = `
    ${PROMPT}
    ${selectedCode}
  `;

  const result = await model.generateContent(fullPrompt);
  const response = await result.response;
  const comment = response.text();  

  // Wrap text at 80 characters
  function wrapText(text: string, maxLength: number): string {
    return text.split('\n').map(line => {
      const words = line.split(' ');
      let wrappedLine = '';
      let currentLine = '';

      for (const word of words) {
        if (currentLine.length + word.length + 1 > maxLength) {
          wrappedLine += currentLine.trim() + '\n';
          currentLine = word + ' ';
        } else {
          currentLine += word + ' ';
        }
      }

      return wrappedLine ? wrappedLine.trim() + '\n' + currentLine.trim() : currentLine.trim();
    }).join('\n');
  }

  // Wrap and format the content
  const trimmed = selectedCode.trimStart();
  const padding = selectedCode.substring(0, selectedCode.length - trimmed.length);

  const wrappedContent = wrapText(comment, 80)
    .split('\n')
    .map(line => padding + line)
    .join('\n');

  const contentBlock = `${padding}/*\n${padding}Code summary: (generated)\n\n${wrappedContent.trimEnd()}\n${padding}*/\n\n`;
  
  editor.edit((editBuilder) => {
    editBuilder.insert(selection.start, contentBlock);
  });
}
