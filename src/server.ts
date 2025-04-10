import express from 'express'
import dotenv from 'dotenv'
import logger from './utils/logger'
import updateRoute from './api/update'

logger.info('[server] Server is starting...')

dotenv.config()

const app = express()
app.use(express.json())
app.use('/api', updateRoute)

app.get('/', (req, res) => {
  res.send('Instantiate backend is running!')
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  logger.info(`[server] Server running on port ${PORT}`)
})
