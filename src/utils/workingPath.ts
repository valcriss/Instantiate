export function getWorkingPath(): string {
  const envPath = process.env.WORKING_PATH
  if (envPath && envPath.trim() !== '') {
    return envPath
  }
  return '/tmp'
}
