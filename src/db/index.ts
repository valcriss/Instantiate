import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

export default {
  query: (text: string, params?: unknown[]) => pool.query(text, params),
  getClient: () => pool.connect()
}
