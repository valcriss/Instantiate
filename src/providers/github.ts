import { MergeRequestPayload } from '../types/MergeRequestPayload'
import { injectCredentialsIfMissing } from '../utils/gitUrl'

type GithubReqBody = {
  pull_request: {
    id: number
    number: number
    head: {
      ref: string
      sha: string
    }
    user: {
      login: string
    }
    title: string
  }
  action: string
  repository: {
    full_name: string
    clone_url: string
    id: string
  }
}

export function parseGithubWebhook(body: GithubReqBody): MergeRequestPayload {
  const pr = body.pull_request
  let url = body.repository.clone_url
  if (process.env.NODE_ENV === 'development') {
    url = url.replace('localhost', 'host.docker.internal')
  }
  url = injectCredentialsIfMissing(url, process.env.REPOSITORY_GITHUB_USERNAME, process.env.REPOSITORY_GITHUB_TOKEN)
  return {
    project_id: body.repository.id,
    mr_id: pr.id.toString(),
    projectName: body.repository.full_name,
    mergeRequestName: pr.title,
    mr_iid: pr.number.toString(),
    full_name: body.repository.full_name,
    status: body.action === 'closed' ? 'closed' : 'open',
    branch: pr.head.ref,
    repo: url,
    sha: pr.head.sha,
    author: pr.user.login,
    provider: 'github'
  }
}
