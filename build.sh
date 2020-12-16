#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

XPI_NAME=pinterest_light.xpi

if [[ -f "$XPI_NAME" ]] ; then
	rm "$XPI_NAME"
fi
7z a "$XPI_NAME" manifest.json background.js content.js icons
