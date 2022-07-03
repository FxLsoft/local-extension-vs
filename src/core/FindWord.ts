import * as ts from 'typescript';
import * as compiler from '@angular/compiler';
import * as vueCompiler from 'vue-template-compiler';
import * as vscode from 'vscode';

import { removeFileComment, trimSpacePosition, trimWhiteSpace } from './utils';

// 中文匹配
// const DOUBLE_BYTE_REGEX = /[^\x00-\xff]/g;
const DOUBLE_BYTE_REGEX = /([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/]+)/g;
const TEMPLATE_REGEX = /([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/]+)/g;
const TEMPLATE_ATTR_REGEX = /\'([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/]+)\'/g;
const VUE_DIRECTIVE = ['v-tip', 'v-html', 'v-text', 'v-error'];
const VUE_ATTRS = ['label', 'title', 'placeholder', 'defaultLabel', 'content', 'defaultText', 'labelText'];
const TEMPLATE_ATTRS = VUE_ATTRS.concat(VUE_ATTRS.map(v => `:${v}`)).concat(VUE_DIRECTIVE);
const TS_REGEX = /([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\<\>\/]+)/g;
const URL_REGEX = /^[\s\"\'\`]*(http|https|\/|\.)/;
const LOCALE_REGEX = /\s*\$(s)?t\(([^)]*)\)\s*/;
const EMPTY_REGEX = /^\s*$/;

type MatchResultType = { range: vscode.Range; text: any; isTemplatePureString?: boolean; isVueAttr?: boolean; attr?: any; isString?: boolean; isVueJsx?: boolean; hasDeal?: boolean };
/**
 * 查找 Ts 文件中的中文
 * @param code
 */
function findTextInTs(code: string, fileName: string, scriptOffset = 0) {
    const matches: MatchResultType[] = [];
    const activeEditor = vscode.window.activeTextEditor;

    const ast = ts.createSourceFile('', code, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TSX);

    function visit(node: ts.Node) {
        switch (node.kind) {
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
            case ts.SyntaxKind.StringLiteral: {
                // 忽略 import 
                if ((node?.parent as any)?.importClause) {
                    break;
                }
                /** 判断 Ts 中的字符串含有中文 */
                const { text } = node as ts.StringLiteral;
                if (text.match(TS_REGEX) && !EMPTY_REGEX.test(text) && !URL_REGEX.test(text)) {
                    const start = node.getStart();
                    const end = node.getEnd();
                    /** 加一，减一的原因是，去除引号 */
                    const startPos = activeEditor?.document.positionAt(scriptOffset + start + 1);
                    const endPos = activeEditor?.document.positionAt(scriptOffset + end - 1);
                    if (startPos && endPos) {
                        const range = new vscode.Range(startPos, endPos);
                        matches.push({
                            range,
                            text,
                            isString: true
                        });
                    }
                }
                break;
            }
            case ts.SyntaxKind.JsxElement: {
                const { children } = node as ts.JsxElement;

                children.forEach(child => {
                    if (child.kind === ts.SyntaxKind.JsxText) {
                        const text = child.getText();
                        /** 修复注释含有中文的情况，Angular 文件错误的 Ast 情况 */
                        const noCommentText = removeFileComment(text, fileName);

                        if (noCommentText.match(TS_REGEX)) {
                            const start = child.getStart();
                            const end = child.getEnd();
                            const startPos = activeEditor?.document.positionAt(scriptOffset + start);
                            const endPos = activeEditor?.document.positionAt(scriptOffset + end);
                            if (startPos && endPos) {
                                const { trimStart, trimEnd } = trimWhiteSpace(code, startPos, endPos);
                                const range = new vscode.Range(trimStart, trimEnd);

                                matches.push({
                                    range,
                                    text: text.trim(),
                                    isString: false
                                });
                            }
                        }
                    }
                });
                break;
            }
            case ts.SyntaxKind.TemplateExpression: {
                const { pos, end } = node;
                const templateContent = code.slice(pos, end);

                if (!/^\s+$/.test(templateContent) && !URL_REGEX.test(templateContent)) {
                    const start = node.getStart();
                    const end = node.getEnd();
                    /** 加一，减一的原因是，去除引号 */
                    const startPos = activeEditor?.document.positionAt(scriptOffset + start + 1);
                    const endPos = activeEditor?.document.positionAt(scriptOffset + end - 1);
                    if (startPos && endPos) {
                        const range = new vscode.Range(startPos, endPos);
                        matches.push({
                            range,
                            text: templateContent,
                            isString: true,
                            hasDeal: LOCALE_REGEX.test(templateContent)
                        });
                    }
                }
            }
        }

        ts.forEachChild(node, visit);
    }
    ts.forEachChild(ast, visit);

    return matches;
}

/**
 * 查找 HTML 文件中的中文
 * @param code
 */
function findTextInHtml(code: string) {
    const matches: MatchResultType[] = [];
    const activeEditor = vscode.window.activeTextEditor;
    const ast = compiler.parseTemplate(code, 'ast.html', {
        preserveWhitespaces: false
    });
    function visit(node: { value: any; valueSpan: any; sourceSpan: any; children: any[]; attributes: any[]; }) {
        const value = node.value;
        if (value && (typeof value === 'string') && value.match(DOUBLE_BYTE_REGEX)) {
            const valueSpan = node.valueSpan || node.sourceSpan;
            let { start: { offset: startOffset }, end: { offset: endOffset } } = valueSpan;
            const nodeValue = code.slice(startOffset, endOffset);
            let startPos, endPos;
            let isString = false;
            /** 处理带引号的情况 */
            if (nodeValue.charAt(0) === '"' || nodeValue.charAt(0) === '\'') {
                startPos = activeEditor?.document.positionAt(startOffset + 1);
                endPos = activeEditor?.document.positionAt(endOffset - 1);
                isString = true;
            } else {
                startPos = activeEditor?.document.positionAt(startOffset);
                endPos = activeEditor?.document.positionAt(endOffset);
            }
            if (startPos && endPos) {
                const { trimStart, trimEnd } = trimWhiteSpace(code, startPos, endPos);
                const range = new vscode.Range(trimStart, trimEnd);
                matches.push({
                    range,
                    text: value,
                    isString
                });
            }

        } else if (value && typeof value === "object" && value.source && value.source.match(DOUBLE_BYTE_REGEX)) {
            /**
             * <span>{{expression}}中文</span> 这种情况的兼容
             */
            const chineseMatches = value.source.match(DOUBLE_BYTE_REGEX);
            chineseMatches.map((match: string) => {
                const valueSpan = node.valueSpan || node.sourceSpan;
                let { start: { offset: startOffset }, end: { offset: endOffset } } = valueSpan;
                const nodeValue = code.slice(startOffset, endOffset);
                const start = nodeValue.indexOf(match);
                const end = start + match.length;
                let startPos = activeEditor?.document.positionAt(startOffset + start);
                let endPos = activeEditor?.document.positionAt(startOffset + end);
                if (startPos && endPos) {
                    const { trimStart, trimEnd } = trimWhiteSpace(code, startPos, endPos);
                    const range = new vscode.Range(trimStart, trimEnd);
                    matches.push({
                        range,
                        text: match[0],
                        isString: false
                    });
                }
            });
        }

        if (node.children && node.children.length) {
            node.children.forEach(visit);
        }
        if (node.attributes && node.attributes.length) {
            node.attributes.forEach(visit);
        }
    }

    if (ast.nodes && ast.nodes.length) {
        ast.nodes.forEach(visit as any);
    }
    return matches;
}
/** 查找 vue 文件中的中文
 * @param  {} code
 * @param  {} fileName
 */
function findTextInVue(code: string, fileName: any) {
    let matches: MatchResultType[] = [];
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {return null;}
    // 1.查找template里的中文
    
    const vueAst = vueCompiler.compile(code, { outputSourceRange: true }).ast;
    let QUOTE = /([\'\"])(.*?)[\'\"]/g;
    let EXP = /\{\{([^}]*)\}\}/g; // 找到表达式{{xxxxxx}}
    function visitVueAst(element: vueCompiler.ASTElement) {
        if (element.ifProcessed) {
            element.ifProcessed = false;
            element.ifConditions?.forEach(el => {
                visitVueAst(el.block);
            });
            return;
        } 
        if (element.text && element.text.trim()) {
            let text = element.text;
            let offsetStart = (element as any).start;
            let exps = text.match(EXP);
            if (Array.isArray(exps)) { // 含有模板表达式
                let expStart = 0;
                let expEnd = 0;
                let lastExpStart = 0;
                let lastExpEnd = 0;
                exps.forEach((exp, index) => {
                    // 计算当前表达式开始和结束的位置
                    expStart = text.indexOf(exp);
                    expEnd = expStart + exp.length;
                    // 匹配表达式中间部分的引号部分也就是字符串部分
                    let strings = exp.match(QUOTE);
                    Array.isArray(strings) && strings.forEach(str => {
                        // 这个字符串含有中文 找到了
                        if (str.match(DOUBLE_BYTE_REGEX) && str.trim()) {
                            let start = exp.indexOf(str);
                            let end = start + str.length;
                            // 加一减一去除引号 获取表达式里面的纯字符部分
                            let realStr = exp.substring(start + 1, end - 1);
                            // 真实的位置为
                            // 当前元素节点的偏移量（offsetStart）+
                            // 当前表达式在当前元素内容的偏移量（expStart）+ 
                            // 中文字符串在当前表达式的偏移量
                            let startPos = activeEditor?.document.positionAt(offsetStart + expStart + start + 1);
                            let endPos = activeEditor?.document.positionAt(offsetStart + expStart + end - 1);
                            if (startPos && endPos) {
                                let range = new vscode.Range(startPos, endPos);
                                matches.push({
                                    range,
                                    text: realStr,
                                    hasDeal: LOCALE_REGEX.test(exp)
                                });
                            }
                        }
                    });
                    // 表达式之间的字符串部分
                    let spaceString = text.substring(lastExpEnd, expStart);
                    if (spaceString.match(DOUBLE_BYTE_REGEX) && spaceString.trim()) {
                        let { trimSpaceStartPos, trimSpaceEndPos } = trimSpacePosition({
                            text: spaceString,
                            start: offsetStart + lastExpEnd,
                            end: offsetStart + expStart
                        });
                        if (trimSpaceStartPos && trimSpaceEndPos) {
                            let range = new vscode.Range(trimSpaceStartPos, trimSpaceEndPos);
                            matches.push({
                                range,
                                text: spaceString.trim(),
                                hasDeal: LOCALE_REGEX.test(exp),
                                isTemplatePureString: true // 需要转为 {{ $t('xxxx')}}
                            });
                        }
                    }
                    lastExpStart = expStart;
                    lastExpEnd = expEnd;
                });
            } else {
                if (text.match(TEMPLATE_REGEX) && /\w/g.test(text)) {
                    let { trimSpaceStartPos, trimSpaceEndPos } = trimSpacePosition(element);
                    if (trimSpaceStartPos && trimSpaceEndPos) {
                        let range = new vscode.Range(trimSpaceStartPos, trimSpaceEndPos);
                        matches.push({
                            range,
                            text: element.text.trim(),
                            isTemplatePureString: true // 需要转为 {{ $t('xxxx')}}
                        });
                    }
                }
            }
        }

        // 处理元素的中文属性
        if (Array.isArray(element.attrsList)) {
            (element.attrsList as any[]).forEach((attr: { value: string; name: string; start: number; end: number; range: vscode.Range; }) => {
                if (attr.value.match(TEMPLATE_REGEX) && TEMPLATE_ATTRS.includes(attr.name)) { //value值中含有中文
                    if (attr.name.includes(':')) { // attr是对象的形式 比如 :rule="{required: true, message: '呵呵呵'}"
                        let attrExpression = activeEditor?.document.getText(new vscode.Range(activeEditor?.document.positionAt(attr.start), activeEditor.document.positionAt(attr.end)));
                        attrExpression = attrExpression?.replace(/\r\n|\r|\n/, 'a'); // TODO 待解决 只解决了window
                        let allQuotes = attr.value.match(QUOTE);
                        if (Array.isArray(allQuotes)) {
                            allQuotes.forEach(v => {
                                if (v.match(DOUBLE_BYTE_REGEX)) {
                                    let pos = attrExpression?.indexOf(v) || 0;
                                    // 加一减一去除引号 获取表达式里面的纯字符部分
                                    let realStr = v.substring(1, v.length - 1);
                                    let startPos = activeEditor?.document.positionAt(attr.start + pos + 1);
                                    let endPos = activeEditor?.document.positionAt(attr.start + pos + v.length - 1);
                                    if (startPos && endPos && activeEditor) {
                                        let range = new vscode.Range(startPos, endPos);
                                        attr.range = new vscode.Range(activeEditor.document.positionAt(attr.start), activeEditor.document.positionAt(attr.end));
                                        matches.push({
                                            range,
                                            text: realStr,
                                            isVueAttr: true,
                                            attr: attr,
                                            hasDeal: LOCALE_REGEX.test(attrExpression as string)
                                        });
                                    }
                                }
                            });
                        }
                    } else if (attr.name.startsWith('v-') || attr.name.startsWith('@')) {
                        if (VUE_DIRECTIVE.includes(attr.name.trim())) {
                            let startPos = activeEditor?.document.positionAt(attr.end - 1 - attr.value.length);
                            let endPos = activeEditor?.document.positionAt(attr.end - 1);
                            if (startPos && endPos && activeEditor) {
                                let range = new vscode.Range(startPos, endPos);
                                attr.range = new vscode.Range(activeEditor.document.positionAt(attr.start), activeEditor.document.positionAt(attr.end));
                                matches.push({
                                    range,
                                    text: attr.value,
                                    isVueAttr: true,
                                    attr: attr,
                                    hasDeal: LOCALE_REGEX.test(attr.value)
                                });
                            }
                        }
                    }
                    else { // 普通的 placeholder="呵呵"
                        let startPos = activeEditor?.document.positionAt(attr.end - 1 - attr.value.length);
                        let endPos = activeEditor?.document.positionAt(attr.end - 1);
                        if (startPos && endPos && activeEditor) {
                            let range = new vscode.Range(startPos, endPos);
                            attr.range = new vscode.Range(activeEditor.document.positionAt(attr.start), activeEditor.document.positionAt(attr.end));
                            matches.push({
                                range,
                                text: attr.value,
                                isVueAttr: true,
                                attr: attr,
                                hasDeal: LOCALE_REGEX.test(attr.value)
                            });
                        }
                    }
                }
            });
        }
        if (Array.isArray(element.children)) {
            element.children.forEach(child => {
                visitVueAst(child as vueCompiler.ASTElement);
            });
        }
    }
    visitVueAst(vueAst as vueCompiler.ASTElement);
    // 2.查找script里面的代码的中文，利用上头的findTextInTs 加上一个偏移量
    const output = vueCompiler.parseComponent(code);
    const script = output.script;
    const scriptCode = script?.content as string;
    let scriptOffset = script?.start as number; // script里面代码的偏移量
    matches = matches.concat(findTextInTs(scriptCode, fileName, scriptOffset));

    return matches;
}

/**
 * 递归匹配代码的中文
 * @param code
 */
export function findChineseText(code: string, fileName: string) {
    if (fileName.endsWith('.html')) {
        return findTextInHtml(code);
    } else if (fileName.endsWith('.vue')) {
        return findTextInVue(code, fileName);
    } else if (fileName.endsWith('.js')) {
        return findTextInTs(code, fileName);
    } else if (fileName.endsWith('.ts')) {
        return findTextInTs(code, fileName);
    } else if (fileName.endsWith('.tsx')) {
        return findTextInTs(code, fileName);
    }
    return [];
}
