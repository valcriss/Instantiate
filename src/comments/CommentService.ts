import { GitHubCommenter } from './GitHubCommenter'
import { GitLabCommenter } from './GitLabCommenter'
import { DeploymentStatus, MergeRequestCommenter } from './MergeRequestCommenter'

export class CommentService {
  static getCommenter(provider: 'github' | 'gitlab' | 'unsupported'): MergeRequestCommenter {
    if (provider === 'github') return new GitHubCommenter()
    if (provider === 'gitlab') return new GitLabCommenter()
    throw new Error(`Unsupported provider: ${provider}`)
  }
}

// Signature à insérer dans tous les commentaires pour pouvoir les retrouver
export const COMMENT_SIGNATURE = '<!-- instantiate-comment -->'

export function generateComment(status: DeploymentStatus, links?: Record<string, string>): string {
  switch (status) {
    case 'in_progress':
      return `${COMMENT_SIGNATURE}\n Deployment in progress...`
    case 'ready':
      return (
        `${COMMENT_SIGNATURE}\n` +
        (links
          ? Object.entries(links)
              .map(([key, value]) => `🔗 [${key}](${value})`)
              .join('\n')
          : '')
      )
    case 'closed':
      return `${COMMENT_SIGNATURE}\n Stack destroyed due to merge request closure.`
    case 'error':
      return `${COMMENT_SIGNATURE}\n Deployment failed.`
    case 'ignored':
      return `${COMMENT_SIGNATURE}\n branch ignored by instantiate configuration`
  }
}
