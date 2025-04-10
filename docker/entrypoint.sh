npm install --global pm2
npm ci
npm run build
pm2 start dist/mqtt/MQTTWorker.js --name worker:mqtt
npm run start