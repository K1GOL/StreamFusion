const ytsr = require('ytsr');
const fs = require('fs');
const ytdl = require('ytdl-core');
const { getAudioDurationInSeconds } = require('get-audio-duration');
const win = require('electron').remote.getCurrentWindow();
const scraper = require("soundcloud-scraper");
const https = require('https');
const upgrade = require('./upgrade.js');
const util = require('./util.js');

const { dialog, app, BrowserWindow } = require('electron').remote;
const { shell } = require('electron');

const softwareVersion = app.getVersion();

const dataDirectory = (env.name == 'production' ? ((process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share")) + '\\StreamFusion') : ((process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share")) + '\\StreamFusion (' + env.name + ')'));
const localMusicDirectory = dataDirectory + '\\music';
const streamingDirectory = dataDirectory + '\\streaming';
const libraryFilePath = dataDirectory + '\\library.json';
const historyFilePath = dataDirectory + '\\history.json';
const settingsFilePath = dataDirectory + '\\settings.json';
const customColorSchemeFilePath = dataDirectory + '\\custom_color_scheme.json';

const colorSchemeFile = (env.name == 'production' ? 'resources/default_color_schemes.json' : 'default_color_schemes.json');
const listItemTemplate = (env.name == 'production' ? 'resources/templates/listItemTemplate.html' : 'templates/listItemTemplate.html');
const playlistItemTemplate = (env.name == 'production' ? 'resources/templates/playlistItemTemplate.html' : 'templates/playlistItemTemplate.html');
const changeLogTemplate = (env.name == 'production' ? 'resources/templates/changeLogTemplate.html' : 'templates/changeLogTemplate.html');
const legalInfo = (env.name == 'production' ? 'resources/templates/legalInfoWindowTemplate.html' : 'templates/legalInfoWindowTemplate.html');

let soundCloud;

// -----
// Source prefixes and ids:
// -----
// YouTube: YT
// Soundcloud: SC
// Unknown: NN
// Local: LL
// Example: YT-TzXXHVhGXTQ
//
// Playlist ids work in a similar fashion to track ids, prefixed with
// Playlist: PL
// Example: PL-f3d1scghea
// Except library is just 'library'
// And not really a playlist
// -----

let libraryFileData;
let settings;

let searchResultCache = [];
let isUsingLibraryFile = false;
let soundCloudAPIKey;

let musicPlayQueue = [];
let lastPlayedMusic = [];
let selectedPlaylist = 'library';
let musicIsPlaying = false;
let duration;
let timestamp = 0;

let contextTimeReference;
let freezeProgressBar = false;
let awaitTrackEnd;
let menuIsOpen = false;

let loop = false;
let shuffle = false;
let recordPlayHistory = true;

// -----
// Audio Context Setup
// -----

// Make audio contex
let context = new AudioContext() || new webkitAudioContext(),
      request = new XMLHttpRequest();
let gainNode = context.createGain();
let bufferSource = context.createBufferSource();
let parser = new DOMParser;

// Interval for progress bar updating
let progressUpdater;

// -----
// End of AudioContext and playback related stuff
// -----

import "./stylesheets/main.css";
import "./helpers/external_links.js";
import env from "env";

const osMap = {
  win32: "Windows",
  darwin: "macOS",
  linux: "Linux"
};

function startup(){
  // -----
  // Start-up procedures
  // -----
  console.log(`StreamFusion, version ${app.getVersion()} running on ${osMap[process.platform]} in environment ${env.name}, Electron version ${process.versions.electron}`);

  // Set window min size
  win.setMinimumSize(600, 500);

  // Check that library file, history file, settings file and data directories exist
  if(!fs.existsSync(dataDirectory))
  {
    fs.mkdirSync(dataDirectory);
  }

  // Clear streaming directory if exists
  if(fs.existsSync(streamingDirectory))
  {
    fs.rmdirSync(streamingDirectory, { recursive: true });
  }
  fs.mkdirSync(streamingDirectory);

  if(!fs.existsSync(localMusicDirectory))
  {
    fs.mkdirSync(localMusicDirectory);
  }

  if(!fs.existsSync(libraryFilePath))
  {
    createLibraryFile(function(){});
  }

  if(!fs.existsSync(historyFilePath))
  {
    util.createHistoryFile(historyFilePath, function(){});
  }

  if(!fs.existsSync(customColorSchemeFilePath))
  {
    createCustomColorFile(function(){});
  }

  if(!fs.existsSync(settingsFilePath))
  {
    // Read file after creation
    util.createSettingsFile(settingsFilePath, function(){readSettingsFile(() => {
      // Ask user to accept terms and conditions
      promptToS();
    })});
  } else {
    // Load user settings
    readSettingsFile(() => {
      if(!settings.meta.hasAcceptedToS)
      {
        // Ask user to accept terms and conditions
        promptToS();
      }
      // Set volume to saved value
      let awaitVolumeSliderLoad = setInterval(() => {
        if(document.getElementById('volumeSlider'))
        {
          clearInterval(awaitVolumeSliderLoad);
          document.getElementById('volumeSlider').value = settings.settings.volume;
          gainNode.gain.value = document.getElementById('volumeSlider').value / 100;
          // Update volume label
          document.getElementById('volumeLabel').innerHTML = `Volume ${document.getElementById('volumeSlider').value}%`;
        }
      }, 50);

      // Check that there is lastStarted info
      if(settings.meta.lastStarted == undefined)
      {
        settings.meta.lastStarted = {};
      }

      // Check info about last started state
      // Handle after update procedures
      if(settings.meta.lastStarted.version != softwareVersion)
      {
        let lastVer = (settings.meta.lastStarted.version ? settings.meta.lastStarted.version : '0.0.0');

        // Notify server about the update
        util.notifyUpdateDeployment(lastVer, softwareVersion);

        // First time starting in this version,
        // show change log on about page
        showAboutPage();
        // Update version info
        settings.meta.lastStarted.version = softwareVersion;
        writeSettingsFile(() => {
          // Call upgrade function
          upgrade.upgrade(lastVer, softwareVersion, {
            customColorFile: customColorSchemeFilePath
          });
          // Wait for upgrade to finish
          setTimeout(() => {loadSettings();}, 1000);
        });
      } else {
        loadSettings();
      }
    });
  }

  libraryErrorCorrection();

  // Add event listeners for media keys
  document.addEventListener('keyup', ({ key }) => {
    if(key == 'MediaPlayPause')
    {
      playPause(musicPlayQueue[0]);
    } else if(key == 'MediaTrackNext')
    {
      playNext();
    } else if(key == 'MediaTrackPrevious')
    {
      playPrevious();
    }
  });

  // Get API key for SoundCloud and create scraper client
  // Turn on loading bar
  document.getElementById('loadingBar').style.opacity = 1;
  // Disable input to prevent searches with undefined API key
  document.getElementById('searchInput').disabled = true;

  // Get API key
  scraper.keygen().then(key => {
    console.log(`Got API key for SoundCloud: ${key}`);
    soundCloudAPIKey = key;
    soundCloud = new scraper.Client(soundCloudAPIKey);
    // Turn off loading bar
    document.getElementById('loadingBar').style.opacity = 0;
    // Enable input
    document.getElementById('searchInput').disabled = false;
  });

  // Add event listener to enter key pressed with search bar in focus
  document.getElementById('searchInput').addEventListener("keydown", event => {
    // Key code for enter is 13
    if (event.keyCode == 13) {
      // Clear previous results and then search
      document.getElementById('mainFrame').innerHTML = '';
      search(document.getElementById('searchInput').value);
    }
  });

  // Add event listener to search bar to automatically update library results
  document.getElementById('searchInput').addEventListener("input", event => {
    // Clear previous results
    document.getElementById('mainFrame').innerHTML = ''
    // Clear search cache
    // If cache includes tracks in queue, re-add those to cache
    let tempCache = [];
    searchResultCache.forEach((item) => {
      if(musicPlayQueue.includes(item.id))
      {
        tempCache.push(item);
      }
    });

    searchResultCache = [];

    tempCache.forEach((item) => {
      searchResultCache.push(item);
    });
    searchLibrary(document.getElementById('searchInput').value);
  });

  // Add event listener to show/hide the press enter guide
  document.getElementById('searchInput').addEventListener('focus', (event) => {
    document.getElementById('pressEnterText').style.opacity = 1;
  });

  document.getElementById('searchInput').addEventListener('blur', (event) => {
    document.getElementById('pressEnterText').style.opacity = 0;
  });

  // -----
  // Menu button event handlers
  // -----
  let awaitMenuLoad = setInterval(() => {
    if(document.getElementById('menuItem-reload') && document.getElementById('windowControl-close') && document.getElementById('menu'))
    {
      clearInterval(awaitMenuLoad);

      // Add event listeners to window controls
      // Close
      document.getElementById('windowControl-close').addEventListener('click', () => {
        quit();
      });

      // Minimize
      document.getElementById('windowControl-minimize').addEventListener('click', () => {
        minimize();
      });

      // Maximize
      document.getElementById('windowControl-maximize').addEventListener('click', () => {
        maximize();
      });

      // Add event listener to open/close menu button
      document.getElementById('openMenuButton').addEventListener('click', () => {
        menuIsOpen = !menuIsOpen;
        if(menuIsOpen)
        {
          document.getElementById('menuIcon').src = 'icons/cross.png'
          document.getElementById('menu').style.display = 'block';
          setTimeout(() => {document.getElementById('menu').style.left = '0px';}, 30);
        } else {
          document.getElementById('menuIcon').src = 'icons/menu.png'
          document.getElementById('menu').style.left = '-300px';
          setTimeout(() => {document.getElementById('menu').style.display = 'none';}, 300);
        }
      });

      // Settings button
      document.getElementById('menuItem-settings').addEventListener('click', () => {
        // Show settings window
        document.getElementById('settingsModalContainer').style.display = 'block';
        setTimeout(() => {document.getElementById('settingsModalContainer').style.opacity = 1;}, 30);
      });

      // Apply settings button
      document.getElementById('applySettingsButton').addEventListener('click', () => {
        applySettings();
      });

      // Custom color scheme button
      document.getElementById('customColorSchemeButton').addEventListener('click', () => {
        shell.showItemInFolder(customColorSchemeFilePath);
      });

      // Import library
      document.getElementById('menuItem-importLibrary').addEventListener('click', () => {
        importLibrary();
      });

      // Export library
      document.getElementById('menuItem-exportLibrary').addEventListener('click', () => {
        exportLibrary();
      });

      // Import file
      document.getElementById('menuItem-importFile').addEventListener('click', () => {
        importFile();
      });

      // Reload button
      document.getElementById('menuItem-reload').addEventListener('click', () => {
        BrowserWindow.getFocusedWindow().webContents.reloadIgnoringCache();
      });

      // About button
      document.getElementById('menuItem-about').addEventListener('click', () => {
        showAboutPage();
      });

      // License and legal information button
      document.getElementById('menuItem-legal').addEventListener('click', () => {
        promptToS();
      });

      // License and legal window agree and reject buttons
      document.getElementById('agreeToS').addEventListener('click', () => {
        settings.meta.hasAcceptedToS = true;
        writeSettingsFile(() => {
          console.log('Accepted ToS.');
          // Hide modal window
          document.getElementById('legalModalContainer').style.opacity = 0;
          setTimeout(function(){document.getElementById('legalModalContainer').style.display = "none";}, 300);
          // Reload window
          // TODO: Fix bug where playlists get duplicated when
          // license and legal window is opened.
          // Reload is a workaround
          BrowserWindow.getFocusedWindow().webContents.reloadIgnoringCache();
        });
      });

      document.getElementById('rejectToS').addEventListener('click', () => {
        settings.meta.hasAcceptedToS = false;
        writeSettingsFile(() => {
          console.log('Rejected ToS.');
          let res = dialog.showMessageBoxSync({
            buttons: ['OK'],
            message: 'You have not accepted the provided terms and conditions. You must accept them to continue using StreamFusion. The program will now exit. When you start StreamFusion, you will be asked to accept the terms and conditions.',
            defaultId: 0,
            title: 'Rejected terms of service'
          });
          app.quit();
        });
      });

    }
  }, 20);

  // -----
  // End of menu event handlers
  // -----

  // Read data in library file
  readLibraryFile(function(){
    if(libraryFileData)
    {
      // Display library
      // Empty search query shows everything
      searchLibrary('');
      // Show playlists
      updatePlaylistSidebar();
    }
  });

  // Progress bar updating
  progressUpdater = setInterval(function(){
    if(musicIsPlaying && !freezeProgressBar)
    {
      document.getElementById('trackProgressSlider').value = (((context.currentTime - contextTimeReference + timestamp) / duration) * 100).toFixed(3);
    }
    // Also set the time label if possible
    if(contextTimeReference && !freezeProgressBar)
    {
      util.convertToTimestamp(context.currentTime - contextTimeReference + timestamp, function(time){
        document.getElementById('currentTimeLabel').innerHTML = time;
      });
    }
  }, 200);

  // First wait for elements to load
  let awaitLoad = setInterval(function(){
    if(document.getElementById('versionInfo') && document.getElementById('playerControlPlayPause') && document.getElementById('createNewPlaylist') && document.getElementById('yourLibrary') && document.getElementById('trackProgressSlider'))
    {
      clearInterval(awaitLoad);

      // Set version info on about page
      document.getElementById('versionInfo').innerHTML = `StreamFusion, version ${app.getVersion()} (${env.name}) running on ${osMap[process.platform]}, Electron version ${process.versions.electron}`;

      // Event listener for new playlist button
      document.getElementById('createNewPlaylist').addEventListener('click', (event) => {
        showPlaylistCreateModal();
      });

      // Event listener for your library button
      document.getElementById('yourLibrary').addEventListener('click', (event) => {
        // Lighten all playlist buttons
        Array.from(document.getElementsByClassName('playlistSpan')).forEach(item => {
          item.style.backgroundColor = 'var(--bg-secondary)';
        });
        // Darken this button
        document.getElementById('yourLibrary').style.backgroundColor = 'var(--bg-tertiary)';
        // library is playlist id for the library
        selectedPlaylist = 'library'
        // Clear previous results and then search
        document.getElementById('mainFrame').innerHTML = '';
        searchLibrary('');
      });
      // Library is selected by default, so darken the button
      document.getElementById('yourLibrary').style.backgroundColor = 'var(--bg-tertiary)';

      // When seeking with progress bar, stop playing,
      // then resume from new timestamp
      document.getElementById('trackProgressSlider').addEventListener('change', function (evt) {
        // Start playing from new timestamp
        try{context.suspend();}catch(err){}
        playMusic(musicPlayQueue[0], Math.round((this.value / 100) * duration));
      });

      // Change volume value in settings file when volume is changed
      document.getElementById('volumeSlider').addEventListener('change', function (evt) {
        // Set volume settings property
        settings.settings.volume = document.getElementById('volumeSlider').value;
        // Write settings file
        writeSettingsFile(() => {});
      });

      // Freeze progress bar while user is moving it
      document.getElementById('trackProgressSlider').addEventListener('input', function (evt) {
        freezeProgressBar = true;
      });

      // Event listeners for media controls

      // Volume
      document.getElementById('volumeSlider').addEventListener('input', function (evt) {
        // Update volume label
        document.getElementById('volumeLabel').innerHTML = `Volume ${document.getElementById('volumeSlider').value}%`;
        // Set gain in range 0 - 1
        gainNode.gain.value = document.getElementById('volumeSlider').value / 100;
      });

      // Play/pause
      document.getElementById('playerControlPlayPause').addEventListener("click", function(){
        // Just call playPause for whatever is currently playing, if any
        if(musicPlayQueue[0])
        {
          playPause(musicPlayQueue[0]);
        }
      });

      // Next button
      document.getElementById('playerControlNext').addEventListener("click", function(){
        playNext();
      });

      // Previous button
      document.getElementById('playerControlPrevious').addEventListener("click", function(){
        playPrevious();
      });

      // Loop
      document.getElementById('playerControlLoop').addEventListener("click", function(){
        loop = !loop;

        // Add/remove a border
        if(loop)
        {
          document.getElementById('playerControlLoop').style.border = "3px solid var(--loadingBar)"
        } else {
          document.getElementById('playerControlLoop').style.border = "3px solid var(--bg-primary)"
        }
      });

      // Shuffle
      document.getElementById('playerControlShuffle').addEventListener("click", function(){
        shuffle = !shuffle;

        // Add/remove a border
        if(shuffle)
        {
          document.getElementById('playerControlShuffle').style.border = "3px solid var(--loadingBar)"
        } else {
          document.getElementById('playerControlShuffle').style.border = "3px solid var(--bg-primary)"
        }
      });
    }
  }, 50);

  // Set event listeners for various cancel buttons
  // Done automatically by looking at the data-associatedModal attribute
  let awaitButtonsLoad = setInterval(() => {
    if(document.getElementsByClassName('cancelButton').length > 0)
    {
      clearInterval(awaitButtonsLoad);
      Array.from(document.getElementsByClassName('cancelButton')).forEach(item => {
        // Exception for playlistManagerModalContainer,
        // requires library file to be freed too
        if(item.getAttribute('data-associatedModal') == "playlistManagerModalContainer")
        {
          item.addEventListener('click', () => {
            isUsingLibraryFile = false;
          });
        }
        // Generic add event listener
        item.addEventListener('click', () => {
          document.getElementById(item.getAttribute('data-associatedModal')).style.opacity = 0;
          setTimeout(function(){document.getElementById(item.getAttribute('data-associatedModal')).style.display = "none";}, 300);
        });
      });
    }
  }, 50);

  // Set event listeners for enter key press in text inputs
  // Done automatically by looking at the data-associatedButton attribute
  let awaitInputLoad = setInterval(() => {
    if(document.getElementsByClassName('listenForEnterInput').length > 0)
    {
      clearInterval(awaitInputLoad);
      Array.from(document.getElementsByClassName('listenForEnterInput')).forEach(item => {
        // Generic add event listener
        item.addEventListener('keydown', event => {
          // Key code for enter is 13
          if (event.keyCode == 13) {
            document.getElementById(item.getAttribute('data-associatedButton')).click();
          }
        });
      });
    }
  }, 50);

  // -----
  // End of start-up procedures
  // -----
}

function readSettingsFile(callback)
{
  console.log(`Reading settings file from ${settingsFilePath}`);
  // Read settings file
  try
  {
    // Read file contents into JSON
    fs.readFile(settingsFilePath, (err, data) => {
        if (err) throw err;
        settings = JSON.parse(data);
        // Done, call callback
        callback();
    });
  } catch(err) {
    // Failed to read
    console.error(`Failed to read settings file: ${err}`);
    // Check if file exists, create if missing
    if(!fs.existsSync(settingsFilePath))
    {
      // Read file after creation
      util.createSettingsFile(settingsFilePath, function(){
        // Reload
        BrowserWindow.getFocusedWindow().webContents.reloadIgnoringCache();
      });
    }
  }
}

function writeSettingsFile(callback)
{
  // Write JSON to settings file
  fs.writeFile(settingsFilePath, JSON.stringify(settings), 'utf8', function (err) {
    if (err) {
        console.error('Unable to write settings file JSON!');
        // Try again
        writeSettingsFile(() => {callback();});
    }
    console.log('Settings file data written to disk.');
    callback();
  });
}

function promptToS()
{
  // Shows legal info and license modal
  // Read stuff from file and add to html
  fs.readFile(legalInfo, 'utf8' , (err, data) => {
    if (err) {
      console.error(err)
      return;
    }
    document.getElementById('legalInfo').innerHTML = data;

    // Show the modal window
    document.getElementById('legalModalContainer').style.display = "block";
    setTimeout(function(){document.getElementById('legalModalContainer').style.opacity = 1;}, 20);
  });
  // Accept and reject event handlers to exit the window are added in startup
}

function createCustomColorFile()
{
  // Create a color scheme file
  let jsonTemplate = {
    customColorScheme: {
      name: 'Custom color scheme',
      id: 'customColorScheme',
      colors: {
        backgroundPrimary: '#1d1f21',
        backgroundSecondary: '#292c2f',
        backgroundTertiary: '#161719',
        backgroundLight: '#b5b7b9',
        textPrimary: '#818484',
        textHighlight: '#b5b7b9',
        textDark: '#161719',
        textLink: '#3a81c7',
        loadingBar: '#44b8ff'
      }
    }
  }
  fs.writeFile(customColorSchemeFilePath, JSON.stringify(jsonTemplate), 'utf8', function (err) {
    if (err) {
        console.error(err);
    }

    console.log(`Custom color scheme JSON file created at ${customColorSchemeFilePath}`);
  });

}

function showAboutPage()
{
  // Shows change log in about window
  fs.readFile(changeLogTemplate, 'utf8' , (err, data) => {
    if (err) {
      console.error(err)
      return;
    }
    document.getElementById('changeLogContainer').innerHTML = data;

    // Show the modal window
    document.getElementById('aboutModalContainer').style.display = "block";
    setTimeout(function(){document.getElementById('aboutModalContainer').style.opacity = 1;}, 20);
  });
}

function applySettings()
{
  // Called when apply button is clicked in settings menu.
  // Takes inputs from the settings menu
  // and writes them to the settings object.
  // Hide the settings modal
  document.getElementById('settingsModalContainer').style.opacity = 0;
  setTimeout(function(){document.getElementById('settingsModalContainer').style.display = "none";}, 300);

  settings.settings.colorScheme = document.getElementById('settingsColorScheme').value;
  settings.settings.defaultSearch = document.getElementById('settingsSearchPlatformSelect').value;

  console.log('All settings applied');
  writeSettingsFile(() => {
    loadSettings();
  });
}

function loadSettings()
{
  // Loads user settings and then applies them

  // Default search setting
  document.getElementById('searchPlatformSelect').value = settings.settings.defaultSearch;
  document.getElementById('settingsSearchPlatformSelect').value = settings.settings.defaultSearch;

  // Color scheme
  // Fix undefined color scheme
  if(settings.settings.colorScheme == undefined || settings.settings.colorScheme == '')
  {
    settings.settings.colorScheme = 'default_defaultColorScheme';
  }

  // Set UI first
  // Remove all values from the select
  document.getElementById('settingsColorScheme').value = '';
  document.getElementById('settingsColorScheme').innerHTML = '';

  // For each color scheme, add an option in the select
  fs.readFile(colorSchemeFile, (err, data) => {
      if (err) throw err;

      Object.entries(JSON.parse(data)).forEach(([key, value]) => {
        document.getElementById('settingsColorScheme').innerHTML += `<option value="${value['id']}">${value['name']}</option>`
      });

      fs.readFile(customColorSchemeFilePath, (err, data) => {
          if (err) throw err;

          Object.entries(JSON.parse(data)).forEach(([key, value]) => {
            document.getElementById('settingsColorScheme').innerHTML += `<option value="${value['id']}">${value['name']}</option>`
          });
          // Set a timeout before updating select box in options.
          // Without causes value to not be set correctly sometimes
          setTimeout(() => {document.getElementById('settingsColorScheme').value = settings.settings.colorScheme;}, 300);
      });
  });



  // Load selected color scheme to selectedColorScheme,
  // then apply values from that to style
  let selectedColorScheme = {};
  try {
    // Default schemes are in a seperate file and prefixed with default_
    if(!settings.settings.colorScheme.includes('default_'))
    {
      selectedColorScheme = JSON.parse(fs.readFileSync(customColorSchemeFilePath))[settings.settings.colorScheme];
    } else {
      selectedColorScheme = JSON.parse(fs.readFileSync(colorSchemeFile))[settings.settings.colorScheme];
    }
  } catch (err) {
    console.error(`Error loading custom color scheme: ${err}`);
    dialog.showMessageBoxSync({
      buttons: ['OK'],
      message: 'There was an error loading the selected color scheme.',
      defaultId: 0,
      title: 'Failed to load color scheme'
    });
  }

  document.documentElement.style.setProperty('--bg-primary', selectedColorScheme.colors.backgroundPrimary);
  document.documentElement.style.setProperty('--bg-secondary', selectedColorScheme.colors.backgroundSecondary);
  document.documentElement.style.setProperty('--bg-tertiary', selectedColorScheme.colors.backgroundTertiary);
  document.documentElement.style.setProperty('--bg-light', selectedColorScheme.colors.backgroundLight);
  document.documentElement.style.setProperty('--text-primary', selectedColorScheme.colors.textPrimary);
  document.documentElement.style.setProperty('--text-highlight', selectedColorScheme.colors.textHighlight);
  document.documentElement.style.setProperty('--text-dark', selectedColorScheme.colors.textDark);
  document.documentElement.style.setProperty('--text-link', selectedColorScheme.colors.textLink);
  document.documentElement.style.setProperty('--loadingBar', selectedColorScheme.colors.loadingBar);
}

function libraryErrorCorrection()
{
  // Tries to fix NN sources and 0:00 durations in library
  readLibraryFile(() => {
    // Stop modification of data while processing
    isUsingLibraryFile = true;
    Object.entries(libraryFileData.music).forEach(([key, value]) => {
      // Source error correction
      // Get correct source from ID
      if(value['source'] == 'NN')
      {
        switch(value['id'] .substring(0, 2))
        {
          case 'YT':
            value['source'] = 'YT';
            break;
          case 'SC':
            value['source'] = 'SC';
            break;
          default:
            console.log(`No source error correction could be made on ${item.id}`);
        }
      }
      // Duration error correction
      if(value['duration'] == '0:00')
      {
        if(fs.existsSync(`${localMusicDirectory}\\${value['id']}.mp3`))
        {
          getAudioDurationInSeconds(`${localMusicDirectory}\\${value['id']}.mp3`).then((time) => {
            util.convertToTimestamp(time, (convertedTimestamp) => {
              value['duration'] = convertedTimestamp;
            });
          });
        }
      }
    });
    writeLibraryFile(() => {});
  });
}

function search(searchQuery)
{
  // Return if empty search query
  if(searchQuery == '')
  {
    return;
  }
  // Master search function.
  // Calls other appropriate search functions
  // depending on selected platforms

  // Turn on loading bar
  document.getElementById('loadingBar').style.opacity = 1;

  // Clear search cache
  // If cache includes tracks in queue, re-add those to cache
  let tempCache = [];
  searchResultCache.forEach((item) => {
    if(musicPlayQueue.includes(item.id))
    {
      tempCache.push(item);
    }
  });

  searchResultCache = [];

  tempCache.forEach((item) => {
    searchResultCache.push(item);
  });


  // Clear any existing elements
  document.getElementById('mainFrame').innerHTML = '';
  // Search library
  searchLibrary(searchQuery);

  // Search online on selected platform
  switch(document.getElementById('searchPlatformSelect').value)
  {
    case 'YT':
      searchYouTube(searchQuery);
      break;
    case 'SC':
      searchSoundCloud(searchQuery);
      break;
    default:
      console.error('Platform select error.');
  }
}

function searchLibrary(searchQuery)
{
  let results = [];
  // Search for query in the library

  // Default mode to list all library matches when no playlist is selecetd
  if(selectedPlaylist == 'library')
  {
    Object.entries(libraryFileData.music).forEach(([key, value]) => {
      if(value["title"].toLowerCase().includes(searchQuery.toLowerCase()) || value["author"].toLowerCase().includes(searchQuery.toLowerCase()) || value["source"].toLowerCase().includes(searchQuery.toLowerCase()))
      {
        // Check that not already in the array
        if(!results.includes(libraryFileData.music[key]))
        {
          results.push(libraryFileData.music[key]);
        }
      }
    });
    // Add heading and show results
    document.getElementById('mainFrame').innerHTML += '<h2>Library Search Results</h2>';
    displaySearchResults(results, 'in library');
  } else {
    // Search mode for when a playlist is selected.
    // Instead of listing results in same order as in the library,
    // lists search results in the order they were added to the playlist.
    // This is to make them appear in the same order they will be played in.

    let finishedSearches = 0;

    // Get tracks in playlist
    libraryFileData.playlists[selectedPlaylist].tracks.forEach((item) => {
        findMusicById(item, (res) => {
          // Match search query
          if(res["title"].toLowerCase().includes(searchQuery.toLowerCase()) || res["author"].toLowerCase().includes(searchQuery.toLowerCase()) || res["source"].toLowerCase().includes(searchQuery.toLowerCase()))
          {
            // Check that not already in the array
            if(!results.includes(res))
            {
              results.push(res);
            }
          }
          finishedSearches++;
        });
    });

    // TODO: Improve this, with something else than an interval
    // Wait for all search procedures to be done before showing results
    let totalSearchCount = libraryFileData.playlists[selectedPlaylist].tracks.length;

    let awaitMusicSearch = setInterval(() => {
      if(finishedSearches >= totalSearchCount)
      {
        clearInterval(awaitMusicSearch);
        // Add heading and show results
        document.getElementById('mainFrame').innerHTML += `<h2>${libraryFileData.playlists[selectedPlaylist].name}</h2>`;
        displaySearchResults(results, 'in library');
      }
    }, 1);
  }
}

async function searchYouTube(searchQuery)
{
  // Get YT search results

  // Sometimes fails, just try again
  let searchResults;
  try
  {
    searchResults = await ytsr(searchQuery);
  } catch (err)
  {
    console.error(`YTSR error: ${err}`)
    searchYouTube(searchQuery);
    return;
  }

  // Make sure loading bar stays on
  // Might be disabled by other code that runs faster
  // But only do for 10 seconds, then stop
  let iterationCount = 0;
  let loadingBarChecker = setInterval(function(){
    // Turn on loading bar
    document.getElementById('loadingBar').style.opacity = 1;

    iterationCount++;
    if(iterationCount > 100)
    {
      clearInterval(loadingBarChecker);
    }
  }, 100);

  // Turn first 20 results into standard format JSON
  // An array that stores the results
  let results = [];
  // In addition to returning videos, ytsr also returns stuff
  // like mixes and playlists.
  // Can't be arsed to filter this in the search query,
  // so for those results there is this j variable.
  // Just add 1 to it when something other than a video
  // is encountered.
  // TODO: Use filters instead of whatever this shite above is
  let j = 0;

  for(let i = 0; i < 20; i++)
  {
    let k = i + j;
    if(searchResults.items[k].type != 'video')
    {
      j++;
      continue;
    } else {
      results.push({
        title: searchResults.items[k].title,
        author: searchResults.items[k].author.name,
        duration: searchResults.items[k].duration,
        url: `https://youtube.com/watch?v=${searchResults.items[k].id.substring(3)}`,
        id: `YT-${searchResults.items[k].id}`,
        source: 'YT'
      });
      searchResultCache.push({
        title: searchResults.items[k].title,
        author: searchResults.items[k].author.name,
        duration: searchResults.items[k].duration,
        url: `https://youtube.com/watch?v=${searchResults.items[k].id.substring(3)}`,
        id: `YT-${searchResults.items[k].id}`,
        source: 'YT'
      });
    }
  }
  // Add header if not present
  if(!document.getElementById('mainFrame').innerHTML.includes('<h2>Online Search Results</h2>'))
  {
    document.getElementById('mainFrame').innerHTML += '<h2>Online Search Results</h2>'
  }
  displaySearchResults(results, 'on YouTube');
  clearInterval(loadingBarChecker);
}

function searchSoundCloud(searchQuery)
{
  console.log(`Searching SoundCloud for ${searchQuery} with API key ${soundCloudAPIKey}`);

  // Send https request for search
  // Define settings
  let settings = {
    hostname: 'api-v2.soundcloud.com',
    path: `/search?q=${encodeURI(searchQuery)}&client_id=${soundCloudAPIKey}&limit=20&app_locale=en`,
    method: 'GET'
  }

  // Handle request
  https.get(settings, (res) => {
  let data = '';

  // A chunk of data has been received.
  res.on('data', (chunk) => {
    data += chunk;
  });

  // The whole response has been received. Print out the result.
  res.on('end', () => {
    let results = JSON.parse(data);
    // Results are ready
    // Turn first 20 results into standard format JSON
    let formattedResults = [];

    // Duration in results is in ms
    results.collection.forEach((item) => {
      // Ignore things other than tracks
      if(item.kind != 'track')
      {
        return;
      }
      util.convertToTimestamp(item.duration / 1000, convertedTime => {
        formattedResults.push({
          title: item.title,
          author: item.user.username,
          duration: convertedTime,
          url: item.permalink_url,
          id: `SC-${item.id}`,
          source: 'SC'
        });
        searchResultCache.push({
          title: item.title,
          author: item.user.username,
          duration: convertedTime,
          url: item.permalink_url,
          id: `SC-${item.id}`,
          source: 'SC'
        });
      });
    });
    // Add header if not present
    if(!document.getElementById('mainFrame').innerHTML.includes('<h2>Online Search Results</h2>'))
    {
      document.getElementById('mainFrame').innerHTML += '<h2>Online Search Results</h2>'
    }
    displaySearchResults(formattedResults, 'on SoundCloud');
  });

  }).on("error", (err) => {
    console.error('SoundCloud search https request error:' + err.message);
  });
}

// TODO: Error correct duration set to 0:00, add icon for NN source

function displaySearchResults(results, searchSource)
{
  // Load template for item from html file
  fs.readFile(listItemTemplate, 'utf8' , (err, data) => {
    if (err) {
      console.error(err)
      return;
    }

    // Handle no results found
    if(results.length < 1)
    {
      document.getElementById('mainFrame').innerHTML += `<p>No results were found ${searchSource}.</p>`;
    }

    // Add each of the results to the list
    results.forEach(result => {

      // Fill in the variables
      let item = data;

      item = item
      .split('%ID%').join(result.id)
      .split('%TRACKNAME%').join(result.title)
      .split('%ARTISTNAME%').join(result.author)
      .split('%DURATION%').join(result.duration)
      .split('%SRC%').join(result.source);
      // Alternating background color
      if(document.getElementById('mainFrame').getElementsByClassName('listItem').length % 2 == 0)
      {
        item = item.split('%CLASS%').join('darkItem');
      } else {
        item = item.split('%CLASS%').join('lightItem');
      }
      // Append to document and add click event listeners
      document.getElementById('mainFrame').innerHTML += item;

      // TODO: Search from YouTube and SoundCloud at the same time
      // causes event listeners to be removed from SoundCloud HTML objects.

      // A simple loop to wait until elements properly added,
      // when done add event listeners.
      //
      // TODO: Make this more efficient.
      // Perhaps by storing all the elements in an array,
      // then move this check outside of the results.forEach
      let readyCheck = setInterval(function(){
        if(document.getElementById('playPause-' + result.id) && document.getElementById('local-' + result.id) && document.getElementById('library-' + result.id) && document.getElementById('iconAddRemove-' + result.id))
        {
          document.getElementById('playPause-' + result.id).addEventListener("click", function(){playPause(result.id)});
          document.getElementById('local-' + result.id).addEventListener("click", function(){downloadDelete(result.id)});
          document.getElementById('library-' + result.id).addEventListener("click", function(){addRemoveLibrary(result.id)});
          document.getElementById('playlists-' + result.id).addEventListener("click", function(){managePlaylists(result.id, result.title)});

          // Change button texts and icons appropriately depending on
          // if track downloaded or present in library.
          // Defaults to downloaded and in library

          // Local file UI
          if(!fs.existsSync(`${localMusicDirectory}\\${result.id}.mp3`))
          {
            document.getElementById('iconDownloadDelete-' + result.id).src = 'icons/download.png';
            document.getElementById('iconLabelDownloadDelete-' + result.id).innerHTML = 'Download';
          }

          // Library UI
          findMusicById(result.id, found => {
            if(found == null)
            {
              document.getElementById('iconAddRemove-' + result.id).src = 'icons/folder.png';
              document.getElementById('iconLabelAddRemove-' + result.id).innerHTML = 'Add to library';
            }
          });

          // Play/pause UI
          if(musicPlayQueue[0] == result.id && musicIsPlaying)
          {
            document.getElementById('iconPlayPause-' + result.id).src = 'icons/pause.png';
            document.getElementById('iconLabelPlayPause-' + result.id).innerHTML = 'Pause';
          }

          // Turn off loading bar
          document.getElementById('loadingBar').style.opacity = 0;

          clearInterval(readyCheck);
        }
      }, 5);
    });
  });
}

function playPause(id)
{
  console.log('playpause');
  // If play pause is for currently playing track
  if(id == musicPlayQueue[0])
  {
    if(musicIsPlaying)
    {
      // Pause
      context.suspend();
      musicIsPlaying = false;

      // Update icon
      document.getElementById('iconPlayerControlPlayPause').src = 'icons/play.png';

      // If track is in search results, update icon and label there
      if(document.getElementById(`iconPlayPause-${id}`))
      {
        document.getElementById(`iconPlayPause-${id}`).src = 'icons/play.png'
        document.getElementById(`iconLabelPlayPause-${id}`).innerHTML = 'Play';
      }
    } else {
      // Resume
      context.resume();
      musicIsPlaying = true;
      // Update icon
      document.getElementById('iconPlayerControlPlayPause').src = 'icons/pause.png'
      // If track is in search results, update icon and label there
      if(document.getElementById(`iconPlayPause-${id}`))
      {
        document.getElementById(`iconPlayPause-${id}`).src = 'icons/pause.png'
        document.getElementById(`iconLabelPlayPause-${id}`).innerHTML = 'Pause';
      }
    }
  } else {
    // Play was requested for something not playing right now
    // Stop playing if playing
    if(musicIsPlaying)
    {
      context.suspend();
    }

    // Turn on loading bar
    document.getElementById('loadingBar').style.opacity = 1;

    // Change UI element
    if(document.getElementById(`iconPlayPause-${id}`))
    {
      document.getElementById(`iconPlayPause-${id}`).src = 'icons/play.png'
      document.getElementById(`iconLabelPlayPause-${id}`).innerHTML = 'Play';
    }

    // If this track is in queue, remove everything before it
    if(musicPlayQueue.includes(id))
    {
      musicPlayQueue.splice(0, musicPlayQueue.indexOf(id))
    } else {
      // Clear queue if it doesn't include this track
      musicPlayQueue = []
      // Add this track to queue
      musicPlayQueue.push(id);
    }
    playMusic(id, 0);
  }
}

function downloadDelete(id)
{
  // TODO: Fix that download/delete ui text doesnt change when auto added to lib
  // This function is used to download or delete
  // a file from the local music directory.
  // Only supposed to be used for the download/delete ui button

  // Turn on loading bar
  document.getElementById('loadingBar').style.opacity = 1;

  // Check if file is currently downloaded
  if(fs.existsSync(`${localMusicDirectory}\\${id}.mp3`))
  {
    // Delete
    // Show confirmation box if file is a manually added local file
    if(id.substring(0, 2) == 'LL')
    {
      let res = dialog.showMessageBoxSync({
        buttons: ['Yes', 'No'],
        message: 'This track is a local file added to StreamFusion manually. Deleting it will be permanent, and you cannot recover it later. Are you sure you want to delete it?',
        defaultId: 1,
        title: 'Delete local file'
      });

      // Cancel
      if(res == 1)
      {
        // Turn off loading bar
        document.getElementById('loadingBar').style.opacity = 0;
        return;
      }
      // Remove from library

      removeMusicFromLibraryFile(id);
    }

    console.log(`Deleting: ${localMusicDirectory}\\${id}.mp3`);
    fs.unlinkSync(`${localMusicDirectory}\\${id}.mp3`);

    // Change UI text if track is currently shown on screen
    findMusicById(id, result => {
      if(result != null)
      {
        if(document.getElementById('iconDownloadDelete-' + result.id))
        {
          document.getElementById('iconDownloadDelete-' + result.id).src = 'icons/download.png';
          document.getElementById('iconLabelDownloadDelete-' + result.id).innerHTML = 'Download';

          // Turn off loading bar
          document.getElementById('loadingBar').style.opacity = 0;
        }
      }
    });
  } else {
    // Is not downloaded, so download
    // Extract source
    let src = id.substring(0, 2);
    // Call appropriate download function for source
    switch(src)
    {
      case 'YT':
        downloadYouTube(id, true, function(){
          console.log(`YouTube download for ${id} complete.`);
        });
        break;
      case 'SC':
        // Find url first, then download
        // Search library
        findMusicById(id, res => {
          if(res != null)
          {
            // Was found in library
            downloadSoundCloud(id, res.url, true, function(){});
          } else {
            // Is not in library
            // Look in searchResultCache
            searchResultCache.forEach((item) => {
              if(item.id == id)
              {
                // Was found
                downloadSoundCloud(id, item.url, false, function(){});
              }
            });
          }
        });
        break;
      case 'LL':
        // Shows message box if trying to download a manually added local file
        dialog.showMessageBoxSync({
          buttons: ['OK'],
          message: 'This track is a local file added to StreamFusion manually. It cannot be downloaded.',
          defaultId: 0,
          title: 'Local file'
        });
        break;
      default:
        console.error(`Unable to parse source: ${id}`);
    }
    // Add to library if not present
    // Bypass addRemoveLibrary(), might accidentally remove instead of add
    findMusicById(id, res => {
      if(res == null)
      {
        // Look in searchResultCache to find url
        searchResultCache.forEach((item) => {
          if(item.id == id)
          {
            promptMusicDetails(id, item.url);
          }
        });
      }
    });

    // Change UI text if track is currently shown on screen
    if(document.getElementById('iconDownloadDelete-' + id))
    {
      document.getElementById('iconDownloadDelete-' + id).src = 'icons/delete.png';
      document.getElementById('iconLabelDownloadDelete-' + id).innerHTML = 'Delete local file';
    }
  }
}

function addRemoveLibrary(id)
{
  // This function adds/removes stuff from the library
  // Does not care where was called from (code, ui, etc.)

  // Check if is not in the library file
  findMusicById(id, function(result){
    if(result == null)
    {
      // Is not in the library file, so add it there.
      // But first we need to confirm with the user that the details are correct.
      console.log(`Adding to library: ${id}`);
      // Look in searchResultCache to find url
      searchResultCache.forEach((item) => {
        if(item.id == id)
        {
          promptMusicDetails(id, item.url);
        }
      });
    } else {
      // Was in the library file, so remove it
      console.log(`Removing from library: ${id}`);
      removeMusicFromLibraryFile(id);

      // Check if downloaded as a local file
      if(fs.existsSync(`${localMusicDirectory}\\${id}.mp3`))
      {
        // Ask user if want to delete local file
        let res = dialog.showMessageBoxSync({
          buttons: ['Delete','No'],
          message: result.title + ' is downloaded as a local file, but you have removed it from your library. Do you want to delete the local file? You can still download it or add it to your library later.',
          defaultId: 1,
          title: 'Delete local file?'
        });
        if(res == 0)
        {
          console.log(`Deleting: ${localMusicDirectory}\\${id}.mp3`);
          fs.unlinkSync(`${localMusicDirectory}\\${id}.mp3`);
        }
      }
    }
  });
}

function downloadYouTube(id, local, callback)
{
  if(local)
  {
    console.log(`Downloading from YouTube. Origin: http://www.youtube.com/watch?v=${id.substring(3)} Destination: ${localMusicDirectory}\\${id}.mp3`);

    let stream = ytdl(`http://www.youtube.com/watch?v=${id.substring(3)}`)
    .pipe(fs.createWriteStream(`${localMusicDirectory}\\${id}.mp3`));

    stream.on('finish', function(){
      callback();
      // Turn off loading bar
      document.getElementById('loadingBar').style.opacity = 0;
    });
  } else {
    console.log(`Downloading from YouTube. Origin: http://www.youtube.com/watch?v=${id.substring(3)} Destination: ${streamingDirectory}\\${id}.mp3`);

    let stream = ytdl(`http://www.youtube.com/watch?v=${id.substring(3)}`)
    .pipe(fs.createWriteStream(`${streamingDirectory}\\${id}.mp3`));

    stream.on('finish', function(){
      callback();
      // Turn off loading bar
      document.getElementById('loadingBar').style.opacity = 0;
    });
  }
}

function downloadSoundCloud(id, url, local, callback)
{
  console.log(`Downloading from SoundCloud: ${id}, url: ${url}`)
  // Downloads something from soundcloud
  soundCloud.getSongInfo(url)
    .then(async song => {
        const stream = await song.downloadProgressive();
        let writer;
        if(local)
        {
          writer = stream.pipe(fs.createWriteStream(`${localMusicDirectory}\\${id}.mp3`));
        } else {
          writer = stream.pipe(fs.createWriteStream(`${streamingDirectory}\\${id}.mp3`));
        }
        writer.on("finish", () => {
          console.log(`SoundCloud download finished for ${id}`);
          // Turn off loading bar
          document.getElementById('loadingBar').style.opacity = 0;
          callback();
        });
    })
    .catch(console.error);
}

async function promptMusicDetails(id, url)
{
  // Show details box with details
  // Opacity is to allow transition, display is to actually hide
  document.getElementById('detailsModalContainer').style.display = "block";
  setTimeout(function(){document.getElementById('detailsModalContainer').style.opacity = 1;}, 100);

  let duration = '0:00';
  let source = 'NN';
  try
  {
    searchResultCache.forEach(item => {
      if(item.id == id)
      {
        document.getElementById('detailsTitle').value = item.title;
        document.getElementById('detailsArtist').value = item.author;
        duration = item.duration;
        source = item.source;
      }
    });
  } catch(err) {
    document.getElementById('detailsTitle').value = 'Unknown';
    document.getElementById('detailsArtist').value = 'Unknown';
  }
  // Set confirm button event listener
  document.getElementById('confirmDetailsButton').addEventListener('click', function(){
    // Call add function
    addMusicToLibraryFile({
      id: id,
      author: document.getElementById('detailsArtist').value,
      title: document.getElementById('detailsTitle').value,
      duration: duration,
      source: source,
      url: url
    });
    // Remove event listener with clone and replace
    let original = document.getElementById('confirmDetailsButton'),
    clone = original.cloneNode(true);
    original.parentNode.replaceChild(clone, original);

    // Hide the modal
    // Opacity is to allow transition, display is to actually hide
    document.getElementById('detailsModalContainer').style.opacity = 0;
    setTimeout(function(){document.getElementById('detailsModalContainer').style.display = "none";}, 500);

    // If source is local file, reload library
    if(source == 'LL')
    {
      // Timeout to make sure the thing gets added to library
      // before updating UI
      // maybe fix this, whatever
      // async code is fun
      setTimeout(() => {
        document.getElementById('mainFrame').innerHTML = '';
        searchLibrary('');
      }, 1000);
    }
  });
}

function addMusicToLibraryFile(music)
{
  // Try to prevent any data being overwritten
  let retryInterval = setInterval(function(){
    if(!isUsingLibraryFile)
    {
      // Set this to true while modifying data, even if just in memory
      isUsingLibraryFile = true;
      // Modify the data
      libraryFileData.music['track-' + music.id] = music;
      console.log(`Added track-${music.id} to library file.`);

      writeLibraryFile(function(){
        // Change UI text if track is currently shown on screen
        if(document.getElementById('iconAddRemove-' + music.id))
        {
          document.getElementById('iconAddRemove-' + music.id).src = 'icons/cross.png';
          document.getElementById('iconLabelAddRemove-' + music.id).innerHTML = 'Remove from library';
        }
      });
      clearInterval(retryInterval);
    }
  }, 50);
}

function removeMusicFromLibraryFile(id)
{
  // Removes a track with provided id from the library file
  // Read library file and then delete appropriate data

  delete libraryFileData.music[`track-${id}`];

  // If present in any playlists, remove from those
  Object.entries(libraryFileData.playlists).forEach(([key, value]) => {
    if(value['tracks'].includes(id))
    {
      value['tracks'].splice(value['tracks'].indexOf(id), 1);
    }
  });

  writeLibraryFile(function(){
    // Show search results again to properly remove item from UI
    document.getElementById('mainFrame').innerHTML = '';
    searchLibrary('');
  });

}

function writeLibraryFile(callback)
{
  // When this function is called,
  // isUsingLibraryFile should already be set to true by whatever called this.
  // That is, of course, after checking that it was false.
  // Therefore, this function can act on the library file straight away.
  // This is done to avoid something requesting a lib file read,
  // while data is still in progress of being modified and written to disk.

  // Writes libraryFileData to libraryFilePath
  fs.writeFile(libraryFilePath, JSON.stringify(libraryFileData), 'utf8', function (err) {
    if (err) {
        console.error('Unable to write library file JSON!');
        isUsingLibraryFile = false;
        return console.error(err);
    }
    console.log('Library file data written to disk.');
  });
  isUsingLibraryFile = false;
  callback();

}

function findMusicById(id, callback)
{
  // Find music in library
  // Input is id
  // Returns object if found in library
  // Null if not found
  if(libraryFileData.music[`track-${id}`] == undefined)
  {
    callback(null);
  } else {
    callback(libraryFileData.music[`track-${id}`]);
  }

}

function readLibraryFile(callback)
{
  // Reads library file, then calls callback
  let retryInterval = setInterval(function(){
    if(!isUsingLibraryFile)
    {
      clearInterval(retryInterval);
      isUsingLibraryFile = true;
      console.log(`Reading library file (${libraryFilePath})`);

      fs.readFile(libraryFilePath, (err, data) => {
          if (err) throw err;
          // Try to parse, if fails, read again
          try {
            libraryFileData = JSON.parse(data);
          } catch(err2) {
            isUsingLibraryFile = false;
            setTimeout(() => {
              readLibraryFile(function(){callback()});
            }, 100);
          }
          isUsingLibraryFile = false;
          callback();
      });
    }
  }, 50);
}

function createLibraryFile(callback)
{
  // Create a library file
  let jsonTemplate = {
    music: {},
    playlists: {}
  }
  isUsingLibraryFile = true;
  fs.writeFile(libraryFilePath, JSON.stringify(jsonTemplate), 'utf8', function (err) {
    if (err) {
        console.error(err);
    }

    console.log(`Library JSON file created at ${libraryFilePath}`);
  });
  isUsingLibraryFile = false;
  callback();
}

function playMusic(id, _timestamp)
{
  // This funcion plays music
  console.log(`Playing ${id} from ${_timestamp}`);
  // Do this to make timestamp available to the progress bar updater
  // TODO: Make this better?
  timestamp = _timestamp;

  // Set time reference
  contextTimeReference = context.currentTime;

  // Freeze progress bar while loading
  freezeProgressBar = true;

  // Determine if need to play from streaming dir or local music dir
  let isInStreamingDir = true;
  if(fs.existsSync(`${localMusicDirectory}\\${id}.mp3`))
  {
    isInStreamingDir = false;
  }

  // Get file name from the id
  let musicPlayingFilename;
  if(isInStreamingDir)
  {
    musicPlayingFilename = streamingDirectory + '\\' + id + '.mp3';
  } else {
    musicPlayingFilename = localMusicDirectory + '\\' + id + '.mp3';
  }

  // Download to streaming dir if doesn't exist
  // Download to streamingDirectory, then call function again
  if(isInStreamingDir && !fs.existsSync(musicPlayingFilename))
  {
    console.log(`Downloading to streaming dir: ${id}`);
    // Determine source
    switch(id.substring(0, 2))
    {
      case 'YT':
        downloadYouTube(id, false, function(){
          playMusic(id, _timestamp);
          return;
        });
        break;
      case 'SC':
        // Find url first, then download
        // Search library
        findMusicById(id, res => {
          if(res != null)
          {
            // Was found in library
            downloadSoundCloud(id, res.url, false, function(){
              playMusic(id, _timestamp);
              return;
            });
          } else {
            // Is not in library
            // Look in searchResultCache
            searchResultCache.forEach((item) => {
              if(item.id == id)
              {
                // Was found
                downloadSoundCloud(id, item.url, false, function(){
                  playMusic(id, _timestamp);
                  return;
                });
              }
            });
          }
        });

        break;
        case 'LL':
          // The track is a manually added local file,
          // but not present in the local music directory.
          // Probably deleted.
          dialog.showMessageBoxSync({
            buttons: ['OK'],
            message: 'This manually added local file could not be found. It has probably been deleted.',
            defaultId: 0,
            title: 'File not found'
          });
          // Turn off loading bar
          document.getElementById('loadingBar').style.opacity = 0;
        break;
      default:
        console.error(`Unable to parse source: ${id}`);
        return;
    }
    // Stop function
    return;
  }

  // If file doesn't exist, return
  if(!fs.existsSync(musicPlayingFilename))
  {
    console.error(`Tried playing a file that doesn't exist!`);
    return;
  }

  // Add to play history, but only if timestamp is 0,
  // (to prevent same track being added when skipping to some timestamp)
  if(_timestamp == 0)
  {
    addToPlayHistory(id);
  }

  // Get duration of audio
  getAudioDurationInSeconds(musicPlayingFilename).then((_duration) => {
    duration = _duration;
    // Get music object
    findMusicById(id, function(music){
      // If null returned, search in searchResultCache instead of library
      if(music == null)
      {
        searchResultCache.forEach(item => {
          if(item.id == id)
          {
            music = item;
          }
        });
      }
      // Set UI text
      document.getElementById('playerTrackTitle').innerHTML = music.title;
    	document.getElementById('playerTrackArtist').innerHTML = music.author;
      document.getElementById('totalDurationlabel').innerHTML = music.duration;

      // Get file data via XMLHttpRequest
      request.open("GET", parser.parseFromString(musicPlayingFilename, 'text/html').body.textContent, true);
      request.responseType = "arraybuffer";
    	request.encoding = null;
      request.onload = function(){
        // Decode into audio data
        context.decodeAudioData(request.response, function(buffer){
          // Unfreeze progress bar
          freezeProgressBar = false;
          // Set time reference
          contextTimeReference = context.currentTime;

          // Create a new buffer source
          bufferSource.disconnect();
          bufferSource = context.createBufferSource();
          bufferSource.buffer = buffer;

          // Gain for volume control
          bufferSource.connect(gainNode);
          gainNode.connect(context.destination);
          // Set gain node gain to volume slider value
          gainNode.gain.value = document.getElementById('volumeSlider').value / 100;

          // Start playing
          bufferSource.start(0, _timestamp);
          // Call resume in case still paused
          context.resume();
          musicIsPlaying = true;

          // Turn off loading bar
          document.getElementById('loadingBar').style.opacity = 0;
          // context.currentTime tells how long the context has been playing
          // this audio.
          // Set this variable as a zero point reference,
          // so when skipping to a timestamp, offset from timestamp can be
          // calculated.

          // Update icon
          document.getElementById('iconPlayerControlPlayPause').src = 'icons/pause.png';

          // Set all tarcks in search results to show "Play" label
          Array.from(document.getElementsByClassName('playPauseIconLabel')).forEach(item => {
            item.innerHTML = 'Play';
          });

          Array.from(document.getElementsByClassName('listItemPlayPauseIcon')).forEach(item => {
            item.src = 'icons/play.png';
          });


          // If track is in search results, update icon and label there
          if(document.getElementById(`iconPlayPause-${id}`))
          {
            document.getElementById(`iconPlayPause-${id}`).src = 'icons/pause.png'
            document.getElementById(`iconLabelPlayPause-${id}`).innerHTML = 'Pause';
          }

          // When playback over, play next track.
          // bufferSource.onended would have been used here,
          // but it seems to trigger sometimes in the middle of playback,
          // so instead just check if current playback time
          // is over the track duration.
          //
          // Clear previous interval and set new
          try {clearInterval(awaitTrackEnd);} catch(err){}
    		  awaitTrackEnd = setInterval(function(){onTrackPlaybackEnd()}, 1000);
        });
      }
      // Sends the XMLHttpRequest
      request.send();
    });
  });
}

function onTrackPlaybackEnd()
{
  if((context.currentTime - contextTimeReference + timestamp) > duration)
  {
    // Clear the interval to stop infinite loop if fails to play next
    clearInterval(awaitTrackEnd);
    // If loop is on, call this function again with timestamp 0
    // Else call playNext
    context.suspend();
    if(loop)
    {
      playMusic(musicPlayQueue[0], 0);
    } else {
      playNext();
    }
  }
}

function playNext()
{
  // This function plays the next track in the queue

  // Oreder of operations:
  // 1 - If something is in the queue, play that.
  // 2 - If queue is empty, play next track in library.
  // 3 - If this fails, play first track in library.

  // Turn on loading bar
  document.getElementById('loadingBar').style.opacity = 1;
  console.log('Playing next...');
  if(musicPlayQueue.length > 1)
  {
    musicPlayQueue.shift();

    // If shuffle, play random track
    if(shuffle)
    {
      let random = Math.floor(Math.random() * musicPlayQueue.length);
      playMusic(musicPlayQueue[random], 0);

      // Remove selected track from queue
      musicPlayQueue.splice(musicPlayQueue[random], 1);
    } else {
      // Play
      playMusic(musicPlayQueue[0], 0);
    }
  } else {
    // If shuffle enabled, select random from library
    if(shuffle)
    {
      let tracks = [];
      Object.entries(libraryFileData.music).forEach(([key, value]) => {
        tracks.push(value['id']);
      });

      musicPlayQueue[0] = tracks[Math.floor(Math.random() * tracks.length)];
      playMusic(musicPlayQueue[0], 0);
    } else {
      // Search library for current track
      // and stop search on next value, play that
      // TODO: Make this cleaner, no nice way to stop a foreach
      let foundCurrentTrack = false;
      let startedPlayingMusic = false;
      Object.entries(libraryFileData.music).forEach(([key, value]) => {
        // If last entry was current track
        if(foundCurrentTrack && !startedPlayingMusic)
        {
          musicPlayQueue[0] = value['id'];
          playMusic(value['id'], 0);
          startedPlayingMusic = true;
        } else if(value['id'] == musicPlayQueue[0])
        {
          foundCurrentTrack = true;
        }
      });

      // Looks like nothing was played,
      // just play the first thing in library
      if(!startedPlayingMusic)
      {
        let firstKey = Object.keys(libraryFileData.music)[0];
        let firstTrack = libraryFileData.music[firstKey];
        musicPlayQueue[0] = firstTrack.id;
        playMusic(firstTrack.id, 0);
      }
    }
  }
}

function playPrevious()
{
  // Return if play history is empty
  // (So a length of less than 2, since the current track is also included)
  if(lastPlayedMusic.length < 2)
  {
    return;
  }
  // Turn on loading bar
  document.getElementById('loadingBar').style.opacity = 1;

  console.log('Playing previous track.');
  // Play the last track in the history

  lastPlayedMusic.shift();
  musicPlayQueue[0] = lastPlayedMusic[0];
  playMusic(lastPlayedMusic[0], 0);
}

function addToPlayHistory(id)
{
  console.log(`Adding to history: ${id}`);
  // Do not add same track multiple times
  if(!lastPlayedMusic.includes(id))
  {
    lastPlayedMusic.unshift(id);
  }

  // Record to history file
  let readHistory = JSON.parse(fs.readFileSync(historyFilePath));
  // Add 1 to play count in current month
  let d = new Date();
  // Check that entry for current month exists
  if(readHistory[`${d.getFullYear()}.${d.getMonth()}`] == undefined)
  {
    readHistory[`${d.getFullYear()}.${d.getMonth()}`] = {};
  }

  if(readHistory[`${d.getFullYear()}.${d.getMonth()}`][id] == undefined)
  {
    readHistory[`${d.getFullYear()}.${d.getMonth()}`][id] = 1;
  } else {
    readHistory[`${d.getFullYear()}.${d.getMonth()}`][id] += 1;
  }
  fs.writeFile(historyFilePath, JSON.stringify(readHistory), 'utf8', function (err) {
    if (err) {
        console.error('Unable to write history file JSON!');
        return console.error(err);
    }
    console.log('History file data written to disk.');
  });
}

function showPlaylistCreateModal()
{
  // Set default value in name input to be "New playlist"
  document.getElementById('playlistTitle').value = 'New playlist';

  // Show modal for new playlist creation
  // Opacity is to allow transition, display is to actually hide
  document.getElementById('newPlaylistModalContainer').style.display = "block";
  setTimeout(function(){document.getElementById('newPlaylistModalContainer').style.opacity = 1;});

  // Handle confirm button
  document.getElementById('confirmNewPlaylistButton').addEventListener('click', function(){
    // Check for empty name
    if(document.getElementById('playlistTitle').value == '' || document.getElementById('playlistTitle').value.split(' ').join('') == '')
    {
      let res = dialog.showMessageBoxSync({
        buttons: ['OK'],
        message: 'Playlist name cannot be empty',
        defaultId: 0,
        title: 'Invalid playlist name'
      });
      return;
    }

    // Call create function
    createNewPlaylist(document.getElementById('playlistTitle').value);

    // Remove event listener with clone and replace
    let original = document.getElementById('confirmNewPlaylistButton'),
    clone = original.cloneNode(true);
    original.parentNode.replaceChild(clone, original);

    // Hide the modal
    // Opacity is to allow transition, display is to actually hide
    document.getElementById('newPlaylistModalContainer').style.opacity = 0;
    setTimeout(function(){document.getElementById('newPlaylistModalContainer').style.display = "none";}, 500);
  });
}

function updatePlaylistSidebar()
{
  // Updates list of playlists in the sidebar
  // Clear old elements
  document.getElementById('playlistContainer').innerHTML = '';

  // Load template for item from html file
  fs.readFile(playlistItemTemplate, 'utf8' , (err, data) => {
    if (err) {
      console.error(err)
      return;
    }

    // Show create playlist button
    document.getElementById('playlistContainer').innerHTML += '<span class="playlistSpan" id="createNewPlaylist"> <p class="inlineBlock">+ Create new playlist</p> </span>';
    // Event listener for new playlist button
    let awaitHTMLAppend = setInterval(() => {
      if(document.getElementById('createNewPlaylist'))
      {
        clearInterval(awaitHTMLAppend);
        document.getElementById('createNewPlaylist').addEventListener('click', (event) => {
          showPlaylistCreateModal();
        });
      }
    }, 50);

    // Show playlists
    Object.entries(libraryFileData.playlists).forEach(([key, value]) => {
      // Modify template with correct data
      let elementToAppend = data
      .split('%ID%').join(value['id'])
      .split('%NAME%').join(value['name']);

      // Append to HTML
      document.getElementById('playlistContainer').innerHTML += elementToAppend;

      // Darken color if selected playlist
      if(selectedPlaylist == value['id'])
      {
        document.getElementById(`playlistSpan-${value['id']}`).style.backgroundColor = 'var(--bg-tertiary)';
      }

      // Add event listeners to span and buttons
      let awaitElementLoad = setInterval(() => {
        if(document.getElementById(`playlistSpanClickableArea-${value['id']}`) && document.getElementById(`playlistButtonDelete-${value['id']}`) && document.getElementById(`playlistButtonRename-${value['id']}`))
        {
          clearInterval(awaitElementLoad);
          // On click of the playlist element
          document.getElementById(`playlistSpanClickableArea-${value['id']}`).addEventListener('click', () => {
            selectedPlaylist = value['id'];
            // Lighten all playlist buttons
            Array.from(document.getElementsByClassName('playlistSpan')).forEach(item => {
              item.style.backgroundColor = 'var(--bg-secondary)';
            });
            // Darken button for this playlist
            document.getElementById(`playlistSpan-${value['id']}`).style.backgroundColor = 'var(--bg-tertiary)';
            // Clear previous results and then search
            document.getElementById('mainFrame').innerHTML = '';
            searchLibrary('');
            // Set everything in play queue from pos 1 forwards to be playlist
            /* if(musicPlayQueue[0])
            {
              let firstInQueue = musicPlayQueue[0];
              musicPlayQueue = [];
              musicPlayQueue = value['tracks'];
              musicPlayQueue.unshift(firstInQueue);
            } else {
              // Queue was empty
              musicPlayQueue = value['tracks'];
            } */
            let firstInQueue = musicPlayQueue[0];
            musicPlayQueue = [];
            musicPlayQueue = value['tracks'];
            musicPlayQueue.unshift(firstInQueue);
          });

          // On click of delete button
          document.getElementById(`playlistButtonDelete-${value['id']}`).addEventListener('click', () => {
            // Ask user if wants to delete playlist
            let res = dialog.showMessageBoxSync({
              buttons: ['Delete','Cancel'],
              message: `Are you sure you want to delete the playlist ${value['name']}`,
              defaultId: 1,
              title: 'Delete playlist?'
            });
            if(res == 0)
            {
              let awaitLibraryFile = setInterval(() => {
                if(!isUsingLibraryFile)
                {
                  clearInterval(awaitLibraryFile);
                  isUsingLibraryFile = true;
                  delete libraryFileData.playlists[value['id']];
                  writeLibraryFile(() => {
                    console.log(`Deleted playlist ${value['id']}`);
                    updatePlaylistSidebar();
                  });
                }
              }, 50);
            }
          });


          // On click of rename button
          document.getElementById(`playlistButtonRename-${value['id']}`).addEventListener('click', () => {
            renamePlaylist(value['id']);
          });

          // TODO: this
        }
      }, 150);
    });
  });

}

function renamePlaylist(id)
{
  // Show rename modal
  document.getElementById('renamePlaylistModalContainer').style.display = "block";
  setTimeout(function(){document.getElementById('renamePlaylistModalContainer').style.opacity = 1;}, 100);

  // Set default value in name box to be current name
  document.getElementById('renamePlaylistTitle').value = libraryFileData.playlists[id].name;

  // Handle confirm button
  document.getElementById('confirmRenamePlaylistButton').addEventListener('click', () => {
    // Get name from input box
    let newName = document.getElementById('renamePlaylistTitle').value;

    // Check for empty name
    if(newName == '' || newName.split(' ').join('') == '')
    {
      let res = dialog.showMessageBoxSync({
        buttons: ['OK'],
        message: 'Playlist name cannot be empty',
        defaultId: 0,
        title: 'Invalid playlist name'
      });
      return;
    }

    // Hide rename modal
    document.getElementById('renamePlaylistModalContainer').style.opacity = 0;
    setTimeout(function(){document.getElementById('renamePlaylistModalContainer').style.display = "none";}, 500);

    // Do the renaming
    let awaitLibraryFile = setInterval(() => {
      if(!isUsingLibraryFile)
      {
        clearInterval(awaitLibraryFile);
        isUsingLibraryFile = true;
        libraryFileData.playlists[id].name = newName;
        writeLibraryFile(() => {
          console.log(`Renamed playlist ${id} to ${newName}`);
          updatePlaylistSidebar();
        });
      }
    }, 50);
    // Remove event listener with clone and replace
    let original = document.getElementById('confirmRenamePlaylistButton'),
    clone = original.cloneNode(true);
    original.parentNode.replaceChild(clone, original);
  });
}

function createNewPlaylist(name)
{
  // Assign a random id for playlist
  let playlistID = `PL-${(Math.random() + 1).toString(36).substring(7)}${(Math.random() + 1).toString(36).substring(7)}`
  // Avoid duplicates
  if(libraryFileData.playlists[playlistID] != undefined)
  {
    createNewPlaylist(name);
    return;
  }

  // Create new value in data object
  libraryFileData.playlists[playlistID] = {
    id: playlistID,
    name: name,
    tracks: []
  };
  // Write to file
  let awaitFile = setInterval(function(){
    if(!isUsingLibraryFile)
    {
      clearInterval(awaitFile);
      isUsingLibraryFile = true;
      writeLibraryFile(() => {
        console.log(`Created playlist with name: ${name}, id: ${playlistID}`);
        updatePlaylistSidebar();
      });
    }
  }, 100);
}

function managePlaylists(id, title)
{
  // Function called when manage playlists button is pressed
  // If not in library, return
  findMusicById(id, (res) => {
    if(res)
    {
      // Show playlist manager
      document.getElementById('playlistManagerModalContainer').style.display = "block";
      setTimeout(function(){document.getElementById('playlistManagerModalContainer').style.opacity = 1;}, 100);

      // Set heading text
      document.getElementById('playlistManagerHeading').innerHTML = `Manage playlists for ${title}`;

      // Clear any previous elements
      document.getElementById('playlistManagerPlaylistList').innerHTML = '';

      // Prevent modification of library file
      isUsingLibraryFile = true;

      // Show list of playlists
      Object.entries(libraryFileData.playlists).forEach(([key, value]) => {
        // If playlist contains track
        if(value['tracks'].includes(id))
        {
          // Does include, append appropriate HTML
          document.getElementById('playlistManagerPlaylistList').innerHTML += `<li><input type="checkbox" class="playlistCheckbox" checked id="CB-${value['id']}"> ${value['name']}</li>`;
        } else {
          // Does not include, append appropriate HTML
          document.getElementById('playlistManagerPlaylistList').innerHTML += `<li><input type="checkbox" class="playlistCheckbox" id="CB-${value['id']}"> ${value['name']}</li>`;
        }
      });

      // Add event handler to confirm button to update playlists
      document.getElementById('playlistManagerConfirmButton').addEventListener('click', () => {
        // For each playlist, check if checked, then add/remove track from playlist
        Array.from(document.getElementsByClassName('playlistCheckbox')).forEach(item => {
          // Check if checked
          if(item.checked)
          {
            // Check if track is not playlist when should be
            if(!libraryFileData.playlists[item.id.substring(3)].tracks.includes(id))
            {
              // Add to playlist
              libraryFileData.playlists[item.id.substring(3)].tracks.push(id);
              console.log(`Added ${id} to playlist ${item.id.substring(3)}`);
            }
          } else {
            // Check if track is in playlist when should not be
            if(libraryFileData.playlists[item.id.substring(3)].tracks.includes(id))
            {
              // Remove from playlist
              libraryFileData.playlists[item.id.substring(3)].tracks.splice(libraryFileData.playlists[item.id.substring(3)].tracks.indexOf(id), 1);
              console.log(`Removed ${id} from playlist ${item.id.substring(3)}`);
            }
          }
        });

        // Hide the modal
        // Opacity is to allow transition, display is to actually hide
        document.getElementById('playlistManagerModalContainer').style.opacity = 0;
        setTimeout(function(){document.getElementById('playlistManagerModalContainer').style.display = "none";}, 500);

        // Write to library file
        writeLibraryFile(() => {
          console.log(`Updated playlists for ${id}`);
        });

        // Remove event listener with clone and replace
        let original = document.getElementById('playlistManagerConfirmButton'),
        clone = original.cloneNode(true);
        original.parentNode.replaceChild(clone, original);
      });
    } else {
      dialog.showMessageBoxSync({
        buttons: ['OK'],
        message: 'You need to add this track to your library before you can add it to a playlist.',
        defaultId: 0,
        title: 'Manage playlists'
      });
      return;
    }
  });
}

function importLibrary()
{
  // Import library from .sfd JSON file
  // Show file select dialog
  let p = dialog.showOpenDialogSync({
    filters: [
      { name: 'StreamFusion Data File', extensions: ['sfd'] }
    ]
  });
  // Return if nothing selected
  if(p.length < 1)
  {
    return;
  }

  let path = p[0];
  readLibraryFile(() => {
    // Import from file if anything was selected.
    // .sfd file is just a JSON file with a custom extension
    // to allow setting a file association to open them with StreamFusion.
    if(path)
    {
      // Turn on loading bar
      document.getElementById('loadingBar').style.opacity = 1;

      let awaitLibraryFile = setInterval(() => {
        if(!isUsingLibraryFile)
        {
          clearInterval(awaitLibraryFile);
          isUsingLibraryFile = true;
          console.log(path);
          fs.readFile(path, (err, data) => {
              if (err) throw err;
              // After reading data, parse to JSON
              let parsed = JSON.parse(data);
              // Then for each track, add to library, if doesn't exist there
              Object.entries(parsed.library.music).forEach(([key, value]) => {
                if(!libraryFileData.music[key])
                {
                  // Skip local files
                  if(!parsed.library.music[key].id.substring(0, 2) == 'LL')
                  {
                    libraryFileData.music[key] = parsed.library.music[key];
                  }
                }
              });

              // Then for each playlist, add to library, if not there
              Object.entries(parsed.library.playlists).forEach(([key, value]) => {
                if(!libraryFileData.playlists[key])
                {
                  libraryFileData.playlists[key] = parsed.library.playlists[key];
                }
              });

              // Set timeout to make sure that importing is done
              setTimeout(() => {
                writeLibraryFile(() => {
                  // Turn off loading bar
                  document.getElementById('loadingBar').style.opacity = 0;
                  console.log(`Imported library from ${path}`);

                  // Clear previous results,
                  // and then search to show updated library
                  document.getElementById('mainFrame').innerHTML = '';
                  searchLibrary('');
                });
              }, 3000);
          });
        }
      }, 50);
    }
  });
}

function exportLibrary()
{
  // Export library to .sfd JSON file
  let path = dialog.showSaveDialogSync({
    filters: [
      { name: 'StreamFusion Data File', extensions: ['sfd'] }
    ]
  });

  readLibraryFile(() => {
    // If a path was selected
    if(path)
    {
      let awaitLibraryFile = setInterval(() => {
        if(!isUsingLibraryFile)
        {
          clearInterval(awaitLibraryFile);
          isUsingLibraryFile = true;

          // Add everything to a JSON object, then write to file
          let exportData = {
            library: {
              music: libraryFileData.music,
              playlists: libraryFileData.playlists
            }
          }

          fs.writeFile(path, JSON.stringify(exportData), 'utf8', function (err) {
            if (err) {
                console.error('Unable to export library!');
                isUsingLibraryFile = false;
                return console.error(err);
            }
            console.log(`Exported library to ${path}`);
            shell.showItemInFolder(path);
            isUsingLibraryFile = false;
          });
        }
      }, 50);
    }
  });
}

function importFile()
{
  // Imports an audio file
  // Ask for file
  let p = dialog.showOpenDialogSync({
    filters: [
      { name: 'mp3 audio file', extensions: ['mp3'] }
    ]
  });
  // Return if nothing selected
  if(p.length < 1)
  {
    return;
  }
  let path = p[0];

  let d = new Date();
  // Assign a random id for track
  let randomID = `LL-${d.getFullYear()}${d.getMonth()}${d.getDate()}${(Math.random() + 1).toString(36).substring(7)}`

  // Copy file to music directory
  fs.copyFile(path, `${localMusicDirectory}\\${randomID}.mp3`, (err) => {
    if (err) throw err;

    // Add details to searchResultCache, and then call function to add to library.
    // Add to cache to make details available for the function to add to library.
    getAudioDurationInSeconds(path).then((time) => {
      util.convertToTimestamp(time, (convertedTimestamp) => {
        searchResultCache.push({
          title: 'Unknown',
          author: 'Unknown',
          duration: convertedTimestamp,
          url: null,
          id: randomID,
          source: 'LL'
        });
        addRemoveLibrary(randomID);
      });
    });
  });


}

function quit()
{
  app.quit();
}

function minimize()
{
  BrowserWindow.getFocusedWindow().minimize();
}

function maximize()
{
  if(BrowserWindow.getFocusedWindow().isMaximized())
  {
    BrowserWindow.getFocusedWindow().unmaximize();
    document.getElementById('windowControlIcon-maximize').src = 'icons/maximize.png';
  } else {
    BrowserWindow.getFocusedWindow().maximize();
    document.getElementById('windowControlIcon-maximize').src = 'icons/unmaximize.png';
  }
}

// Call startup procedures function
startup();
