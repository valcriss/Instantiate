import fetch from 'node-fetch'
import logger from '../../src/utils/logger'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'
import { Response } from 'node-fetch'
import { GitLabCommenter } from '../../src/comments/GitLabCommenter'
import { COMMENT_SIGNATURE } from '../../src/comments/CommentService'

// Force l'utilisation du mock de fetch (typage TypeScript)
const { Response: MockResponse } = jest.requireActual('node-fetch')

jest.mock('node-fetch') // ou jest.mock('node-fetch', () => ...) si vous voulez personnaliser
jest.mock('../../src/utils/logger')

describe('GitLabCommenter', () => {
  let commenter: GitLabCommenter
  let originalGitLabToken: string | undefined
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  const fakePayload: MergeRequestPayload = {
    project_id: '123',
    mr_id: '456',
    mr_iid: '456',
    status: 'open',
    branch: 'main',
    repo: 'https://gitlab.example.com/valcriss/test-repo',
    sha: 'abcde',
    author: 'valcriss',
    full_name: 'valcriss/test-repo',
    provider: 'gitlab'
  }

  beforeAll(() => {
    // Sauvegarde de la valeur initiale de la variable d'environnement
    originalGitLabToken = process.env.GITLAB_TOKEN
  })

  beforeEach(() => {
    // On peut initialiser un token "factice" pour que getHeaders() renvoie quelque chose
    process.env.GITLAB_TOKEN = 'fake-gitlab-token'
    // Réinitialisation du mock de fetch avant chaque test
    mockFetch.mockReset()
    // Réinitialisation de logger
    ;(logger.info as jest.Mock).mockClear()

    commenter = new GitLabCommenter()
  })

  afterAll(() => {
    // Restaure la valeur initiale
    process.env.GITLAB_TOKEN = originalGitLabToken
  })

  // -------------------------------------------------------------
  // Tests pour getGitLabApiUrlFromProjectUrl
  // -------------------------------------------------------------
  describe('getGitLabApiUrlFromProjectUrl', () => {
    it('retourne un URL d’API valide pour un URL valide', () => {
      // Méthode privée, mais on peut tester indirectement via un wrapper
      // ou tester directement en la rendant publique dans un mock.
      // Ici, on appelle la méthode privée via (commenter as any).getGitLabApiUrlFromProjectUrl(...)
      const url = (commenter as GitLabCommenter).getGitLabApiUrlFromProjectUrl('https://gitlab.example.com/group/project')
      expect(url).toBe('https://gitlab.example.com/api/v4')
    })

    it('lève une erreur pour un URL invalide', () => {
      expect(() => {
        ;(commenter as GitLabCommenter).getGitLabApiUrlFromProjectUrl('not-a-valid-url')
      }).toThrowError('Invalid GitLab project URL')
    })
  })

  // -------------------------------------------------------------
  // Tests pour postStatusComment
  // -------------------------------------------------------------
  describe('postStatusComment', () => {
    it("n'envoie pas de requête si GITLAB_TOKEN est vide", async () => {
      process.env.GITLAB_TOKEN = ''

      await commenter.postStatusComment(fakePayload, 'in_progress')

      // fetch ne doit pas être appelé
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------
  // Tests pour deleteComment
  // -------------------------------------------------------------
  describe('deleteComment', () => {
    it("ne fait rien si les en-têtes d'authentification sont absents", async () => {
      process.env.GITLAB_TOKEN = '' // Simule l'absence de token GitLab

      const commenter = new GitLabCommenter()

      // Appelle la méthode deleteComment
      await commenter['deleteComment']('https://gitlab.example.com/group/project', '123', '123', '456')

      // Vérifie que fetch n'a pas été appelé
      expect(fetch).not.toHaveBeenCalled()
    })
  })
})
