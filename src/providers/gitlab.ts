import { MergeRequestPayload } from '../types/MergeRequestPayload'
import { injectCredentialsIfMissing } from '../utils/gitUrl'
import { ParsedWebhook } from '../types/ParsedWebhook'

type GitlabMergeRequestBody = {
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

type GitlabNoteBody = {
  object_attributes: {
    note: string
    noteable_type: string
  }
  merge_request?: {
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

function buildPayloadFromMergeRequest(body: GitlabMergeRequestBody['object_attributes'], project: GitlabMergeRequestBody['project']): MergeRequestPayload {
  let url = project.git_http_url
  if (process.env.NODE_ENV === 'development') {
    url = url.replace('localhost', 'host.docker.internal')
  }
  url = injectCredentialsIfMissing(url, process.env.REPOSITORY_GITLAB_USERNAME, process.env.REPOSITORY_GITLAB_TOKEN)

  return {
    project_id: project.id,
    projectName: project.name,
    mergeRequestName: body.title,
    mr_id: body.id.toString(),
    mr_iid: body.iid.toString(),
    full_name: project.id,
    status: ['closed', 'merged'].includes(body.state) ? 'closed' : 'open',
    branch: body.source_branch,
    repo: url,
    sha: body.last_commit.id,
    author: body.author_id.toString(),
    provider: 'gitlab'
  }
}

function isDeployCommand(comment?: string): boolean {
  if (!comment) return false
  return comment.trim().toLowerCase() === 'instantiate deploy'
}

export async function parseGitlabWebhook(body: GitlabMergeRequestBody | GitlabNoteBody, event: string | undefined): Promise<ParsedWebhook> {
  if (event === 'Merge Request Hook') {
    const payload = buildPayloadFromMergeRequest((body as GitlabMergeRequestBody).object_attributes, (body as GitlabMergeRequestBody).project)
    return { kind: 'handled', payload, forceDeploy: false }
  }

  if (event === 'Note Hook') {
    const noteBody = body as GitlabNoteBody
    if (noteBody.object_attributes?.noteable_type !== 'MergeRequest') {
      return { kind: 'skipped', reason: 'unsupported_noteable' }
    }

    if (!isDeployCommand(noteBody.object_attributes?.note)) {
      return { kind: 'skipped', reason: 'comment_not_command' }
    }

    if (!noteBody.merge_request) {
      return { kind: 'skipped', reason: 'missing_merge_request' }
    }

    const payload = buildPayloadFromMergeRequest(noteBody.merge_request as GitlabMergeRequestBody['object_attributes'], noteBody.project)
    // Ensure we always treat forced deployments as open events
    payload.status = payload.status === 'closed' ? 'open' : payload.status

    return { kind: 'handled', payload, forceDeploy: true }
  }

  return { kind: 'skipped', reason: 'unsupported_event' }
}
