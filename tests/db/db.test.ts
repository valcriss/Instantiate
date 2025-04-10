import db from '../../src/db'
import { Pool } from 'pg'

// On mocke pg.Pool
jest.mock('pg', () => {
  const mClient = { query: jest.fn(), connect: jest.fn() }
  const mPool = jest.fn(() => mClient)
  return { Pool: mPool }
})

describe('db/index.ts', () => {
  it('appelle pool.query avec les bons arguments', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    mockPoolInstance.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })

    const result = await db.query('SELECT * FROM test WHERE id = $1', [1])

    expect(mockPoolInstance.query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1])
    expect(result).toEqual({ rows: [{ id: 1 }] })
  })

  it('appelle pool.connect', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    mockPoolInstance.connect.mockResolvedValueOnce('mockClient')

    const client = await db.getClient()
    expect(mockPoolInstance.connect).toHaveBeenCalled()
    expect(client).toBe('mockClient')
  })
})
