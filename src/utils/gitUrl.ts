export function injectCredentialsIfMissing(url: string, username: string | undefined, token: string | undefined): string {
  if (!username || !token) {
    return url
  }
  const hasCreds = /^https?:\/\/[^@]+@/.test(url)
  if (hasCreds) {
    return url
  }
  const creds = `${username}:${token}`
  if (url.startsWith('https://')) {
    return url.replace('https://', `https://${creds}@`)
  }
  if (url.startsWith('http://')) {
    return url.replace('http://', `http://${creds}@`)
  }
  return url
}
