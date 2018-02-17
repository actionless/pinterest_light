#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

XPI_NAME=pinterest_light.xpi

rm ${XPI_NAME}
7z a ${XPI_NAME} manifest.json background.js icons
