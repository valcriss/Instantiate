import { TemplateEngine } from '../../src/core/TemplateEngine'
import mockFs from 'mock-fs'
import fs from 'fs'
import logger from '../../src/utils/logger'

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn()
  }
}))

describe('TemplateEngine', () => {
  afterEach(() => mockFs.restore())

  it('remplace les variables dans un template', async () => {
    mockFs({
      '/input/template.yml': 'port: {{PORT}}',
      '/output': {}
    })

    await TemplateEngine.renderToFile('/input/template.yml', '/output/result.yml', { PORT: 3000 })

    const result = fs.readFileSync('/output/result.yml', 'utf-8')
    expect(result).toBe('port: 3000')
  })

  it('log et relance une erreur si le template ne peut pas être lu', async () => {
    // Ne crée pas le fichier => readFile échouera
    mockFs({
      '/input': {},
      '/output': {}
    })

    await expect(TemplateEngine.renderToFile('/input/missing.yml', '/output/fail.yml', {})).rejects.toThrow()

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[template] Error while rendering the template /input/missing.yml'))
  })
})
