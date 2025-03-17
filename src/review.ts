import * as vscode from 'vscode';
import { GoogleGenerativeAI } from '@google/generative-ai';
const CODE_LABEL = 'Here is the code:';
const REVIEW_LABEL = 'Here is the review:';
const PROMPT = `
Review the following code. Identify critical bugs (e.g., syntax errors, crashes, 
performance issues) and suggest improvements (e.g., reducing complexity, removing 
duplicates, improving readability). Limit each point to two sentences or less, 
focusing on meaningful issues.

${CODE_LABEL}
for i in x:
    pint(f"Iteration {i} provides this {x**2}.")
${REVIEW_LABEL}
The command \`print\` is spelled incorrectly.

${CODE_LABEL}
height = [1, 2, 3, 4, 5]
w = [6, 7, 8, 9, 10]
${REVIEW_LABEL}
The variable name \`w\` seems vague. Did you mean \`width\` or \`weight\`?

${CODE_LABEL}
while i < 0:
  thrice = i * 3
  thrice = i * 3
  twice = i * 2
${REVIEW_LABEL}
There are duplicate lines of code in this control structure.

${CODE_LABEL}
const fixed_value = 128;
${REVIEW_LABEL}
Make sure constant names are in all capitals (FIXED_VALUE) for clarity.
`;

export async function generateReview() {
  vscode.window.showInformationMessage('Generating code review...');
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
    ${CODE_LABEL}
    ${selectedCode}
    ${REVIEW_LABEL}
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

  const contentBlock = `${padding}/*\n${padding}Code review: (generated)\n\n${wrappedContent.trimEnd()}\n${padding}*/\n\n`;
  
  editor.edit((editBuilder) => {
    editBuilder.insert(selection.start, contentBlock);
  });
}
