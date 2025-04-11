module.exports = {
  apps: [
    {
      name: 'mqtt-worker',
      script: './src/mqtt/MQTTWorker.ts',
      out_file: '/dev/stdout',
      error_file: '/dev/stderr'
    }
  ]
}
