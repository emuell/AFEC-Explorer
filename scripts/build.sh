#!/bin/bash

cd `dirname -- $0`; SCRIPT_DIR=`pwd`
cd "${SCRIPT_DIR}/.." || exit 1

# install npm packages 
if [[ $1 != "--skip-install" ]]; then
  echo "** installing npm packages..."
  npm i || exit 1
fi

# build
echo "** building..."
npm run tauri build || exit 1
