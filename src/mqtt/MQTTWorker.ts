import mqtt from 'mqtt'
import { StackManager } from '../core/StackManager'
import logger from '../utils/logger'

const client = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883')

client.on('connect', () => {
  logger.info('[worker] MQTT worker started')
  client.subscribe('instantiate/update')
})

client.on('message', async (topic, message) => {
  try {
    const { payload, projectKey } = JSON.parse(message.toString())

    const stackManager = new StackManager()
    if (payload.status === 'open') {
      await stackManager.deploy(payload, projectKey)
    } else if (payload.status === 'closed') {
      await stackManager.destroy(payload, projectKey)
    }
  } catch (err) {
    logger.error('[worker] Error processing message:', err)
  }
})
