import db from '../../src/db'
import { Pool } from 'pg'

// On mocke pg.Pool
jest.mock('pg', () => {
  const mClient = { query: jest.fn(), connect: jest.fn() }
  const mPool = jest.fn(() => mClient)
  return { Pool: mPool }
})

describe('db/index.ts', () => {
  it('appelle pool.connect', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    mockPoolInstance.connect.mockResolvedValueOnce('mockClient')

    const client = await db.getClient()
    expect(mockPoolInstance.connect).toHaveBeenCalled()
    expect(client).toBe('mockClient')
  })
})
