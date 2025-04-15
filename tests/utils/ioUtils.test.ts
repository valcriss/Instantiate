import { removeDirectory, createDirectory, fileExists, directoryExists } from '../../src/utils/ioUtils'
import fs from 'fs/promises'

jest.mock('fs/promises')

describe('ioUtils', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('removeDirectory', () => {
    it('should remove a directory successfully', async () => {
      ;(fs.rm as jest.Mock).mockResolvedValue(undefined)
      const result = await removeDirectory('/path/to/dir')
      expect(result).toBe(true)
      expect(fs.rm).toHaveBeenCalledWith('/path/to/dir', { recursive: true, force: true })
    })

    it('should return false after max attempts', async () => {
      ;(fs.rm as jest.Mock).mockRejectedValue(new Error('Failed to remove'))
      const result = await removeDirectory('/path/to/dir')
      expect(result).toBe(false)
      expect(fs.rm).toHaveBeenCalledTimes(3)
    })
  })

  describe('createDirectory', () => {
    it('should create a directory successfully', async () => {
      ;(fs.mkdir as jest.Mock).mockResolvedValue(undefined)
      const result = await createDirectory('/path/to/dir')
      expect(result).toBe(true)
      expect(fs.mkdir).toHaveBeenCalledWith('/path/to/dir', { recursive: true })
    })

    it('should return false after max attempts', async () => {
      ;(fs.mkdir as jest.Mock).mockRejectedValue(new Error('Failed to create'))
      const result = await createDirectory('/path/to/dir')
      expect(result).toBe(false)
      expect(fs.mkdir).toHaveBeenCalledTimes(3)
    })
  })

  describe('fileExists', () => {
    it('should return true if the file exists', async () => {
      ;(fs.stat as jest.Mock).mockResolvedValue({})
      const result = await fileExists('/path/to/file')
      expect(result).toBe(true)
      expect(fs.stat).toHaveBeenCalledWith('/path/to/file')
    })

    it('should return false if the file does not exist', async () => {
      ;(fs.stat as jest.Mock).mockRejectedValue(new Error('File not found'))
      const result = await fileExists('/path/to/file')
      expect(result).toBe(false)
    })
  })

  describe('directoryExists', () => {
    it('should return true if the directory exists', async () => {
      ;(fs.stat as jest.Mock).mockResolvedValue({ isDirectory: () => true })
      const result = await directoryExists('/path/to/dir')
      expect(result).toBe(true)
      expect(fs.stat).toHaveBeenCalledWith('/path/to/dir')
    })

    it('should return false if the directory does not exist', async () => {
      ;(fs.stat as jest.Mock).mockRejectedValue(new Error('Directory not found'))
      const result = await directoryExists('/path/to/dir')
      expect(result).toBe(false)
    })

    it('should return false if the path is not a directory', async () => {
      ;(fs.stat as jest.Mock).mockResolvedValue({ isDirectory: () => false })
      const result = await directoryExists('/path/to/dir')
      expect(result).toBe(false)
    })
  })
})
