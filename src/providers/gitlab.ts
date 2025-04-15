import { MergeRequestPayload } from '../types/MergeRequestPayload'

type GitlabReqBody = {
  object_attributes: {
    id: number
    iid: number
    title: string
    state: string
    source_branch: string
    last_commit: {
      id: string
    }
    author_id: number
  }
  project: {
    id: string
    name: string
    git_http_url: string
  }
}

export function parseGitlabWebhook(body: GitlabReqBody): MergeRequestPayload {
  const mr = body.object_attributes
  let authentification = null
  let url = body.project.git_http_url
  if (process.env.REPOSITORY_GITLAB_USERNAME && process.env.REPOSITORY_GITLAB_TOKEN) {
    authentification = `${process.env.REPOSITORY_GITLAB_USERNAME}:${process.env.REPOSITORY_GITLAB_TOKEN}`
  }
  if (process.env.NODE_ENV === 'development') {
    url = url.replace('localhost', 'host.docker.internal')
  }
  if (authentification) {
    url = url.replace('https://', `https://${authentification}@`)
    url = url.replace('http://', `http://${authentification}@`)
  }
  return {
    project_id: body.project.id,
    projectName: body.project.name,
    mergeRequestName: mr.title,
    mr_id: mr.id.toString(),
    mr_iid: mr.iid.toString(),
    full_name: body.project.id,
    status: ['closed', 'merged'].includes(mr.state) ? 'closed' : 'open',
    branch: mr.source_branch,
    repo: url,
    sha: mr.last_commit.id,
    author: mr.author_id.toString(),
    provider: 'gitlab'
  }
}
