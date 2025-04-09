import { MergeRequestPayload } from '../types/MergeRequestPayload'

export function parseGitlabWebhook(body: any): MergeRequestPayload {
  const mr = body.object_attributes

  return {
    mr_id: mr.id.toString(),
    status: ['closed', 'merged'].includes(mr.state) ? 'closed' : 'open',
    branch: mr.source_branch,
    repo: body.project.path_with_namespace,
    sha: mr.last_commit.id,
    author: mr.author_id.toString() // ou utiliser `user.username` si besoin
  }
}