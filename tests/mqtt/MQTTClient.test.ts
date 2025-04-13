import { initializeMQTTClient, publishUpdateEvent, closeConnection } from '../../src/mqtt/MQTTClient'
import mqtt from 'mqtt'
import logger from '../../src/utils/logger'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'

jest.mock('mqtt')
jest.mock('../../src/utils/logger')

describe('MQTTClient', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClient: any

  beforeEach(() => {
    mockClient = {
      publish: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      end: jest.fn((force: boolean, options: any, callback: (err?: Error) => void) => callback()),
      on: jest.fn()
    }
    ;(mqtt.connect as jest.Mock).mockReturnValue(mockClient)
    initializeMQTTClient()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('publishUpdateEvent', () => {
    it('should initialize the MQTT client if not already initialized', () => {
      const payload: MergeRequestPayload = {
        projectName: '',
        mergeRequestName: '',
        project_id: 'test-project',
        mr_id: 'mr-1',
        mr_iid: 'mr-1',
        status: 'open',
        branch: 'main',
        repo: 'test-repo',
        sha: '123456',
        author: 'tester',
        full_name: 'tester/test-repo',
        provider: 'github'
      }
      const projectKey = 'test-project'

      // Reset the client to undefined to simulate uninitialized state
      ;(mqtt.connect as jest.Mock).mockClear()
      closeConnection()
      publishUpdateEvent({ payload, projectKey })

      expect(mqtt.connect).toHaveBeenCalled()
      expect(mockClient.publish).toHaveBeenCalledWith('instantiate/update', JSON.stringify({ payload, projectKey }))
    })

    it('should publish the update event with the correct topic and payload', () => {
      const payload: MergeRequestPayload = {
        projectName: '',
        mergeRequestName: '',
        project_id: 'test-project',
        mr_id: 'mr-1',
        mr_iid: 'mr-1',
        status: 'open',
        branch: 'main',
        repo: 'test-repo',
        sha: '123456',
        author: 'tester',
        full_name: 'tester/test-repo',
        provider: 'github'
      }
      const projectKey = 'test-project'

      publishUpdateEvent({ payload, projectKey })

      expect(mockClient.publish).toHaveBeenCalledWith('instantiate/update', JSON.stringify({ payload, projectKey }))
    })
  })

  describe('closeConnection', () => {
    it('should close the MQTT connection successfully', async () => {
      await expect(closeConnection()).resolves.toBeUndefined()
      expect(mockClient.end).toHaveBeenCalledWith(false, {}, expect.any(Function))
      expect(logger.info).toHaveBeenCalledWith('[mqtt-client] Connection closed')
    })

    it('should log an error if closing the connection fails', async () => {
      const error = new Error('Close connection error')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockClient.end = jest.fn((force: boolean, options: any, callback: (err?: Error) => void) => callback(error))

      await expect(closeConnection()).rejects.toThrow('Close connection error')
      expect(logger.error).toHaveBeenCalledWith('[mqtt-client] Error closing connection:', error)
    })
  })

  describe('MQTT client events', () => {
    it('should log a message when connected to the broker', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connectCallback: () => void = mockClient.on.mock.calls.find((call: [string, (...args: any[]) => void]) => call[0] === 'connect')[1] as () => void
      connectCallback()

      expect(logger.info).toHaveBeenCalledWith('[mqtt-client] Connected to broker')
    })

    it('should log an error message when an error occurs', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorCallback: (error: Error) => void = mockClient.on.mock.calls.find((call: [string, (...args: any[]) => void]) => call[0] === 'error')[1] as (
        error: Error
      ) => void
      const error = new Error('Test error')
      errorCallback(error)

      expect(logger.info).toHaveBeenCalledWith('[mqtt-client] Error:', error.message)
    })
  })
})
