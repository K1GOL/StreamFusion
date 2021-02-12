# Changelog

This is a log of all the changes made to StreamFusion

## 1.1.4

* License and legal information has changed. Please take time to review them.

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
