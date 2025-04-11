import mqtt, { MqttClient } from 'mqtt'
import logger from '../utils/logger'
import { MergeRequestPayload } from '../types/MergeRequestPayload'

let client: MqttClient

export function initializeMQTTClient(brokerUrl: string = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883') {
  client = mqtt.connect(brokerUrl)

  client.on('connect', () => {
    logger.info('[mqtt] Connected to broker')
  })

  client.on('error', (err) => {
    logger.info('[mqtt] Error:', err.message)
  })

  return client
}

export function publishUpdateEvent(data: { payload: MergeRequestPayload; projectKey: string }) {
  if (!client) {
    return
  }
  client.publish('instantiate/update', JSON.stringify(data))
}

export async function closeConnection() {
  if (!client) {
    return Promise.resolve(undefined)
  }
  return new Promise((resolve, reject) => {
    client.end(false, {}, (err) => {
      if (err) {
        logger.error('[mqtt] Error closing connection:', err)
        return reject(err)
      }
      logger.info('[mqtt] Connection closed')
      resolve(undefined)
    })
  })
}
