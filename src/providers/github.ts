import { MergeRequestPayload } from '../types/MergeRequestPayload'

type GithubReqBody = {
  pull_request: {
    id: number
    head: {
      ref: string
      sha: string
    }
    user: {
      login: string
    }
  }
  action: string
  repository: {
    full_name: string
  }
}

export function parseGithubWebhook(body: GithubReqBody): MergeRequestPayload {
  const pr = body.pull_request

  return {
    mr_id: pr.id.toString(),
    status: body.action === 'closed' ? 'closed' : 'open',
    branch: pr.head.ref,
    repo: body.repository.full_name,
    sha: pr.head.sha,
    author: pr.user.login
  }
}
