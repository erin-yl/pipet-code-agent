import * as vscode from 'vscode';

import { GoogleGenerativeAI } from '@google/generative-ai';

// Provide instructions for Gemini
const CODE_LABEL = 'Here is the code:';
const COMMENT_LABEL = 'Here is a good comment:';
const PROMPT = `
A good code comment explains intent without restating obvious code. It clarifies 
"why," highlights hidden logic, and explains magic values or non-obvious behavior. 
Write a comment for the following code within one sentence. Below are examples of 
high-quality comments.

${CODE_LABEL}
print(f" \\033[33m {msg}\\033[00m", file=sys.stderr)
${COMMENT_LABEL}
Use terminal codes to print color output to console.

${CODE_LABEL}
to_delete = set(data.keys()) - frozenset(keep)
for key in to_delete:
  del data[key]
${COMMENT_LABEL}
Modify \`data\` to remove any entry not specified in the \`keep\` list.

${CODE_LABEL}
lines[text_range.start_line - 1:text_range.end_line - 1] = [repl.new_content]
${COMMENT_LABEL}
Replace text from \`lines\` with \`new_content\`, noting that array indices 
are offset 1 from line numbers.

${CODE_LABEL}
api_key = os.getenv("GOOGLE_API_KEY")
${COMMENT_LABEL}
Attempt to load the API key from the environment.`;


export async function generateComment() {
  vscode.window.showInformationMessage('Generating comment...');

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
    ${COMMENT_LABEL}
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

  const contentBlock = `${padding}/*\n${padding}Code comment: (generated)\n\n${wrappedContent.trimEnd()}\n${padding}*/\n\n`;
  
  editor.edit((editBuilder) => {
    editBuilder.insert(selection.start, contentBlock);
  });
}