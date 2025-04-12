module.exports = {
  apps: [
    {
      name: 'mqtt-worker',
      script: './src/mqtt/MQTTService.ts',
      log_type: 'raw',
      output: '/dev/stdout',
      error: '/dev/stderr',
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
