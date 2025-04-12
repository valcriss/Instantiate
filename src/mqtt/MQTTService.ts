import logger from '../utils/logger'
import { initializeMQTTWorker } from './MQTTWorker'

// Start the MQTT broker and client
function startMQTTBroker() {
  const brokerUrl = process.env.MQTT_BROKER_URL

  logger.info('[mqtt-service] Starting MQTT broker')
  logger.info(`[mqtt-service] Broker URL: ${brokerUrl}`)

  // Initialize the MQTT client
  initializeMQTTWorker(brokerUrl)

  logger.info('[mqtt-service] MQTT broker and client started')
}

// Start the broker when the file is executed
startMQTTBroker()
