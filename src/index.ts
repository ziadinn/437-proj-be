import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { connectToDatabase } from './database.js'
import authRoutes from './routes/auth.js'

const app = new Hono()

// CORS middleware
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Frontend dev server and potential other origins
  credentials: true,
}))

// Health check route
app.get('/', (c) => {
  return c.json({ message: 'Blog Backend API is running!' })
})

// Auth routes
app.route('/api/auth', authRoutes)

const port = parseInt(process.env.PORT || '3000')

// Initialize database connection and start server
const startServer = async () => {
  try {
    await connectToDatabase()
    console.log('Connected to MongoDB')
    
    serve({
      fetch: app.fetch,
      port
    })
    
    console.log(`Server is running on port ${port}`)
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Start the server
startServer()

// Export for deployment platforms that expect a default export
export default app 