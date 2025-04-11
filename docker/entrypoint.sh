#!/bin/sh
set -e
pm2 start ./ecosystem.prod.config.js
node server.js