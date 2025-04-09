import { MergeRequestPayload } from '../types/MergeRequestPayload'

export function parseGithubWebhook(body: any): MergeRequestPayload {
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
