import { isObject } from 'util';
import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import { LanguageExclude, LanguageInclude } from './Constant';
import { Uri } from 'vscode';

// 国际化字典
export const dic: Map<string, [moduleId: string, key: string, value: string, file: string]> = new Map();
// 某个文档忽略 文字
export const IgnoreWordsDic: Map<string, Set<string>> = new Map();
// 国际化所放文件夹
export let localFolder: vscode.Uri;

const getModuleIdFileName = (filename: string) => {
	return filename.substring(filename.lastIndexOf('/') + 1, filename.lastIndexOf('.'));
};

export function getDicByKey(moduleId: string, key: string) {
	for (const el of dic) {
		if (el[0] === `${moduleId}_${key}`) {
			return el[1];
		}
	}
	return null;
}

export function getModuleLocale(moduleId: string) {
	if (localFolder) {
		console.log('localFolder >> ', localFolder);
		const moduleUri = vscode.Uri.joinPath(localFolder, `${moduleId}.json`);
		if (!fs.existsSync(moduleUri.fsPath)) {
			fs.createFileSync(moduleUri.fsPath);
			return {};
		} else {
			const text = fs.readFileSync(moduleUri.fsPath).toLocaleString();
			const locale = JSON.parse(text);
			traverseLocaleObj(locale, '', (realKey, value) => {
				dic.delete(`${moduleId}_${realKey}`);
				dic.set(`${moduleId}_${realKey}`, [moduleId, realKey, value, moduleUri.path]);
			});
			return locale;
		}
	}
	return {};
}

export function writeBackLocale(moduleId: string, locale: object) {
	const moduleUri = vscode.Uri.joinPath(localFolder, `${moduleId}.json`);
	fs.writeFileSync(moduleUri.fsPath, JSON.stringify(locale, null, 4));
}

/**
 * 遍历国际化文件生成对应的数据结构
 * @param obj 
 * @param key 
 * @param callback 
 */
export const traverseLocaleObj = (obj: any, key: string, callback: (realKey: string, value: string) => void) => {
	if (!key) {
		key = '';
	}
	Object.keys(obj).forEach(k => {
		const value = obj[k];
		const realKey = key + k;
		if (isObject(value)) {
			traverseLocaleObj(value, realKey + '.', callback);
		} else {
			callback(realKey, value);
		}
	});
};

/**
 * 是否已经存在了
 * @param value 
 * @returns 
 */
export const isExitValue = (value: string): [moduleId: string, key: string, value: string, file: string][] => {
	let out = [];
	for(const el of dic) {
		if (el[1][2] === value) {
			out.push(el[1]);
		}
	}
	return out;
};

/**
 * 初始已经有的国际化数据
 */
export function initDicData() {
    vscode.workspace.findFiles(LanguageInclude,  LanguageExclude).then(files => {
		files.forEach(file => {
			const moduleId = getModuleIdFileName(file.path);
			if (!localFolder) {
				localFolder = vscode.Uri.joinPath(file, '..');
				console.log('国际化目录 >> ', localFolder);
			}
			vscode.workspace.fs.readFile(file).then(res => {
				let text = res.toLocaleString();
				let json = JSON.parse(text);
				traverseLocaleObj(json, '', (realKey, value) => {
					dic.set(`${moduleId}_${realKey}`, [moduleId, realKey, value, file.path]);
				});
			});
		});
	});
}