# AFEC GUI

This repository contains an experimental GUI for [AFEC](https://github.com/emuell/AFEC) using [Tauri](https://tauri.app).


## Features

Shows high-level features of an afec database in a table.

TODO/WIP: Clicking on an entry in the table shows the sample waveform and plays the audio file.
TODO/WIP: Shows a 2d t-SNE cluster from the afec high-level classification data in sync with the table.


## Development

### Requirements

- Tauri: Rust and a C++ Compiler - see [Tauri's Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)
- NPM: Download at [Node.js](https://nodejs.org/en/)

### Building

- Development with hot-reloading `npm run tauri dev`
- Release packages `npm run tauri build`
