import express from 'express'
import { StackService } from '../core/StackService'

const router = express.Router()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.get('/stacks', async (req: any, res: any) => {
  const stacks = await StackService.getAll()
  res.send(JSON.stringify(stacks))
})

export default router
