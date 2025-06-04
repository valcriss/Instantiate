import fs from 'fs/promises'

export async function removeDirectory(path: string): Promise<boolean> {
  let attempts = 0
  const maxAttempts = 3
  while (attempts < maxAttempts) {
    try {
      await fs.rm(path, { recursive: true, force: true })
      return true
    } catch (err) {
      attempts++
      if (attempts >= maxAttempts) {
        return false
      }
    }
  }
  /* istanbul ignore next */
  return false
}

export async function createDirectory(path: string): Promise<boolean> {
  let attempts = 0
  const maxAttempts = 3
  while (attempts < maxAttempts) {
    try {
      await fs.mkdir(path, { recursive: true })
      return true
    } catch (err) {
      attempts++
      if (attempts >= maxAttempts) {
        return false
      }
    }
  }
  /* istanbul ignore next */
  return false
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath)
    return true
  } catch (err) {
    return false
  }
}

export async function directoryExists(directoryPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(directoryPath)
    return stats.isDirectory()
  } catch (err) {
    return false
  }
}
