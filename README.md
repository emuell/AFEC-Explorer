# AFEC GUI

This repository contains an experimental GUI for [AFEC](https://github.com/emuell/AFEC) using [Tauri](https://tauri.app).


## Features

- Shows high-level features of an AFEC high-level database in a grid.
- Shows a 2d t-SNE cluster from the afec high-level classification data.
- Hovering or clicking on a file in the table or map plays the audio file.


## Development

### Requirements

- Tauri: Rust and a C++ Compiler - see [Tauri's Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)
- NPM: Download at [Node.js](https://nodejs.org/en/)

### Building

- Install node dependencies via `npm install`
- Build and run a **development** build with hot-reloading: `npm run tauri dev`
- Build a **production** binary: `npm run tauri build`
