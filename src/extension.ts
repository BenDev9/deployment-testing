// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import { Repl, ReplsTreeViewProvider } from './replsTreeView';
const admzip = require('adm-zip');

import { cloneFunc, openFunc, setSidFunc, pullFunc, pushFunc, deleteFunc } from './cmds'

let __sid__:string;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension is now active!');

	setup(context);

	const pull = vscode.commands.registerCommand('replit-vscode.pull', () => {pullFunc(__sid__)})

	const push = vscode.commands.registerCommand('replit-vscode.push', () => {pushFunc(__sid__)});

	const clone = vscode.commands.registerCommand('replit-vscode.clone', () => {cloneFunc(__sid__, context)});

	const openRepl = vscode.commands.registerCommand('replit-vscode.openRepl', async (arg:Repl | string) => {openFunc(arg, context)});

	const deleteRepl = vscode.commands.registerCommand('replit-vscode.deleteRepl', async (arg:Repl | string) => {deleteFunc(arg, context)});

	const setSid = vscode.commands.registerCommand('replit-vscode.setSid', () => {setSidFunc(context)});

	const tree = new ReplsTreeViewProvider(context);
	const treedisp = vscode.window.registerTreeDataProvider('repls', tree);

	const refresh = vscode.commands.registerCommand('replit-vscode.refreshRepls', () => {
		tree.refresh()
	})

	const cmds:vscode.Disposable[] = [pull, push, clone, setSid, openRepl, deleteRepl, refresh]

	context.subscriptions.push(...cmds);
	context.subscriptions.push(treedisp);
}

async function setup(context:vscode.ExtensionContext){
	const storagePath = context.globalStoragePath
	if(!fs.existsSync(storagePath + "\\workspaces\\")){
		fs.mkdirSync(storagePath + "\\workspaces\\", {recursive:true});
	}

	//@ts-ignore
	const secrets = context['secrets'];
	const sid = await secrets.get("sid");

	if(sid == undefined){
		vscode.window.showWarningMessage("We couldn't find your sid. Make sure you have set it", ...["Set sid", "Not now"])
		.then((value) => {
			if(value == "Set sid"){
				vscode.commands.executeCommand("replit-vscode.setSid");
			}
		});
	}
	else{
		__sid__ = sid;
	}
}