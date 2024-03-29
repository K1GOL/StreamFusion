# Changelog

This is a log of all the changes made to StreamFusion

## 1.3.2

### Fixes and changes:

* Updated dependencies.

* Misc. fixes.

## 1.3.1

### Fixes and changes:

* Shortcuts to toggle dev tools and reload now don't block keypresses in other windows. Shortcut to toggle dev tools is now Ctrl + I

* Tracks now get added to your play history only if they are played for longer than 15 seconds.

* Optimization.

* Fixed an issue with the track control button icons flickering when searching.

* Fixed a bug where spamming the enter key in the search bar would search and give the same results multiple times.

* Fixed multiple issues with the loading bar being turned off too early, or not being turned on at all.

* Centred the platform selector.

* Fixed an overlay size bug.

# 1.3.0

### Fixes and changes:

* Keyboard shortcut changes:

  * Shortcuts for reload and toggle dev tools now only work when the StreamFusion window is focused.

  * Media keys now work OS-wide.

* Fixed an issue where sometimes the download button would immediately try to delete the downloaded file and cause all kinds of problems.

* Button to manage playlists is now not visible on tracks that aren't in your library.

### New features:

* StreamFusion overlay: Tells you what music you are playing, when you don't have StreamFusion focused. You can turn this off in the settings.

* You can now rename tracks after adding them to your library.

## 1.2.2

### Fixes and changes:

* Source code now follows the JS Semistandard code style. This should have no end-user visible changes.

## 1.2.1

### Fixes and changes:

* Fixed an issue where playlists would appear empty when switching between playlists.

# 1.2.0

### Fixes and changes:

* Centred some elements in the player controls.

* Fixed a bug where playing next track would fail when the last track in the library was playing.

* Fixed the loading bar not showing during some procedures when it really should have been.

* Fixed a bug with the window content extending below the player controls.

* Fixed an issue with the checkboxes missing in the playlist manager.

* The library file is now read less frequently during normal operation. This significantly reduces disk usage and speeds up some operations, such as loading a playlist.

* Fixed a bug where the first track in a playlist could not be played if nothing else had been played before.

* Fixed a bug where the loading bar would be stuck on when the previous track was attempted to be played when it was the last item in the play history.

* Reorganized the menu and added some category separators.

### New features:

* Library import and export:

  * You can now export your music and playlists to a .sfd file.

  * You can now import music and playlists from a .sfd file.

* You can now manually import a local audio file to StreamFusion. For the time being you can only import mp3 files.

* Media keys now work when the StreamFusion window is focused. Supported keys are:

  * Play/pause

  * Next

  * Previous

## 1.1.4

* License and legal information has changed.

### Fixes and changes:

* Reorganized some code. There shouldn't be any end-user visible changes.

## 1.1.3

### Fixes and changes:

* Updated dependencies.

* Fixed the "Update available" dialog message to make sense.

* Change log now shows version number and has a link to full change log on Github repo.

* Color scheme changes:

  * Changed color scheme file structure.

  * Moved default schemes file.

  * Custom scheme file now allows for multiple custom schemes.

  * Slightly changed colors of the high contrast color scheme.

### New features:

* New color schemes:

  * Light

  * Midnight Blue

## 1.1.2

### Fixes and changes:

* Resized icon, included new sizes.

### New features:

* Change log entry for the latest update is now shown in the "About" window.
* Pressing the enter key in a text input will now do the same as clicking the confirm button.

## 1.1.1

### Fixes and changes:
* You can now postpone an update.
* Fix for a library file read error.

### New features:
* Cancel buttons in various modals.

# 1.1.0

### Fixes and changes:
* Fixed an issue with the settings file failing to be read on first start-up.
* Track controls (play, download, add to library, etc.) now have a pointer cursor when hovered over.
* Updated icon.

### New features:
* Self-updating capabilities.
* User data is now stored per environment.

## 1.0.4

### Fixes and changes:
* Fixed a bug where the library file error correction would permanently block the library file if it was empty.
* Buttons now have a pointer cursor when hovering over them.

### New features:
* Default window frame replaced with a custom, minimal version.
* Added new keyboard shortcuts:
  * Ctrl + Shift + I - Dev tools
  * Ctrl + R - Reload

## 1.0.3

### Fixes and changes:
* Fixed a bug where failed to read library file on start-up.
* Fixed a bug with playlists appearing multiple times in the sidebar.

## 1.0.2

### Fixes and changes:
* Fixed a library file read error on start-up.
* Updated homepage in package.json.
* "Manage playlist" -button now uses a different icon.
* Volume is now saved when it is changed. When you start. StreamFusion, volume will be set to the value it was left at.

### New features:
* New scrollbar.
* A new menu system.
* New License page.
* New About page.
* New user options menu and system, that allows changing the default search platform selection, as well as color schemes.
* New color schemes, including increased contrast and user defined.

## 1.0.1

### Fixes and changes:
* Misc. bugfixes.

### New features:
* Builds without errors.
* Works in production.
* Does anything without multiple error messages.

# 1.0.0

Initial release.
