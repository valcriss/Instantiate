import express from 'express'
import { StackInfo, StackService } from '../core/StackService'
import path from 'path'
import fs from 'fs/promises'
import mustache from 'mustache'

const router = express.Router()

router.get('/', async (req, res) => {
  const stacks = await StackService.getAll()
  const templatePath = path.join(__dirname, '../templates/stacks.mustache')
  const template = await fs.readFile(templatePath, 'utf-8')
  const viewModel = {
    stacks: stacks.map((stack: StackInfo) => ({
      ...stack,
      ports: Object.entries(stack.ports).map(([name, port]) => ({ name, port })),
      links: Object.entries(stack.links).map(([name, url]) => ({ name, url })),
      createdAt: new Date(stack.createdAt as string).toLocaleString(),
      updatedAt: new Date(stack.updatedAt as string).toLocaleString()
    }))
  }
  const html = mustache.render(template, viewModel)
  res.send(html)
})

export default router
