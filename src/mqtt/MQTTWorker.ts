import mqtt, { MqttClient } from 'mqtt'
import { StackManager } from '../core/StackManager'
import logger from '../utils/logger'

export function ensureMQTTWorkerIsInitialized() {
  if (!client) {
    initializeMQTTWorker()
  }
}
let client: MqttClient

export function initializeMQTTWorker(brokerUrl: string = process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883') {
  client = mqtt.connect(brokerUrl)

  client.on('error', (err) => {
    logger.error('[mqtt-worker] Error:', err)
  })

  client.on('connect', () => {
    logger.info('[mqtt-worker] MQTT worker started')
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
      logger.error('[mqtt-worker] Error processing message:', err)
      logger.error(err)
    }
  })

  return client
}
