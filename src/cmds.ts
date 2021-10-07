import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Repl } from './replsTreeView';

const admzip = require('adm-zip');
const request = require('request');

export async function openFunc(arg:Repl|string, context:vscode.ExtensionContext) {
    const workspacesPath = context.globalStoragePath + "\\workspaces\\";
    if(!arg){
        var name = await vscode.window.showInputBox({"prompt":"The name of the repl e.g. myRepl"});
    }
    else{
        if(!(typeof arg == "string")){
            var name:string|undefined = arg.label;
        }
        else{
            var name:string | undefined = arg;
        }
    }

    try{
        vscode.commands.executeCommand(
            'vscode.openFolder',
            vscode.Uri.file(workspacesPath+name+".code-workspace"),
            false,
        );
    }
    catch(err){
        vscode.window.showErrorMessage(String(err));
    }
}

export async function deleteFunc(arg:Repl|string, context:vscode.ExtensionContext) {
    const workspacesPath = context.globalStoragePath + "\\workspaces\\";
    if(!arg){
        var name = await vscode.window.showInputBox({"prompt":"The name of the repl e.g. myRepl"}) || "";
    }
    else{
        if(!(typeof arg == "string") && arg != undefined){
            var name:string = arg?.label || "";
        }
        else{
            var name:string = arg;
        }
    }

    if(name=="") await vscode.window.showErrorMessage("No repl was given!");

    let workspaceFile = path.join(workspacesPath, name + ".code-workspace");

    var data = JSON.parse(fs.readFileSync(workspaceFile).toString());
    fs.rmdirSync(data.folders[0].path, {recursive:true});
    fs.unlinkSync(workspaceFile);

    vscode.commands.executeCommand('replit-vscode.refreshRepls');
    vscode.window.showInformationMessage("Repl deleted!")
}

export async function cloneFunc(sid:string, context:vscode.ExtensionContext) {
    let repl = await vscode.window.showInputBox({prompt:"The name of your repl", placeHolder:"@someone/something"});
    if(repl == undefined) return;

    var replName = repl.split("/")[1];

    //@ts-ignore
    if(vscode.workspace.workspaceFolders != undefined) var path:string|undefined = vscode.workspace.workspaceFolders[0].uri.fsPath;
    else {await vscode.window.showErrorMessage("You do not have a folder open!"); return;}

    await download(path, repl, sid);

    const workspaceUri = vscode.Uri.file(
        context.globalStoragePath + "\\workspaces\\" + replName + ".code-workspace"
    )
    const workspaceFileContent = {
        folders: [{path: `${path}/${replName}`}],
        settings:{}
    }

    fs.writeFile(
        workspaceUri.fsPath,
        JSON.stringify(workspaceFileContent, null, 4), (err:any) => {if(err) console.log(err)}
    );

    vscode.commands.executeCommand('replit-vscode.openRepl', replName);
}

export async function setSidFunc(context:vscode.ExtensionContext) {
    var sid = await vscode.window.showInputBox({"prompt":"Your connect.sid cookie"});
    //@ts-ignore
    const secrets = context['secrets'];
    await secrets.store("sid", sid);
    vscode.window.showInformationMessage("Sid stored!");
}

export async function pullFunc(sid:string) {
    if(vscode.workspace.workspaceFolders == undefined){vscode.window.showErrorMessage("You are not in a repl workspace"); return;}

    let folderPath = vscode.workspace.workspaceFolders[0].uri.fsPath

    let data = JSON.parse(String(fs.readFileSync(path.join(folderPath, ".replit-config"))))

    fs.readdir(folderPath, (err:NodeJS.ErrnoException|null, files:string[]) => {
        if(err) console.log(err);

        if(files.length != 0){
            files.forEach(item => {
                
                let filepath = path.join(folderPath, item);
                const stats = fs.statSync(filepath);

                if(stats.isDirectory()){
                    try {
                        fs.rmdirSync(filepath, {recursive:true});
                    } catch (err) {
                        console.error(err);
                    }
                }
                else{
                    try {
                        fs.unlinkSync(filepath);
                    } catch (err) {
                        console.error(err);
                    }
                }
            });
        }
    })

    await download(path.resolve(`${folderPath}\\..`), data.slug, sid);
}

export async function pushFunc(sid:string) {
    vscode.window.showInformationMessage("Push started");
    if(vscode.workspace.workspaceFolders == undefined){vscode.window.showErrorMessage("You are not in a repl workspace"); return;}

    let folderPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    let data = JSON.parse(String(fs.readFileSync(path.join(folderPath, ".replit-config"))));
    let slug:string = data.slug;

    const options = {
        url: `https://replit.com/data/repls/${slug}`,
        headers: {
            Cookie: "connect.sid=" + sid
        }
    }

    request(options, (error:any, response:any, body:any) => {
        let replData = JSON.parse(body);
        let id = replData.id;
        let isOwner = replData.is_owner;
        let username = slug.replace("/", "").replace("@", "").replace(replData.title, "")
        let replName = replData.title;

        if(!isOwner){
            vscode.window.showErrorMessage("You need to be the owner to push to a repl.");
            return;
        }
    
        uploadFiles(folderPath, id, sid, username, replName);
    });

    vscode.window.showInformationMessage("Push complete!");
}

function _unzipFiles(path:string, data:Buffer){
    let zip = admzip(data);
	zip.extractAllTo(path);
}

async function download(path:string, repl:string, sid:string){
    var user = repl.split("/")[0];
    var replName = repl.split("/")[1];
    var slug = user + "/" + replName;
    
    if(path == undefined){
        vscode.window.showErrorMessage("You need to have a folder open to clone a repl!");
        return;
    }

    const options = {
        url: 'https://www.replit.com/' + slug + '.zip',
        encoding: null,
        headers: {
            Cookie: "connect.sid=" + sid
        }
    }

    request(options, (error:any, response:any, body:any) => {
        _unzipFiles(`${path}/${replName}`, body);

        let text = `{"slug":"${slug}"}`
        fs.writeFile(`${path}/${replName}/.replit-config`, text, err => {
        if (err) {
            console.error(err)
            return
        }})
    })
}

async function uploadFiles(replPath:string, id:string, sid:string, username:string, replName:string){
    fs.readdir(replPath, (err:NodeJS.ErrnoException|null, files:string[]) => {
        if(err) console.log(err);

        if(files.length != 0){
            files.forEach(item => {
                
                let filepath = path.join(replPath, item);
                const stats = fs.statSync(filepath);

                if(stats.isDirectory()){
                    uploadFiles(filepath, id, sid, username, replName);
                }
                else{
                    if(item != ".replit-config"){
                        let fileContent = fs.readFileSync(filepath).toString();
                        let pushData = JSON.stringify({
                            UUID: id,
                            sid: sid,
                            username: username,
                            repl:replName,
                            filepath: item,
                            content: fileContent
                        });

                        const options = {
                            url: "https://replops.coolcodersj.repl.co",
                            body: pushData,
                            headers:{
                                'Content-type': 'application/json',
                                'Accept': 'text/plain'
                            },
                            rejectUnauthorized: false
                        }

                        request.post(options, (error:any, response:any, body:any) => {
                        });
                    }
                }
            })
        }
    })
}