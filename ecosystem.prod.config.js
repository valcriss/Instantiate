module.exports = {
  apps: [
    {
      name: 'mqtt-worker',
      script: './dist/mqtt/MQTTService.js',
      log_type: 'raw',
      watch: false,
      instances: 1,
      autorestart: true
    },
    {
      name: 'instantiate-api',
      script: 'dist/server.js',
      log_type: 'raw',
      instances: 1,
      autorestart: true,
      watch: false
    }
  ]
}
