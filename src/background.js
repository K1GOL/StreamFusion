// This file is mostly just untouched from the boilerplate.
//
// This is main process of Electron, started as first thing when your
// app starts. It runs through entire life of your application.
// It doesn't have any windows which you can see on screen, but we can open
// window from here.

import path from "path";
import url from "url";
import { app, globalShortcut, BrowserWindow } from "electron";
import createWindow from "./helpers/window";

// Special module holding environment variables which you declared
// in config/env_xxx.json file.
import env from "env";

app.on("ready", () => {

  const mainWindow = createWindow("main", {
    width: 1000,
    height: 600,
    frame: false,
    webPreferences: {
      nodeIntegration: true
    }
  });

  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "app.html"),
      protocol: "file:",
      slashes: true
    })
  );

  if (env.name === "development") {
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

app.on("window-all-closed", () => {
  app.quit();
});
