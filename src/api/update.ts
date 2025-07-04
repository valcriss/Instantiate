import express from 'express'
import logger from '../utils/logger'
import { parseGitlabWebhook } from '../providers/gitlab'
import { parseGithubWebhook } from '../providers/github'
import { ensureMQTTClientIsInitialized, publishUpdateEvent } from '../mqtt/MQTTClient'
import { MergeRequestPayload } from '../types/MergeRequestPayload'

const router = express.Router()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.post('/update', async (req: any, res: any) => {
  logger.debug('[api] Incoming webhook', {
    query: req.query,
    headers: req.headers
  })

  const projectKey = req.query.key as string
  const headers = req.headers

  if (!projectKey) {
    logger.warn('[api] Missing project key')
    return res.status(400).json({ error: 'Missing project key in query' })
  }

  let provider: 'gitlab' | 'github' | null = null

  if ('x-gitlab-event' in headers) {
    provider = 'gitlab'
  } else if ('x-github-event' in headers) {
    provider = 'github'
  }

  logger.debug('[api] Determined provider', provider)

  if (!provider) {
    logger.warn('[api] Unsupported source control provider')
    return res.status(400).json({ error: 'Unsupported source control provider' })
  }

  try {
    const payload = provider === 'gitlab' ? parseGitlabWebhook(req.body) : parseGithubWebhook(req.body)

    logger.info(`[api] Received ${payload.status} event for MR #${payload.mr_id} from ${provider}`)

    enqueueUpdateEvent({ payload, projectKey })

    res.status(200).json({ success: true })
  } catch (err: unknown) {
    logger.error({ err }, '[api] Error handling webhook')
    res.status(500).json({ error: 'Internal error', err: (err as Error).message })
  }
})

export function enqueueUpdateEvent(data: { payload: MergeRequestPayload; projectKey: string }) {
  try {
    ensureMQTTClientIsInitialized()
    publishUpdateEvent(data)
  } catch (err) {
    logger.error({ err }, '[api] Failed to enqueue update event')
  }
}

export default router
