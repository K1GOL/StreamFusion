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
  // Due to issues with them not working in some cases,
  // only trigger when main window is focused, not any window.
  // Dev tools
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    // Only trigger if focused
    if (BrowserWindow.getFocusedWindow() === mainWindow) {
      mainWindow.toggleDevTools();
    }
  });

  // Reload
  globalShortcut.register('CommandOrControl+R', () => {
    if (BrowserWindow.getFocusedWindow() === mainWindow) {
      mainWindow.webContents.reloadIgnoringCache();
    }
  });

  // Media controls
  // These are triggered regardless of window focus
  // When media key pressed, send message to renderer process
  globalShortcut.register('MediaPlayPause', () => {
    mainWindow.webContents.send('mediaControlEvent', 'MediaPlayPause');
  });

  globalShortcut.register('MediaNextTrack', () => {
    mainWindow.webContents.send('mediaControlEvent', 'MediaNextTrack');
  });

  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow.webContents.send('mediaControlEvent', 'MediaPreviousTrack');
  });

  mainWindow.on('close', () => {
    // When main window is closed, quit.
    // This is required, because window-all-closed won't fire
    // due to the overlay window being still open
    app.quit();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
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
