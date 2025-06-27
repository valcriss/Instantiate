export function getWorkingPath(): string {
  return process.env.WORKING_PATH ?? '/tmp'
}
