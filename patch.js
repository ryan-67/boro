
const fs = require('fs');
const appPath = 'D:\\Projects\\boro\\src\\renderer\\src\\App.tsx';
let app = fs.readFileSync(appPath, 'utf8');
app = app.replace("        background: 'transparent',", "        background: 'rgba(0,0,0,0.35)', border: '2px solid rgba(255,0,0,0.6)',");
app = app.replace('        draggable={false}\n      />', "        draggable={false}\n        onError={() => console.error('IMG FAIL', '/assets/' + dev.spriteFile)}\n      />");
fs.writeFileSync(appPath, app, 'utf8');
console.log('app patched');

const mainPath = 'D:\\Projects\\boro\\src\\main\\index.ts';
let main = fs.readFileSync(mainPath, 'utf8');
main = main.replace('    mainWindow?.showInactive();', "    mainWindow?.showInactive();\n    console.log('Window shown at', mainWindow?.getPosition());\n    if (!app.isPackaged) { mainWindow?.webContents.openDevTools({ mode: 'detach' }); }");
fs.writeFileSync(mainPath, main, 'utf8');
console.log('main patched');
