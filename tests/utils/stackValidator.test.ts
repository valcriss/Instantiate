import { validateStackFile } from '../../src/utils/stackValidator'
import fs from 'fs/promises'
import YAML from 'yaml'
import fetch, { type Response } from 'node-fetch'

jest.mock('fs/promises')
jest.mock('yaml')

const mockFs = fs as jest.Mocked<typeof fs>
const mockYaml = YAML as unknown as { parse: jest.Mock }
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('validateStackFile', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('throws on invalid YAML', async () => {
    mockFs.readFile.mockResolvedValueOnce('bad')
    mockYaml.parse.mockImplementationOnce(() => {
      throw new Error('invalid')
    })
    await expect(validateStackFile('file.yml')).rejects.toThrow('Invalid YAML')
  })

  it('skips schema validation for kubernetes', async () => {
    mockFs.readFile.mockResolvedValueOnce('apiVersion: v1')
    mockYaml.parse.mockReturnValueOnce({})
    await expect(validateStackFile('all.yml')).resolves.toBeUndefined()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
