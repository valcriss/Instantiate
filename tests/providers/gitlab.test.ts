import { parseGitlabWebhook } from '../../src/providers/gitlab'

describe('parseGitlabWebhook', () => {
  it('extrait correctement les infos d’un webhook GitLab avec MR ouverte', async () => {
    const body = {
      object_attributes: {
        id: 54321,
        iid: 456,
        title: 'Test MR',
        state: 'opened',
        source_branch: 'feature/gl-feature',
        last_commit: {
          id: 'abc123def456'
        },
        author_id: 99
      },
      project: {
        name: 'instantiate-gl',
        id: 'valcriss',
        git_http_url: 'valcriss/instantiate-gl'
      },
      user: {
        username: 'valcriss'
      }
    }

    const result = await parseGitlabWebhook(body, 'Merge Request Hook')

    if (result.kind !== 'handled') {
      throw new Error('Expected handled result')
    }

    expect(result).toEqual({
      kind: 'handled',
      forceDeploy: false,
      payload: {
        project_id: 'valcriss',
        mr_id: '54321',
        mr_iid: '456',
        status: 'open',
        branch: 'feature/gl-feature',
        repo: 'valcriss/instantiate-gl',
        sha: 'abc123def456',
        author: '99',
        full_name: 'valcriss',
        mergeRequestName: 'Test MR',
        projectName: 'instantiate-gl',
        provider: 'gitlab'
      }
    })
  })

  it('détecte un statut closed ou merged', async () => {
    const closedBody = {
      object_attributes: {
        id: 123,
        iid: 456,
        title: '',
        state: 'closed',
        source_branch: 'fix/closed-branch',
        last_commit: {
          id: 'deadbeef0001'
        },
        author_id: 1
      },
      project: {
        id: 'valcriss',
        name: '',
        git_http_url: 'group/project'
      },
      user: {
        username: 'botuser'
      }
    }

    const mergedBody = {
      ...closedBody,
      object_attributes: {
        ...closedBody.object_attributes,
        state: 'merged'
      }
    }

    const closedResult = await parseGitlabWebhook(closedBody, 'Merge Request Hook')
    const mergedResult = await parseGitlabWebhook(mergedBody, 'Merge Request Hook')

    if (closedResult.kind !== 'handled' || mergedResult.kind !== 'handled') {
      throw new Error('Expected handled results')
    }

    expect(closedResult.payload.status).toBe('closed')
    expect(mergedResult.payload.status).toBe('closed')
  })

  it('ajoute les informations d’authentification si elles sont définies', async () => {
    process.env.REPOSITORY_GITLAB_USERNAME = 'user'
    process.env.REPOSITORY_GITLAB_TOKEN = 'pass'

    const body = {
      object_attributes: {
        id: 123,
        iid: 456,
        title: '',
        state: 'opened',
        source_branch: 'feature/test',
        last_commit: {
          id: 'sha123'
        },
        author_id: 42
      },
      project: {
        id: 'repo123',
        name: '',
        git_http_url: 'https://gitlab.com/test/repo.git'
      }
    }

    const result = await parseGitlabWebhook(body, 'Merge Request Hook')

    if (result.kind !== 'handled') {
      throw new Error('Expected handled result')
    }

    expect(result.payload.repo).toBe('https://user:pass@gitlab.com/test/repo.git')

    delete process.env.REPOSITORY_GITLAB_USERNAME
    delete process.env.REPOSITORY_GITLAB_TOKEN
  })

  it('remplace localhost par host.docker.internal en mode développement', async () => {
    process.env.NODE_ENV = 'development'

    const body = {
      object_attributes: {
        id: 456,
        iid: 456,
        title: '',
        state: 'opened',
        source_branch: 'feature/docker',
        last_commit: {
          id: 'sha456'
        },
        author_id: 99
      },
      project: {
        id: 'repo456',
        name: '',
        git_http_url: 'http://localhost/test/repo.git'
      }
    }

    const result = await parseGitlabWebhook(body, 'Merge Request Hook')

    if (result.kind !== 'handled') {
      throw new Error('Expected handled result')
    }

    expect(result.payload.repo).toBe('http://host.docker.internal/test/repo.git')

    delete process.env.NODE_ENV
  })

  it('force le déploiement lorsque le commentaire de MR correspond à la commande', async () => {
    const body = {
      object_attributes: {
        note: 'Instantiate Deploy',
        noteable_type: 'MergeRequest'
      },
      merge_request: {
        id: 42,
        iid: 12,
        title: 'Trigger deploy',
        state: 'opened',
        source_branch: 'feature/retry',
        last_commit: {
          id: 'commit123'
        },
        author_id: 7
      },
      project: {
        id: 'proj-1',
        name: 'proj',
        git_http_url: 'https://gitlab.example.com/proj/repo.git'
      }
    }

    const result = await parseGitlabWebhook(body, 'Note Hook')

    if (result.kind !== 'handled') {
      throw new Error('Expected handled result')
    }

    expect(result.forceDeploy).toBe(true)
    expect(result.payload).toEqual(
      expect.objectContaining({
        project_id: 'proj-1',
        mr_id: '42',
        branch: 'feature/retry',
        sha: 'commit123',
        status: 'open'
      })
    )
  })

  it('ignore les commentaires qui ne contiennent pas la commande', async () => {
    const body = {
      object_attributes: {
        note: 'Hello world',
        noteable_type: 'MergeRequest'
      },
      merge_request: {
        id: 42,
        iid: 12,
        title: 'Trigger deploy',
        state: 'opened',
        source_branch: 'feature/retry',
        last_commit: {
          id: 'commit123'
        },
        author_id: 7
      },
      project: {
        id: 'proj-1',
        name: 'proj',
        git_http_url: 'https://gitlab.example.com/proj/repo.git'
      }
    }

    const result = await parseGitlabWebhook(body, 'Note Hook')

    expect(result).toEqual({ kind: 'skipped', reason: 'comment_not_command' })
  })

  it('ignore les commentaires sur un autre type de noteable', async () => {
    const body = {
      object_attributes: {
        note: 'instantiate deploy',
        noteable_type: 'Issue'
      },
      project: {
        id: 'proj',
        name: 'proj',
        git_http_url: 'https://gitlab.example.com/proj.git'
      }
    }

    const result = await parseGitlabWebhook(body as never, 'Note Hook')

    expect(result).toEqual({ kind: 'skipped', reason: 'unsupported_noteable' })
  })

  it('ignore les commentaires sans information de merge request', async () => {
    const body = {
      object_attributes: {
        note: 'instantiate deploy',
        noteable_type: 'MergeRequest'
      },
      project: {
        id: 'proj',
        name: 'proj',
        git_http_url: 'https://gitlab.example.com/proj.git'
      }
    }

    const result = await parseGitlabWebhook(body as never, 'Note Hook')

    expect(result).toEqual({ kind: 'skipped', reason: 'missing_merge_request' })
  })

  it('retourne skipped pour les evenements non supportes', async () => {
    const body = {
      object_attributes: {
        id: 1,
        iid: 1,
        title: 'test',
        state: 'opened',
        source_branch: 'feature',
        last_commit: { id: 'sha' },
        author_id: 1
      },
      project: {
        id: 'proj',
        name: 'proj',
        git_http_url: 'https://gitlab.example.com/proj.git'
      }
    }

    const result = await parseGitlabWebhook(body, 'Pipeline Hook')

    expect(result).toEqual({ kind: 'skipped', reason: 'unsupported_event' })
  })

  it('ignore les commentaires sans contenu', async () => {
    const body = {
      object_attributes: {
        noteable_type: 'MergeRequest'
      },
      merge_request: {
        id: 1,
        iid: 1,
        title: 'test',
        state: 'opened',
        source_branch: 'feature',
        last_commit: { id: 'sha' },
        author_id: 1
      },
      project: {
        id: 'proj',
        name: 'proj',
        git_http_url: 'https://gitlab.example.com/proj.git'
      }
    }

    const result = await parseGitlabWebhook(body as never, 'Note Hook')

    expect(result).toEqual({ kind: 'skipped', reason: 'comment_not_command' })
  })

  it('reouvre le statut lorsque la MR etait fermee', async () => {
    const body = {
      object_attributes: {
        note: 'instantiate deploy',
        noteable_type: 'MergeRequest'
      },
      merge_request: {
        id: 2,
        iid: 2,
        title: 'Test',
        state: 'closed',
        source_branch: 'feature',
        last_commit: { id: 'sha' },
        author_id: 1
      },
      project: {
        id: 'proj',
        name: 'proj',
        git_http_url: 'https://gitlab.example.com/proj.git'
      }
    }

    const result = await parseGitlabWebhook(body, 'Note Hook')

    if (result.kind !== 'handled') {
      throw new Error('Expected handled result')
    }

    expect(result.payload.status).toBe('open')
  })
})
