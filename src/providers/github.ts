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
  let authentification = null
  let url = body.repository.clone_url
  if (process.env.REPOSITORY_GITHUB_USERNAME && process.env.REPOSITORY_GITHUB_PASSWORD) {
    authentification = `${process.env.REPOSITORY_GITHUB_USERNAME}:${process.env.REPOSITORY_GITHUB_PASSWORD}`
  }
  if (process.env.NODE_ENV === 'development') {
    url = url.replace('localhost', 'host.docker.internal')
  }
  if (authentification) {
    url = url.replace('https://', `https://${authentification}@`)
    url = url.replace('http://', `http://${authentification}@`)
  }
  return {
    project_id: body.repository.id,
    mr_id: pr.id.toString(),
    status: body.action === 'closed' ? 'closed' : 'open',
    branch: pr.head.ref,
    repo: url,
    sha: pr.head.sha,
    author: pr.user.login
  }
}
