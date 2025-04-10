import mqtt from 'mqtt'
import logger from '../utils/logger'
import { MergeRequestPayload } from '../types/MergeRequestPayload'

const client = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883')

client.on('connect', () => {
  logger.info('[mqtt] Connected to broker')
})

client.on('error', (err) => {
  logger.info('[mqtt] Error:', err.message)
})

export function publishUpdateEvent(data: { payload: MergeRequestPayload; projectKey: string }) {
  client.publish('instantiate/update', JSON.stringify(data))
}
