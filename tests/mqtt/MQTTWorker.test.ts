import { initializeMQTTWorker, ensureMQTTWorkerIsInitialized } from '../../src/mqtt/MQTTWorker'
import mqtt from 'mqtt'
import logger from '../../src/utils/logger'
import { StackManager } from '../../src/core/StackManager'

jest.mock('mqtt')
jest.mock('../../src/utils/logger')
jest.mock('../../src/core/StackManager')

describe('MQTTWorker', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClient: any
  let mockDeploy: jest.Mock
  let mockDestroy: jest.Mock
  let messageCallback: (topic: string, message: Buffer) => Promise<void>

  beforeEach(() => {
    mockDeploy = jest.fn()
    mockDestroy = jest.fn()
    ;(StackManager as jest.Mock).mockImplementation(() => ({
      deploy: mockDeploy,
      destroy: mockDestroy
    }))

    mockClient = {
      on: jest.fn(),
      subscribe: jest.fn()
    }
    ;(mqtt.connect as jest.Mock).mockReturnValue(mockClient)

    initializeMQTTWorker()

    // Retrieve the message handler registered during initialization
    messageCallback = mockClient.on.mock.calls.find((c: unknown[]) => c[0] === 'message')[1]
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('calls deploy when message status is open', async () => {
    const payload = { status: 'open' }
    await messageCallback('instantiate/update', Buffer.from(JSON.stringify({ payload, projectKey: 'key' })))
    expect(mockDeploy).toHaveBeenCalledWith(payload, 'key')
  })

  it('calls destroy when message status is closed', async () => {
    const payload = { status: 'closed' }
    await messageCallback('instantiate/update', Buffer.from(JSON.stringify({ payload, projectKey: 'key' })))
    expect(mockDestroy).toHaveBeenCalledWith(payload, 'key')
  })

  it('logs errors for invalid JSON payloads', async () => {
    await messageCallback('instantiate/update', Buffer.from('{invalid'))
    expect(logger.error).toHaveBeenCalled()
  })

  it('logs errors when stack manager throws', async () => {
    const err = new Error('fail')
    mockDeploy.mockRejectedValueOnce(err)
    const payload = { status: 'open' }
    await messageCallback('instantiate/update', Buffer.from(JSON.stringify({ payload, projectKey: 'key' })))
    expect(logger.error).toHaveBeenCalledWith('[mqtt-worker] Error processing message:', err)
    expect(logger.error).toHaveBeenCalledWith(err)
  })

  it('ignores message when status is unknown', async () => {
    const payload = { status: 'unknown' }
    await messageCallback('instantiate/update', Buffer.from(JSON.stringify({ payload, projectKey: 'key' })))
    expect(mockDeploy).not.toHaveBeenCalled()
    expect(mockDestroy).not.toHaveBeenCalled()
  })

  it('subscribes to updates on connect', () => {
    const connectCallback = mockClient.on.mock.calls.find((c: unknown[]) => c[0] === 'connect')[1]
    connectCallback()
    expect(logger.info).toHaveBeenCalledWith('[mqtt-worker] MQTT worker started')
    expect(mockClient.subscribe).toHaveBeenCalledWith('instantiate/update')
  })

  it('logs errors when an error occurs', () => {
    const errorCallback = mockClient.on.mock.calls.find((c: unknown[]) => c[0] === 'error')[1]
    const err = new Error('mqtt error')
    errorCallback(err)
    expect(logger.error).toHaveBeenCalledWith('[mqtt-worker] Error:', err)
  })

  it('initializes when ensureMQTTWorkerIsInitialized is called', () => {
    jest.resetModules()
    const mqttMock = require('mqtt') as { connect: jest.Mock }
    mqttMock.connect.mockReturnValue(mockClient)
    const { ensureMQTTWorkerIsInitialized: ensureInit } = require('../../src/mqtt/MQTTWorker')
    ensureInit()
    expect(mqttMock.connect).toHaveBeenCalled()
  })

  it('does not initialize again if client already exists', () => {
    ensureMQTTWorkerIsInitialized()
    expect(mqtt.connect).toHaveBeenCalledTimes(1)
  })
})
