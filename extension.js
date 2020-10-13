// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fetch = require("node-fetch");

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */

let disposables = [];
let cachedQids = {};

function activate(context) {
	setupHoverProvider();
	vscode.commands.registerCommand('wikidataqidlabels.enableHover', () => {
		vscode.workspace.getConfiguration('wikidataqidlabels').update('enableExtension', true, true);
		vscode.window.showInformationMessage('wikidataqidlabels enabled!');
	});

	vscode.commands.registerCommand('wikidataqidlabels.disableHover', () => {
		vscode.workspace.getConfiguration('wikidataqidlabels').update('enableExtension', false, true);
		vscode.window.showInformationMessage('wikidataqidlabels disabled!');
	});

	vscode.workspace.onDidChangeConfiguration((_) => {
		disposeAll();
		setupHoverProvider();
	});

}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
	disposeAll();
}

module.exports = {
	activate,
	deactivate
}

function setupHoverProvider() {
	if (vscode.workspace.getConfiguration('wikidataqidlabels').get('enableExtension', true)) {
		let disposable = vscode.languages.registerHoverProvider({ pattern: '**' }, {
			async provideHover(document, position, token) {
				const range = document.getWordRangeAtPosition(position);
				const word = document.getText(range);
				if (isQid(word)) {
					return getLabel(word).then((obj) => {
						return new vscode.Hover({
							value: createHoverText(obj)
						});
					})
				}
			}
		});
		disposables.push(disposable);
	}
}


function disposeAll() {
	if (disposables) {
		disposables.forEach(item => item.dispose());
	}
	disposables = [];
}


function isQid(word) {
	let fullPathRE = new RegExp(/https:\/\/www\.wikidata\.org\/wiki\/[QP]\d+/);
	let qidRE = new RegExp(/[QP]\d+/);
	return fullPathRE.test(word) || qidRE.test(word)
}


function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}


function createHoverText(obj) {
	type = obj['type']
	label = obj['label']
	description = obj['description']
	if (type == 'property') {
		return '[prop.] ' + capitalizeFirstLetter(label) + ' (' + description + ')'
	} else {
		return capitalizeFirstLetter(label) + ' (' + description + ')'
	}

}

async function getLabel(qid) {
	langs = vscode.workspace.getConfiguration('wikidataqidlabels').get('wikidataLanguages', "ru|en")
	qid = qid.replace('https://www.wikidata.org/wiki/', '')
	if (qid in cachedQids) {
		return cachedQids[qid]
	} else {
		url = `https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels|descriptions&ids=${qid}&languages=${langs}&format=json`
		let response = await fetch(url);
		if (response.ok) {
			let json = await response.json();
			let entity = json['entities'][qid];
			try {
				res = {
					"type": (qid.charAt(0) == "Q" ? "entity" : "property"),
					"label": getFieldByLangPriority(entity, 'labels', langs),
					"description": getFieldByLangPriority(entity, 'descriptions', langs),
				}
				cachedQids[qid] = res
				return res
			}
			catch (e) {
				console.log("Ошибка: " + e)
			}
		} else {
			console.log("Ошибка HTTP: " + response.status)
		}
	}
}

function getFieldByLangPriority(entity, fieldName, languages) {
	let field = entity[fieldName];
	let languagesList = languages.split('|');
	for (var i = 0; i < languagesList.length; i++) {
		if (languagesList[i] in field) {
			return field[languagesList[i]]['value'];
		}
	}
	return null;
}