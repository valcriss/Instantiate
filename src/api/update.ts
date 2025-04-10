import express from 'express'
import logger from '../utils/logger'
import { parseGitlabWebhook } from '../providers/gitlab'
import { parseGithubWebhook } from '../providers/github'
import { StackManager } from '../core/StackManager'

const router = express.Router()

router.post('/update', async (req: any, res: any) => {
  const projectKey = req.query.key as string
  const headers = req.headers

  if (!projectKey) {
    logger.warn('Missing project key')
    return res.status(400).json({ error: 'Missing project key in query' })
  }

  let provider: 'gitlab' | 'github' | null = null

  if ('x-gitlab-event' in headers) {
    provider = 'gitlab'
  } else if ('x-github-event' in headers) {
    provider = 'github'
  }

  if (!provider) {
    logger.warn('Unknown SCM provider')
    return res.status(400).json({ error: 'Unsupported source control provider' })
  }

  try {
    const payload =
      provider === 'gitlab'
        ? parseGitlabWebhook(req.body)
        : parseGithubWebhook(req.body)

    logger.info(
      `Received ${payload.status} event for MR #${payload.mr_id} from ${provider}`
    )

    const stackManager = new StackManager()

    if (payload.status === 'open') {
      await stackManager.deploy(payload, projectKey)
    } else if (payload.status === 'closed') {
      await stackManager.destroy(payload, projectKey)
    }

    res.status(200).json({ success: true })
  } catch (err: any) {
    logger.error({ err }, 'Error handling webhook')
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router
