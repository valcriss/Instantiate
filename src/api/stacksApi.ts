import express from 'express'
import { StackService } from '../core/StackService'

const router = express.Router()

router.get('/stacks', async (req, res) => {
  const stacks = await StackService.getAll()
  res.send(JSON.stringify(stacks))
})

export default router
