import * as vscode from 'vscode';
import { checkWord } from './CheckWord';
import { ExtractWord_COMMAND, IgnoreWord_COMMAND, SetLocaleModuleId_COMMAND } from './Constant';
import { getModuleLocale, traverseLocaleObj, isExitValue, writeBackLocale, IgnoreWordsDic } from './LocalDicData';
import { getCurrentModuleId, getLocalKeyByWord, getSelectedWords, replaceSelectedWords, setModuleId } from './WordHoverProvider';

let recentPreInputKey = '';
function doCustomInput(moduleId: string, selectionWords: {
    selection: vscode.Selection;
    word: string;
}[]) {
    vscode.window.showInputBox({
        prompt: '请输入模块名称',
        value: moduleId
    }).then(val => {
        if (!val) {
            return;
        }
        moduleId = val;
        setModuleId(moduleId);
        const locale = getModuleLocale(moduleId);
        selectionWords.forEach(selectionWord => {
            vscode.window.showInputBox({
                prompt: '请输入key',
                value: recentPreInputKey + getLocalKeyByWord(selectionWord.word),
                validateInput(input) {
                    if (!input.match(/\w+(\.)?\w+/)) {
                      return '变量名，格式 `[key].[key]`';
                    }
                }
            }).then(inputKey => {
                if (!inputKey) {
                    return;
                }
                let isExit = false;
                traverseLocaleObj(locale, '', (realKey, value) => {
                    if (realKey === inputKey) {
                        vscode.window.showInformationMessage(`[${inputKey}]已经存在，值为[${value}]`);
                        isExit = true;
                        return false;
                    }
                });
                if (!isExit) {
                    const keys = inputKey.split('.');
                    let target = locale;
                    for (let i = 0; i < keys.length; i++) {
                        const key = keys[i];
                        if (i === keys.length - 1) {
                            target[key] = selectionWord.word;
                            continue;
                        } else if (!target[key]){
                            target[key] = {};
                        }
                        target = target[key];
                    }
                    if (keys.length > 1) {
                        keys[keys.length - 1] = '';
                        recentPreInputKey = keys.join('.');
                    } else {
                        recentPreInputKey = '';
                    }
                    writeBackLocale(moduleId, locale);
                }
                replaceSelectedWords({selection: selectionWord.selection, word: selectionWord.word, key: inputKey});
            });
        });
    });
};

const extractWordCommand = (args: Record<string, any> = {}) => {
    return new Promise(resolve => {
        let moduleId = args.moduleId || getCurrentModuleId();
        let selectionWords = getSelectedWords();
        for(let i = 0; i < selectionWords.length; i++) {
            const selectionWord = selectionWords[i];
            const word = selectionWords[i].word;
            // 是否已经翻译了
            let has = isExitValue(word);
            if (has.length) {
                vscode.window.showQuickPick(has.map(v => `${v[0]}_${v[1]}`).concat(['不用公共模块']), {
                    title: '选择公共模块里的key'
                }).then(res => {
                    let find = has.find(v => `${v[0]}_${v[1]}` === res);
                    if (find) {
                        vscode.window.showInformationMessage(`已存在模块[${find[0]}]键值[${find[1]}]值[${find[2]}]`);
                        replaceSelectedWords({selection: selectionWord.selection, word: selectionWord.word, key: find[1]}, find[0]);
                    } else {
                        doCustomInput(moduleId, [selectionWord]);
                    }
                });
                selectionWords.splice(i, 1);
                --i;
            }
        }
        if (selectionWords.length === 0) {
            return true;
        }
        return resolve(
            doCustomInput(moduleId, selectionWords)
        );
    });
};

const ignoreWordCommand = (args: any) => {
    if (args) {
        let filename = args.filename;
        let word = args.word;
        let type = args.type;
        if (filename && word) {
            if (type === 'add') {
                if (IgnoreWordsDic.has(filename)) {
                    IgnoreWordsDic.get(filename)?.add(word);
                } else {
                    let set: Set<string> = new Set();
                    set.add(word);
                    IgnoreWordsDic.set(filename, set);
                }
                vscode.window.showInformationMessage(`已忽略：${word}`);
            } else {
                if (IgnoreWordsDic.has(filename)) {
                    IgnoreWordsDic.get(filename)?.delete(word);
                }
                vscode.window.showInformationMessage(`已取消忽略：${word}`);
            }
            checkWord();
        }
    }
};

// TODO
const openLocaleFileCommand = (args: {file: string, }) => {

};

const setFileModuleId = (args: any) => {
    const moduleId = getCurrentModuleId();
    vscode.window.showInputBox({
        prompt: '请输入模块名称',
        value: moduleId
    }).then(res => {
        if (res) {
            setModuleId(res);
        }
    });
};

export function registerCommand() {
    vscode.commands.registerCommand(ExtractWord_COMMAND, extractWordCommand);
    vscode.commands.registerCommand(IgnoreWord_COMMAND, ignoreWordCommand);
    vscode.commands.registerCommand(SetLocaleModuleId_COMMAND, setFileModuleId);
}
