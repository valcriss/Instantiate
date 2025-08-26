import { getWorkingPath } from '../../src/utils/workingPath'

describe('getWorkingPath', () => {
  afterEach(() => {
    delete process.env.WORKING_PATH
  })

  it('returns the environment value when set', () => {
    process.env.WORKING_PATH = '/custom'
    expect(getWorkingPath()).toBe('/custom')
  })

  it('returns the default when set to only whitespace', () => {
    process.env.WORKING_PATH = '   '
    expect(getWorkingPath()).toBe('/tmp')
  })

  it('returns the default when not set', () => {
    expect(getWorkingPath()).toBe('/tmp')
  })
})
