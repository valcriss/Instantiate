export type MergeRequestPayload = {
  mr_id: string
  status: 'open' | 'closed'
  branch: string
  repo: string
  sha: string
  author: string
}
