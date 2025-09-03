import mqtt, { MqttClient } from 'mqtt'
import logger from '../utils/logger'
import { MergeRequestPayload } from '../types/MergeRequestPayload'

let client: MqttClient | null = null

export function ensureMQTTClientIsInitialized() {
  if (!client) {
    initializeMQTTClient()
  }
}

export function initializeMQTTClient(brokerUrl: string = process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883') {
  client = mqtt.connect(brokerUrl)

  client.on('connect', () => {
    logger.info('[mqtt-client] Connected to broker')
  })

  client.on('error', (err) => {
    logger.info({ err: err.message }, '[mqtt-client] Error')
    logger.error({ err }, '[mqtt-client] Error')
  })

  return client
}

export function publishUpdateEvent(data: { payload: MergeRequestPayload; projectKey: string }) {
  if (!client) {
    initializeMQTTClient()
  }
  client?.publish('instantiate/update', JSON.stringify(data))
}

export async function closeConnection() {
  if (!client) {
    return Promise.resolve(undefined)
  }
  return new Promise((resolve, reject) => {
    client?.end(false, {}, (err) => {
      if (err) {
        logger.error({ err }, '[mqtt-client] Error closing connection')
        return reject(err)
      }
      client = null
      logger.info('[mqtt-client] Connection closed')
      resolve(undefined)
    })
  })
}
