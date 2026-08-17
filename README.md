# 🎬 YT Studio Pro & ToffeeShare P2P Suite

A modern, high-performance desktop application built with **Electron**, **Node.js**, **yt-dlp**, and **FFmpeg**. Features a native YouTube search & download engine, Cinema media player, multi-tab Research Browser with an Extensions Hub, and a **ToffeeShare-style direct App-to-App P2P streaming system**.

---

## 🌟 Key Features

### 1. 📥 YouTube Downloader & Cinema Streamer
* **High-Speed Downloads**: Up to 4K 60fps video downloads, 320kbps MP3s, and M4A audio.
* **Instant Cinema Player**: Stream and watch YouTube videos or local downloads in a sleek cinema UI with playback speed controls, seek bar, and fullscreen support.
* **Custom Save Locations & Library**: Organize downloaded media directly into your local library with 1-click Finder / File Explorer access.

### 2. 🌐 Multi-Tab Research Browser & Extensions Hub
* **Multi-Tab Web Navigation**: Chromium & Firefox ergonomics with dynamic tab strip, favicons, loading spinners, and macOS draggable title bar.
* **Extensions Hub**:
  * 🛡️ **AdBlock**: CSS injection blocking ads and sponsored overlays.
  * 🌙 **Dark Reader**: Automatic dark-mode contrast inverter for all websites.
  * 📖 **Reader Mode**: Distraction-free article extraction.
  * 📺 **Picture-in-Picture (PiP)**: Pop-out web videos.
  * 📱 **User-Agent Switcher**: Emulate iPhone, iPad, Android, or Mac Safari.
  * 🛠️ **DevTools & Userscripts**: In-browser developer tools and custom JavaScript execution.
* **Pinned Quick Apps**: Firefox-style bookmark grid with vector brand icons (ChatGPT, DeepSeek, GitHub, Reddit, Spotify, etc.).

### 3. ⚡ ToffeeShare App-to-App Direct P2P Stream
* **100% Direct Stream (Zero Cloud)**: Files stream directly from sender memory/disk to receiver disk over local Wi-Fi at gigabit speeds without uploading to any cloud server.
* **Pure App-to-App Experience**: No external browser or web link required.
* **Local LAN Auto-Discovery (UDP Radar)**: Apps on the same Wi-Fi network automatically detect each other for 1-click file sending and receiving.
* **6-Digit Pairing Code**: Secure 1-to-1 pairing handshake via 6-digit PIN codes (e.g. `582 910`).
* **Live Speedometer & Progress**: Real-time tracking of transfer speed (MB/s), ETA, and completed bytes.

---

## 🏗️ Architecture & Project Structure

```
yt_downloader/
├── main.js                     # Electron main process entry point & window configuration
├── preload.js                  # Secure ContextBridge IPC bindings
├── package.json                # NPM configuration, dependencies & build scripts
├── .gitignore                  # Git exclusion rules
│
├── src/
│   └── main/
│       ├── ipcHandlers.js      # Centralized IPC dispatcher
│       ├── config/paths.js     # Universal binary path resolution
│       └── services/
│           ├── youtubeService.js   # YouTube search & metadata extraction
│           ├── downloadService.js  # yt-dlp & FFmpeg chunked download manager
│           ├── libraryService.js   # Local file management & folder picker
│           └── p2pShareService.js  # ToffeeShare HTTP streaming & UDP discovery engine
│
├── renderer/
│   ├── index.html              # Core application layout & view templates
│   ├── styles.css              # Master CSS manifest
│   ├── styles/                 # Modular CSS design system (Dark Mode & Glassmorphism)
│   │   ├── variables.css       # Color tokens, typography, and spacing
│   │   ├── layout.css          # Frameless window, sidebar, and grid layout
│   │   ├── components.css      # Cards, omnibar, buttons, and badges
│   │   ├── player.css          # Cinema player controls & overlay
│   │   ├── browser.css         # Multi-tab research browser & extensions hub
│   │   ├── share.css           # ToffeeShare P2P direct share & radar styles
│   │   └── modals.css          # Onboarding, settings, and script modals
│   └── modules/                # Modular ES6 controllers
│       ├── state.js            # App state & LocalStorage persistence
│       ├── navigation.js       # View switcher & sidebar controller
│       ├── searchFeed.js       # YouTube search & infinite scroll
│       ├── videoPlayer.js      # Cinema video player controller
│       ├── downloadManager.js  # Download queue & progress tracking
│       ├── libraryManager.js   # Saved files gallery & play triggers
│       ├── browserManager.js   # Webview tab management & extension runner
│       ├── p2pShareManager.js  # ToffeeShare App-to-App P2P client controller
│       ├── settingsModal.js    # Preferences & download folder configuration
│       └── onboardingModal.js  # First-time user setup wizard
│
├── bin/                        # Bundled standalone cross-platform binaries
│   ├── darwin/                 # macOS ffmpeg & yt-dlp
│   └── win32/                  # Windows x64 ffmpeg.exe & yt-dlp.exe
│
└── scripts/
    └── pack-clean.js           # Automated standalone packager for macOS & Windows x64
```

---

## 🚀 Getting Started & Setup Guide

### 1. Prerequisites
Ensure you have the following installed on your development machine:
* **Node.js**: v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
* **Git**: ([Download Git](https://git-scm.com/))

---

### 2. Installation & Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/neginikhil85/yt-downloader.git
   cd yt-downloader
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Run in Development Mode**:
   ```bash
   npm start
   ```

---

### 3. Running in Development Mode

To launch the app with hot reloading and developer tools:
```bash
npm start
```

---

## 📦 Packaging Standalone Applications

To generate clean, production-ready standalone executables for macOS and Windows:

```bash
npm run pack:clean
```

### Generated Output Locations:
* **🍏 macOS Standalone**:
  ```
  release/mac/bruno.app
  ```
* **🪟 Windows x64 Standalone**:
  ```
  release/windows/bruno.exe              # Unpacked standalone folder
  release/windows-portable.zip           # Ready-to-share portable zip
  ```

---

## 🛠️ Technology Stack

| Component | Technology |
|:---|:---|
| **Framework** | Electron 34+ |
| **Frontend** | Vanilla HTML5, ES6 Modules, Modern CSS3 (Dark Glassmorphism) |
| **Media Extraction** | yt-dlp & FFmpeg |
| **P2P Transfer Engine** | Node.js HTTP Streaming, UDP Multicast Discovery (`dgram`), SSE |
| **Target OS** | macOS (Apple Silicon & Intel), Windows 10/11 (x86-64 Universal), Linux |

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
