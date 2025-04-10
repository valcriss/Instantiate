import express from 'express'
import { MergeRequestPayload } from '../types/MergeRequestPayload'

type GitlabReqBody = {
  object_attributes: {
    id: number
    state: string
    source_branch: string
    last_commit: {
      id: string
    }
    author_id: number
  }
  project: {
    path_with_namespace: string
  }
}

export function parseGitlabWebhook(body: GitlabReqBody): MergeRequestPayload {
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
