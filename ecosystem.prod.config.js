module.exports = {
  apps: [
    {
      name: 'mqtt-worker',
      script: '/app/mqtt/MQTTWorker.js',
      out_file: '/dev/stdout',
      error_file: '/dev/stderr'
    }
  ]
}
