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
    clone_url: string
    id: string
  }
}

export function parseGithubWebhook(body: GithubReqBody): MergeRequestPayload {
  const pr = body.pull_request

  return {
    project_id: body.repository.id,
    mr_id: pr.id.toString(),
    status: body.action === 'closed' ? 'closed' : 'open',
    branch: pr.head.ref,
    repo: body.repository.clone_url,
    sha: pr.head.sha,
    author: pr.user.login
  }
}
