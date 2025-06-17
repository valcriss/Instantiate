import { injectCredentialsIfMissing } from '../../src/utils/gitUrl'

describe('injectCredentialsIfMissing', () => {
  it('adds credentials when missing', () => {
    const result = injectCredentialsIfMissing('https://github.com/test/repo.git', 'user', 'token')
    expect(result).toBe('https://user:token@github.com/test/repo.git')
  })

  it('does not add credentials if already present', () => {
    const result = injectCredentialsIfMissing('https://user:token@github.com/test/repo.git', 'user', 'token')
    expect(result).toBe('https://user:token@github.com/test/repo.git')
  })

  it('returns same url when username or token is missing', () => {
    const result1 = injectCredentialsIfMissing('https://github.com/test/repo.git', undefined, 'token')
    expect(result1).toBe('https://github.com/test/repo.git')
    const result2 = injectCredentialsIfMissing('https://github.com/test/repo.git', 'user', undefined)
    expect(result2).toBe('https://github.com/test/repo.git')
  })

  it('handles http protocol', () => {
    const result = injectCredentialsIfMissing('http://github.com/test/repo.git', 'user', 'token')
    expect(result).toBe('http://user:token@github.com/test/repo.git')
  })

  it('returns url unchanged for unsupported scheme', () => {
    const result = injectCredentialsIfMissing('git@github.com:test/repo.git', 'user', 'token')
    expect(result).toBe('git@github.com:test/repo.git')
  })
})
