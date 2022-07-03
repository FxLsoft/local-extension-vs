import * as vscode from 'vscode';
import { checkWord } from './CheckWord';
import { ExtractWord_COMMAND, ModuleStartFolder, SetLocaleModuleId_COMMAND } from './Constant';
import { dic, getDicByKey } from './LocalDicData';

const camelize = (str: string) => {
	str = (str || "").toLowerCase();
	str = str.replace(/[-_\s]+(\w)/g, function(match, c) {
		return c ? c.toUpperCase() : "";
	});
	str = str.replace(/\W/g, '');
	return str.replace(/^(\w)/, function(match, c: string) {
		return c ? c.toLowerCase() : "";
	});
};

const WORD_REG: RegExp = /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/]+)/gi;

/**
 * 获取选中的文字
 * @returns 
 */
export function getSelectedWords() {
    const words: {selection: vscode.Selection, word: string}[] = [];
    const activeEditor = vscode.window.activeTextEditor;
    activeEditor?.selections.forEach(selection => {
        const range = new vscode.Range(selection.start, selection.end);
        let selectWord = activeEditor.document.getText(range);
        selectWord = selectWord.trim().replace(/[\s]+/g, ' ').replace(/^[\"\'\`]{1}/, '').replace(/[\"\'\`]{1}$/, '').replace(/\"/g, '\"');
        words.push({selection, word: selectWord});
    });
    return words;
}

export function replaceSelectedWords(word: {selection: vscode.Selection, word: string, key: string}, moduleId?: string) {
    const activeEditor = vscode.window.activeTextEditor;
    const edit = new vscode.WorkspaceEdit();
    const range = new vscode.Range(word.selection.start, word.selection.end);
    let realWords = [`{{ $t('${word.key}') }}`, `$t('${word.key}')`, `this.$t('${word.key}')`, `t('${word.key}')`, `globalization.t('${word.key}')`];
    if (moduleId && (moduleId !== getCurrentModuleId())) {
        realWords = [`{{ $st('${moduleId}', '${word.key}') }}`, `$st('${moduleId}', '${word.key}')`, `this.$st('${moduleId}', '${word.key}')`, `{{ t('${moduleId}', '${word.key}') }}`, `globalization.st('${moduleId}', '${word.key}')`];
    } 
    if (/<[^>]+>/.test(word.word)) {
        realWords.unshift(`v-html="$t('${word.key}')"`);
    }
    
    vscode.window.showQuickPick(realWords, {
        title: "替换原来的文案"
    }).then(replaceWord => {
        if (replaceWord) {
            if (activeEditor?.document) {
                edit.replace(activeEditor?.document.uri, range, replaceWord);
            }
            vscode.workspace.applyEdit(edit).then(res => {
                vscode.workspace.saveAll();
                checkWord();
            });
        }
    });
    
}

export const FileModuleMap: Record<string, string> = {};

const MODULE_ID_REGEX = /langModule\:\s*[\"|\']{1}([\w\-]+)[\"\']{1}/;
export function getCurrentModuleId() {
    const activeEditor = vscode.window.activeTextEditor;
    const fileName = activeEditor?.document.fileName;
    if (!fileName) {
        return;
    }
    if (FileModuleMap[fileName]) {
        return FileModuleMap[fileName];
    }
    const text = activeEditor.document.getText();
    const match = text.match(MODULE_ID_REGEX);
    let moduleId = '';
    if (match) {
        moduleId = match[1];
    } else {
        moduleId = fileName?.substring(fileName.indexOf(ModuleStartFolder) + ModuleStartFolder.length, fileName.lastIndexOf('/')).replace(/\//g, '-')
    }
    FileModuleMap[fileName] = moduleId;
    return moduleId;
}

/**
 * 设置文件对应的ModuleId
 * @param moduleId 
 * @returns 
 */
export function setModuleId(moduleId: string) {
    const activeEditor = vscode.window.activeTextEditor;
    const fileName = activeEditor?.document.fileName;
    if (!fileName) {
        return;
    }
    FileModuleMap[fileName] = moduleId;
}

export function getLocalKeyByWord(word: string) {
    return camelize(word).substring(0, 16);
}

/**
 * 鼠标hover
 */
export class WordHoverProvider implements vscode.HoverProvider {
    provideHover(_document: vscode.TextDocument, _position: vscode.Position, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        const wordRange = _document.getWordRangeAtPosition(_position, WORD_REG);
        if (!wordRange) {
            return null;
        }
        const localeRange = _document.getWordRangeAtPosition(_position, /t\s*\(([a-zA-Z0-9\.\"\'\,\_\-\s]+)\)/);
        const contents = new vscode.MarkdownString(`国际化 \r\n  *** \r\n`);
        if (localeRange) {
            const localeWord =  _document.getText(localeRange).split(',').map(v => v.replace(/(^t|\'|\"|\s|\(|\))/g, ''));
            let moduleId: string;
            let key: string;
            // 引用了其他模块的东西
            if (localeWord.length === 2) {
                moduleId = localeWord[0];
                key = localeWord[1];
            } else {
                moduleId = getCurrentModuleId() as string;
                key = localeWord[0];
            }
            let text = getDicByKey(moduleId, key);
            if (text) {
                contents.appendMarkdown(`✅ 原文：[打开文件](${text[3]})`);
                contents.appendCodeblock(text[2], 'html');
            } else {
                const command = vscode.Uri.parse(`command:${SetLocaleModuleId_COMMAND}`, true);
                contents.appendMarkdown(`❌ 未找到：moduleId:[${moduleId}], key: [${key}]  [设置ModuleId](${command})`);
            }
        } else {
            const word = _document.getText(wordRange).replace(/(^\s+)|(\s+$)/g, '');
            const globalWordKey = getLocalKeyByWord(word);
            contents.appendMarkdown(`原文：${word} \r\n \r\n  国际化: ${globalWordKey}`);
            dic.forEach(el => {
                if (el[2] === word) {
                    contents.appendMarkdown(`\r\n \r\n 已存在KEY: [${el[1]}] {{ $st('${el[0]}', '${el[1]}') }}`);
                }
            });
        }
        const currentModuleId = getCurrentModuleId();
        contents.appendMarkdown(`\r\n \r\n langModule: '${currentModuleId}'`);
        getSelectedWords().forEach(selectedWord => {
            const command = vscode.Uri.parse(`command:${ExtractWord_COMMAND}`, true);
            const args = {
                word: selectedWord.word,
                start: selectedWord.selection.start,
                end: selectedWord.selection.end
            };
            contents.appendMarkdown(`\r\n \r\n [${selectedWord.word}](${command}?${encodeURIComponent(JSON.stringify(args))})`);
        });
        contents.isTrusted = true;
        return new vscode.Hover(contents);
    }
}