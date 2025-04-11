export type MergeRequestPayload = {
  project_id: string
  mr_id: string
  status: 'open' | 'closed'
  branch: string
  repo: string
  sha: string
  author: string
}
