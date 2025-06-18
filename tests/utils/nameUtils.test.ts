import { sanitizeName, buildStackName } from '../../src/utils/nameUtils'

describe('nameUtils', () => {
  describe('sanitizeName', () => {
    it('removes accents, keeps dashes and replaces slashes', () => {
      const result = sanitizeName('Pr\xE9s-\xE9nt/ation !')
      expect(result).toBe('pres-ent-ation')
    })

    it('replaces backslashes with dashes', () => {
      const result = sanitizeName('folder\\file')
      expect(result).toBe('folder-file')
    })
  })

  describe('buildStackName', () => {
    it('builds a sanitized stack name', () => {
      const name = buildStackName('Mon Projet', 'Feature #1')
      expect(name).toBe('monprojet-feature1')
    })

    it('truncates to 63 characters', () => {
      const long = 'a'.repeat(40)
      const name = buildStackName(long, long)
      expect(name.length).toBeLessThanOrEqual(63)
    })

    it('handles empty parts', () => {
      expect(buildStackName('', 'Test')).toBe('test')
      expect(buildStackName('Proj', '')).toBe('proj')
    })
  })
})
