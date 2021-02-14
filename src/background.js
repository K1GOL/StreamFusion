// This is main process of Electron, started as first thing when your
// app starts. It runs through entire life of your application.
// It doesn't have any windows which you can see on screen, but we can open
// window from here.

import path from 'path';
import url from 'url';
import { app, globalShortcut, BrowserWindow, dialog } from 'electron';
import createWindow from './helpers/window';

// Special module holding environment variables which you declared
// in config/env_xxx.json file.
import env from 'env';

const { autoUpdater } = require('electron-updater');

app.on('ready', () => {
  const mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true
    }
  });

  // Check for updates, but only if in production
  if (env.name === 'production') {
    console.log('Checking for updates...');
    autoUpdater.checkForUpdatesAndNotify();
  }

  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, 'app.html'),
      protocol: 'file:',
      slashes: true
    })
  );

  if (env.name === 'development') {
    mainWindow.openDevTools();
  }

  // Add shortcuts
  // Dev tools
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    BrowserWindow.getFocusedWindow().toggleDevTools();
  });

  // Reload
  globalShortcut.register('CommandOrControl+R', () => {
    BrowserWindow.getFocusedWindow().webContents.reloadIgnoringCache();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

// Event for available update
autoUpdater.on('update-available', () => {
  console.log('An update is available. Downloding...');
});

// Event for when update is ready to install
autoUpdater.on('update-downloaded', () => {
  console.log('Update has been downloaded. Do you want to install it now?');
  // Ask user if they want to install now
  const res = dialog.showMessageBoxSync({
    buttons: ['Yes', 'No'],
    message: 'An update is available. Would you like to install it now?',
    detail: 'A list of all the changes made can be found here: http://bit.ly/StreamFusionUpdate',
    defaultId: 0,
    title: 'Update'
  });
  if (res === 0) {
    // Restart and update
    autoUpdater.quitAndInstall();
  }
});
