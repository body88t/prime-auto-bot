import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import http from 'http';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

function checkBackendHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/health', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startBackendIfNeeded() {
  checkBackendHealth().then((isRunning) => {
    if (isRunning) return;

    const possibleBackendPaths = [
      path.resolve(__dirname, '../../../backend'),
      path.resolve(__dirname, '../../backend'),
      path.resolve(process.cwd(), 'backend'),
      'd:\\Program\\PRIME AUTO BOT\\backend',
    ];

    const backendDir = possibleBackendPaths.find((p) => fs.existsSync(path.join(p, 'package.json')));

    if (backendDir) {
      const serverScript = path.join(backendDir, 'dist/server.js');
      if (fs.existsSync(serverScript)) {
        backendProcess = spawn('node', [serverScript], {
          cwd: backendDir,
          stdio: 'ignore',
          windowsHide: true,
        });
      } else {
        backendProcess = spawn('npm.cmd', ['run', 'dev'], {
          cwd: backendDir,
          stdio: 'ignore',
          windowsHide: true,
          shell: true,
        });
      }
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    title: 'PRIME AUTO BOT - Control Center',
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    autoHideMenuBar: true,
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackendIfNeeded();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});
