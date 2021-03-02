# StreamFusion
<img src="https://github.com/K1GOL/StreamFusion/blob/main/resources/icons/128x128.png" width="100" height="100">

[<img src="https://raw.githubusercontent.com/standard/semistandard/master/badge.svg" width="100" height="100">](https://github.com/standard/semistandard)

StreamFusion is a 100% free open-source music player and manager incorporating SoundCloud and YouTube music streaming in one single program. Get started with using StreamFusion right now by downloading the installer linked below.

## About StreamFusion

StreamFusion incorporates multiple music streaming services in one, and has many useful features, such as:
* Download music and play it offline
* Zero buffering in the middle of playback
* No ads

## Change log

See [changelog.md](https://github.com/K1GOL/StreamFusion/blob/main/changelog.md)

## Supported music streaming services

### Currently supported

* YouTube
* SoundCloud

### Will likely be/might be supported in the future

* Tidal

* Spotify

### Will not/cannot be supported

* Amazon Music

## Download StreamFusion

StreamFusion is currently available only for Windows.

Note: Your browser and Windows SmartScreen may warn you that the StreamFusion installer is not trusted. You can safely ignore these warnings.

Download the latest release from the [releases page](https://github.com/K1GOL/StreamFusion/releases)

## I found a bug. Can I report it?

Open a new issue in the [issues section.](https://github.com/K1GOL/StreamFusion/issues)

## For developers

Do you want to help develop StreamFusion, or just modify the code yourself? Then go ahead, StreamFusion is licensed under the [BSD 2-clause license.](https://en.wikipedia.org/wiki/BSD_licenses#2-clause_license_(%22Simplified_BSD_License%22_or_%22FreeBSD_License%22)

Code is styled according to the [JS Semistandard code style.](https://github.com/standard/semistandard)

### Download the code

Download the source code or clone the repo from the download button located at the top of this page.

### Install dependencies

Run `npm install` to install all required dependencies. After that, you should be ready to go.

### Test & build

All neccessary tools for testing are included (Mocha), but not yet implemented. TODO.

To build StreamFusion in the development environment, use `npm start`.

To build StreamFusion in the production environment, use `npm run release`. This will create an installer for you in the `dist` directory.

Note: It is recommended to use `"asar": false` in the build options, as enabling archiving will break @ffplay-installer.

## Other resources used

Built using electron-boilerplate by Jakub Szwacz (https://github.com/szwacz/electron-boilerplate)

Media controls icons by:

  Fasil (https://freeicons.io/profile/722), Bytesize icons set (https://freeicons.io/icon-list/bytesize-icons-3), Common style icons set (https://freeicons.io/icon-list/common-style-icons-7), https://freeicons.io/

icon king1 (https://freeicons.io/profile/3), Navigation arrows set (https://freeicons.io/icon-list/navigation-set-arrows), https://freeicons.io/

## License

See the LICENSE file. StreamFusion is distributed under the BSD 2-clause license.
