import * as vscode from 'vscode';
import * as fs from 'fs';

export class ReplsTreeViewProvider implements vscode.TreeDataProvider<Repl> {
    constructor(private context:vscode.ExtensionContext) {}

    private _onDidChangeTreeData: vscode.EventEmitter<Repl | undefined | null | void> = new vscode.EventEmitter<Repl | undefined | null | void>();
    //@ts-ignore
    readonly onDidChangeTreeData: vscode.Event<Repl | undefined | null | void> = this._onDidChangeTreeData.event;

    getTreeItem(element:Repl){
        return element;
    }

    getChildren(element?:Repl){
        if(!element){
            var out:Repl[] = []
            const workspacesPath = this.context.globalStoragePath + "\\workspaces\\";
            let workspaceNames = fs.readdirSync(workspacesPath);
            
            workspaceNames.forEach((filename) => {
                var repl = new Repl(filename.split(".")[0]);
                repl.collapsibleState = vscode.TreeItemCollapsibleState.None;
                out.push(repl);
            })
            return out;
        }
    }

    refresh(){
        this._onDidChangeTreeData.fire();
    }
}

export class Repl extends vscode.TreeItem {
    constructor(
        public readonly label:string
    ) {
        super(label);
    }
}