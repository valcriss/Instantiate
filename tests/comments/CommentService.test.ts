import { generateComment, COMMENT_SIGNATURE } from '../../src/comments/CommentService'
import { CommentService } from '../../src/comments/CommentService'
import { GitHubCommenter } from '../../src/comments/GitHubCommenter'
import { GitLabCommenter } from '../../src/comments/GitLabCommenter'

describe('generateComment', () => {
  it("génère un commentaire pour le statut 'in_progress'", () => {
    const result = generateComment('in_progress')
    expect(result).toBe(`${COMMENT_SIGNATURE}\n Deployment in progress...`)
  })

  it("génère un commentaire pour le statut 'ready' avec des liens", () => {
    const links = {
      'Lien 1': 'http://example.com/1',
      'Lien 2': 'http://example.com/2'
    }
    const result = generateComment('ready', links)
    expect(result).toBe(`${COMMENT_SIGNATURE}\n🔗 [Lien 1](http://example.com/1)\n🔗 [Lien 2](http://example.com/2)`)
  })

  it("génère un commentaire pour le statut 'ready' sans liens", () => {
    const result = generateComment('ready')
    expect(result).toBe(`${COMMENT_SIGNATURE}\n`)
  })

  it("génère un commentaire pour le statut 'closed'", () => {
    const result = generateComment('closed')
    expect(result).toBe(`${COMMENT_SIGNATURE}\n Stack destroyed due to merge request closure.`)
  })
})

describe('CommentService', () => {
  describe('getCommenter', () => {
    it("retourne une instance de GitHubCommenter si le provider est 'github'", () => {
      const commenter = CommentService.getCommenter('github')
      expect(commenter).toBeInstanceOf(GitHubCommenter)
    })

    it("retourne une instance de GitLabCommenter si le provider est 'gitlab'", () => {
      const commenter = CommentService.getCommenter('gitlab')
      expect(commenter).toBeInstanceOf(GitLabCommenter)
    })

    it("lève une erreur si le provider n'est pas supporté", () => {
      expect(() => CommentService.getCommenter('unsupported')).toThrow('Unsupported provider: unsupported')
    })
  })
})
