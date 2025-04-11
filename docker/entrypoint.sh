#!/bin/sh
set -e
pm2 start ./mqtt/MQTTWorker.js --name worker:mqtt
node server.js