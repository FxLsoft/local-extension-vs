import * as vscode from 'vscode';
import { IgnoreWord_COMMAND } from './Constant';
import { findChineseText } from './FindWord';
import { IgnoreWordsDic } from './LocalDicData';

let timeout: any;
export function checkWord() {
    if (timeout) {
        clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
        doCheckWord();
    }, 500);
}

let preWordDecoration: vscode.TextEditorDecorationType;
let preDealWordDecoration: vscode.TextEditorDecorationType;
let preIgnoreDecoration: vscode.TextEditorDecorationType;

function doCheckWord() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return;
    }
    if (preWordDecoration) {
        activeEditor.setDecorations(preWordDecoration, []);
    }
    if (preDealWordDecoration) {
        activeEditor.setDecorations(preDealWordDecoration, []);
    }
    if (preIgnoreDecoration) {
        activeEditor.setDecorations(preIgnoreDecoration, []);
    }
    const currentFilename = activeEditor?.document.fileName;
    const wordDecoration = getWordDecoration();
    const dealWordDecoration = getDealWordDecoration();
    const ignoreWordDecoration = getIgnoreWordDecoration();
    const text = activeEditor.document.getText();
    const errorWords: vscode.DecorationOptions[] = [];
    const successWords: vscode.DecorationOptions[] = [];
    const ignoreWords: vscode.DecorationOptions[] = [];
    const findWords = findChineseText(text, currentFilename);
    findWords?.forEach((findWord: { range: vscode.Range; text: any; isTemplatePureString?: boolean; isVueAttr?: boolean; attr?: any; isString?: boolean; isVueJsx?: boolean; hasDeal?: boolean }) => {
        // 已经处理
        if (findWord.hasDeal) {
            successWords.push({
                range: findWord.range,
                hoverMessage: `🇨🇳 已翻译: ${findWord.text}`
            });
        } else if (IgnoreWordsDic.get(currentFilename)?.has(findWord.text)) {
            const command = vscode.Uri.parse(`command:${IgnoreWord_COMMAND}`, true);
            const args = {
                filename: currentFilename,
                word: findWord.text,
                type: 'delete'
            };
            const contents = new vscode.MarkdownString(`🐯 [取消忽略 ${findWord.text}](${command}?${encodeURIComponent(JSON.stringify(args))})`);
            contents.isTrusted = true;
            ignoreWords.push({
                range: findWord.range,
                hoverMessage: contents
            });
        } else {
            const command = vscode.Uri.parse(`command:${IgnoreWord_COMMAND}`, true);
            const args = {
                filename: currentFilename,
                word: findWord.text,
                type: 'add'
            };
            const contents = new vscode.MarkdownString(`🇬🇧 [忽略 ${findWord.text}](${command}?${encodeURIComponent(JSON.stringify(args))})`);
            contents.isTrusted = true;
            errorWords.push({
                range: findWord.range,
                hoverMessage: contents
            });
        }
    });
    preWordDecoration = wordDecoration;
    preDealWordDecoration = dealWordDecoration;
    preIgnoreDecoration = ignoreWordDecoration;
    activeEditor.setDecorations(wordDecoration, errorWords);
    activeEditor.setDecorations(dealWordDecoration, successWords);
    activeEditor.setDecorations(ignoreWordDecoration, ignoreWords);
}

function getWordDecoration() {
    if (preWordDecoration) return preWordDecoration;
    return vscode.window.createTextEditorDecorationType({
        borderWidth: '1px',
        borderStyle: 'dotted',
        borderColor: '#f40',
        overviewRulerColor: '#f40',
        overviewRulerLane: vscode.OverviewRulerLane.Right
    });
}

function getDealWordDecoration() {
    if (preDealWordDecoration) return preDealWordDecoration;
    return vscode.window.createTextEditorDecorationType({
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#628c44',
        color: '#b6f237',
        overviewRulerColor: '#b6f237',
        overviewRulerLane: vscode.OverviewRulerLane.Left
    });
}

function getIgnoreWordDecoration() {
    if (preIgnoreDecoration) return preIgnoreDecoration;
    return vscode.window.createTextEditorDecorationType({
        borderWidth: '1px',
        borderStyle: 'dotted',
        borderColor: '#fff',
        color: '#f7b905',
        overviewRulerColor: '#f7b905',
        overviewRulerLane: vscode.OverviewRulerLane.Left
    });
}