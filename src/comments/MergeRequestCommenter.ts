import { MergeRequestPayload } from '../types/MergeRequestPayload'

export type DeploymentStatus = 'in_progress' | 'ready' | 'closed' | 'error'

export interface MergeRequestCommenter {
  postStatusComment(payload: MergeRequestPayload, status: DeploymentStatus, links?: Record<string, string>): Promise<void>
}
