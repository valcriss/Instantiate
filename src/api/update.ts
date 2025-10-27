import express from 'express'
import logger from '../utils/logger'
import { parseGitlabWebhook } from '../providers/gitlab'
import { parseGithubWebhook } from '../providers/github'
import { ensureMQTTClientIsInitialized, publishUpdateEvent } from '../mqtt/MQTTClient'
import { MergeRequestPayload } from '../types/MergeRequestPayload'
import { CommentService } from '../comments/CommentService'
import db from '../db'
import { ParsedWebhook } from '../types/ParsedWebhook'

const router = express.Router()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.post('/update', async (req: any, res: any) => {
  logger.debug(
    {
      query: req.query,
      headers: req.headers
    },
    '[api] Incoming webhook'
  )

  const projectKey = req.query.key as string
  const headers = req.headers

  if (!projectKey) {
    logger.warn('[api] Missing project key')
    return res.status(400).json({ error: 'Missing project key in query' })
  }

  let provider: 'gitlab' | 'github' | null = null

  let eventName: string | undefined

  if ('x-gitlab-event' in headers) {
    provider = 'gitlab'
    eventName = headers['x-gitlab-event'] as string | undefined
  } else if ('x-github-event' in headers) {
    provider = 'github'
    eventName = headers['x-github-event'] as string | undefined
  }

  logger.debug({ provider }, '[api] Determined provider')

  if (!provider) {
    logger.warn('[api] Unsupported source control provider')
    return res.status(400).json({ error: 'Unsupported source control provider' })
  }

  try {
    let parseResult: ParsedWebhook
    if (provider === 'gitlab') {
      parseResult = await parseGitlabWebhook(req.body, eventName)
    } else {
      parseResult = await parseGithubWebhook(req.body, eventName)
    }

    if (parseResult.kind === 'skipped') {
      logger.info(`[api] Skipping webhook processing: ${parseResult.reason}`)
      return res.status(200).json({ success: true, skipped: true, reason: parseResult.reason })
    }

    const { payload, forceDeploy } = parseResult

    const ignoredPrefix = process.env.IGNORE_BRANCH_PREFIX
    if (ignoredPrefix && payload.branch.startsWith(ignoredPrefix)) {
      logger.info(`[api] Ignoring branch ${payload.branch} due to prefix ${ignoredPrefix}`)
      await db.updateMergeRequest(payload, 'ignored')
      if (payload.status === 'open') {
        const commenter = CommentService.getCommenter(payload.provider)
        await commenter.postStatusComment(payload, 'ignored')
      }
      return res.status(200).json({ success: true })
    }

    const previousSha = await db.getMergeRequestCommitSha(payload.project_id, payload.mr_id)
    await db.updateMergeRequest(payload, payload.status)

    if (!forceDeploy && payload.status === 'open' && previousSha && previousSha === payload.sha) {
      logger.info(`[api] Skipping deployment for MR #${payload.mr_id} on project ${payload.project_id} because no code changes were detected`)
      return res.status(200).json({ success: true, skipped: true, reason: 'no_code_changes' })
    }

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
