#!/bin/sh
cd /app
npm run build
npm run migrate:up
exec pm2-runtime ./ecosystem.prod.config.js