import fetch from 'node-fetch'

export abstract class BaseCommenter {
  constructor(
    private readonly tokenEnvVar: string,
    private readonly headerTemplate: Record<string, string>
  ) {}

  protected getHeaders(): Record<string, string> | null {
    const token = process.env[this.tokenEnvVar]
    if (!token) return null
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(this.headerTemplate)) {
      headers[key] = value.replace('{token}', token)
    }
    return headers
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async fetchFromUrl(url: string, init: any): Promise<any> {
    const headers = this.getHeaders()
    if (!headers) {
      return null
    }
    return fetch(url, { ...init, headers })
  }

  protected async fetchCommentsFromUrl(
    url: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    agent?: any
  ): Promise<{ data: unknown[]; status: number; jsonAvailable: boolean }> {
    const response = await this.fetchFromUrl(url, { agent })
    if (!response) {
      return { data: [], status: 0, jsonAvailable: false }
    }

    if (typeof response.json !== 'function') {
      return { data: [], status: response.status, jsonAvailable: false }
    }
    return {
      data: (await response.json()) as unknown[],
      status: response.status,
      jsonAvailable: true
    }
  }

  protected async deleteCommentFromUrl(
    url: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    agent?: any
  ) {
    await this.fetchFromUrl(url, { method: 'DELETE', agent })
  }
}
