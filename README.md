# AFEC GUI

This repository contains an experimental GUI for [AFEC](https://github.com/emuell/AFEC) using [Tauri](https://tauri.app).


## Features

- Shows high-level features of an afec database in a table.
- Shows a 2d t-SNE cluster from the afec high-level classification data.
- TODO/WIP: Clicking on a file in the table or map plays the audio file and shows the sample waveform.


## Development

### Requirements

- Tauri: Rust and a C++ Compiler - see [Tauri's Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)
- NPM: Download at [Node.js](https://nodejs.org/en/)

### Building

- Development with hot-reloading `npm run tauri dev`
- Release packages `npm run tauri build`
