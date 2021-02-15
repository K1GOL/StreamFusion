const { BrowserWindow, screen } = require('electron').remote;
const url = require('url');
const path = require('path');

// Handles media player overlay
let currentTime = '-:--';
let totalDuration = '-:--';

let fadeTimeout;

let overlayWindow;

module.exports = {
  // Set title and artist details
  setDetails: function (_title, _artist) {
    overlayWindow.webContents.send('modifyDOM', {
      elementId: 'overlayTitle',
      property: 'innerHTML',
      value: _title
    });
    overlayWindow.webContents.send('modifyDOM', {
      elementId: 'overlayArtist',
      property: 'innerHTML',
      value: _artist
    });
  },

  // Set total duration
  setDuration: function (duration) {
    totalDuration = duration;
  },

  // Set current timestamp
  setTimestamp: function (time) {
    currentTime = time;
  },

  // Create a new overlay window
  createOverlay: function (options) {
    // Create window object
    overlayWindow = new BrowserWindow({
      width: 400,
      height: 120,
      frame: false,
      transparent: true,
      focusable: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: true,
        enableRemoteModule: true
      }
    });

    // Set position to top right corner of main display and always on top
    overlayWindow.setPosition(screen.getPrimaryDisplay().workAreaSize.width - 420, 20);
    overlayWindow.setAlwaysOnTop(true);

    // Ignore mouse clicks
    overlayWindow.setIgnoreMouseEvents(true);

    // Load overlay HTML
    overlayWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, 'overlay.html'),
        protocol: 'file:',
        slashes: true
      })
    );

    // Set interval to update timestamp
    setInterval(() => {
      // Send message to page to do modifying
      overlayWindow.webContents.send('modifyDOM', {
        elementId: 'overlayDuration',
        property: 'innerHTML',
        value: `${currentTime} / ${totalDuration}`
      });
    }, 500);
  },

  setPlaying: function (playing) {
    // Updates play/pause icon
    if (playing) {
      overlayWindow.webContents.send('modifyDOM', {
        elementId: 'overlayPlayPauseIcon',
        property: 'src',
        value: 'icons/play.png'
      });
    } else {
      overlayWindow.webContents.send('modifyDOM', {
        elementId: 'overlayPlayPauseIcon',
        property: 'src',
        value: 'icons/pause.png'
      });
    }
  },

  setProgress: function (v) {
    // Sets progress bar progress
    // Takes input as an integer from 0 to 100, representing % progress
    overlayWindow.webContents.send('modifyDOM', {
      elementId: 'overlayProgressBar',
      property: 'width',
      value: `${v}%`
    });
  },

  showOverlay: function () {
    // Make overlay visible
    overlayWindow.webContents.send('modifyDOM', {
      elementId: 'overlayContainer',
      property: 'opacity',
      value: 1
    });
    // Wait for 3 seconds.
    // Try to clear any previous fade timeout.
    // This is done to make fade look nicer when showOverlay is spammed
    if (fadeTimeout) {
      clearInterval(fadeTimeout);
    }
    fadeTimeout = setTimeout(() => {
      // Hide overlay
      overlayWindow.webContents.send('modifyDOM', {
        elementId: 'overlayContainer',
        property: 'opacity',
        value: 0
      });
    }, 3000);
  }
};
