export type MergeRequestPayload = {
  project_id: string
  mr_id: string
  mr_iid: string
  status: 'open' | 'closed'
  branch: string
  repo: string
  sha: string
  author: string
  full_name: string
  provider: 'github' | 'gitlab'
}
