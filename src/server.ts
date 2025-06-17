import express from 'express'
import dotenv from 'dotenv'
import logger from './utils/logger'
import updateRoute from './api/update'
import stacksApiRoute from './api/stacksApi'
import stacksPageRoute from './pages/stacksPage'
import { startHealthChecker } from './health/HealthChecker'
import RateLimit from 'express-rate-limit'

logger.info('[server] Server is starting...')

dotenv.config()

const app = express()

const limiter = RateLimit({
  windowMs: 60 * 1000, // 60 seconds
  limit: 60 // max 60 requests per 60 seconds
})

app.disable('x-powered-by')
app.use(express.json())
app.use('/api', updateRoute)
app.use('/api', stacksApiRoute)
app.use('/', stacksPageRoute)
app.use(limiter)

app.get('/', (req, res) => {
  res.send('Instantiate backend is running!')
})

const PORT = process.env.PORT ?? 3000
app.listen(PORT, () => {
  logger.info(`[server] Server running on port ${PORT}`)
})

startHealthChecker()
