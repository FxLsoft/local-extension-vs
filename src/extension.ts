// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { checkWord } from './core/CheckWord';
import { registerCommand } from './core/Command';
import { initDicData } from './core/LocalDicData';
import { WordHoverProvider } from './core/WordHoverProvider';

export function activate(context: vscode.ExtensionContext) {
	vscode.window.showInformationMessage('local-extension init');
	vscode.languages.registerHoverProvider(['vue', 'html', 'javascript', 'typescript', 'typescriptreact', 'javascriptreact'], new WordHoverProvider());
	
	const activeEditor = vscode.window.activeTextEditor;
	if (activeEditor) {
		checkWord();
	}
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor) {
				checkWord();
			}
		}, null)
	);
	// 当 文档发生变化时 的时候重新检测当前文档中
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(event => {
			if (activeEditor && event.document === activeEditor.document) {
				checkWord();
			}
		}, null)
	);
	initDicData();
	registerCommand();
}

// this method is called when your extension is deactivated
export function deactivate() {

}
