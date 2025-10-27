import fetch from 'node-fetch'
import { MergeRequestPayload } from '../types/MergeRequestPayload'
import { injectCredentialsIfMissing } from '../utils/gitUrl'
import { ParsedWebhook } from '../types/ParsedWebhook'

type GithubPullRequestBody = {
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

type GithubCommentBody = {
  comment: {
    body: string
  }
  issue?: {
    number: number
    pull_request?: Record<string, unknown>
  }
  repository: {
    full_name: string
    clone_url: string
    id: string
  }
}

type GithubPullRequestResponse = {
  id: number
  number: number
  title: string
  head: {
    ref: string
    sha: string
  }
  user: {
    login: string
  }
  state: string
}

function buildGithubPayload(body: GithubPullRequestBody['pull_request'], repository: GithubPullRequestBody['repository'], action: string): MergeRequestPayload {
  let url = repository.clone_url
  if (process.env.NODE_ENV === 'development') {
    url = url.replace('localhost', 'host.docker.internal')
  }
  url = injectCredentialsIfMissing(url, process.env.REPOSITORY_GITHUB_USERNAME, process.env.REPOSITORY_GITHUB_TOKEN)

  return {
    project_id: repository.id,
    mr_id: body.id.toString(),
    projectName: repository.full_name,
    mergeRequestName: body.title,
    mr_iid: body.number.toString(),
    full_name: repository.full_name,
    status: action === 'closed' ? 'closed' : 'open',
    branch: body.head.ref,
    repo: url,
    sha: body.head.sha,
    author: body.user.login,
    provider: 'github'
  }
}

function isDeployCommand(comment?: string): boolean {
  if (!comment) return false
  return comment.trim().toLowerCase() === 'instantiate deploy'
}

async function fetchPullRequestDetails(repository: string, prNumber: number): Promise<GithubPullRequestResponse | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json'
  }
  const token = process.env.REPOSITORY_GITHUB_TOKEN
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`https://api.github.com/repos/${repository}/pulls/${prNumber}`, {
    method: 'GET',
    headers
  })

  if (!response.ok) {
    return null
  }

  return (await response.json()) as GithubPullRequestResponse
}

export async function parseGithubWebhook(body: GithubPullRequestBody | GithubCommentBody, event: string | undefined): Promise<ParsedWebhook> {
  if (event === 'pull_request') {
    const payload = buildGithubPayload(
      (body as GithubPullRequestBody).pull_request,
      (body as GithubPullRequestBody).repository,
      (body as GithubPullRequestBody).action
    )
    return { kind: 'handled', payload, forceDeploy: false }
  }

  if (event === 'issue_comment') {
    const commentBody = body as GithubCommentBody
    if (!commentBody.issue?.pull_request) {
      return { kind: 'skipped', reason: 'comment_not_pr' }
    }

    if (!isDeployCommand(commentBody.comment?.body)) {
      return { kind: 'skipped', reason: 'comment_not_command' }
    }

    const prDetails = await fetchPullRequestDetails(commentBody.repository.full_name, commentBody.issue.number)
    if (!prDetails) {
      return { kind: 'skipped', reason: 'missing_pull_request' }
    }

    const payload = buildGithubPayload(
      {
        id: prDetails.id,
        number: prDetails.number,
        head: prDetails.head,
        user: prDetails.user,
        title: prDetails.title
      },
      commentBody.repository,
      prDetails.state === 'closed' ? 'closed' : 'open'
    )

    payload.status = payload.status === 'closed' ? 'open' : payload.status

    return { kind: 'handled', payload, forceDeploy: true }
  }

  return { kind: 'skipped', reason: 'unsupported_event' }
}
