import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { connectToDatabase } from './database.js'
import authRoutes from './routes/auth.js'
import postsRoutes from './routes/posts.js'

const app = new Hono()

// CORS middleware - Allow frontend origins
const allowedOrigins = [
  'http://localhost:5173', 
  'http://localhost:5174', 
  'http://localhost:3000',
  // Add your production frontend URL here
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
]

// Function to check if origin is allowed
const isOriginAllowed = (origin: string) => {
  if (allowedOrigins.includes(origin)) return true
  // Allow any vercel app domain
  return /https:\/\/.*\.vercel\.app$/.test(origin)
}

app.use('/*', cors({
  origin: (origin, c) => {
    if (!origin || isOriginAllowed(origin)) {
      return origin
    }
    return null
  },
  credentials: true,
}))

// Health check route
app.get('/', (c) => {
  return c.json({ message: 'Blog Backend API is running!' })
})

// API Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'OK', message: 'API is healthy' })
})

// Auth routes
app.route('/api/auth', authRoutes)

// Posts routes
app.route('/api/posts', postsRoutes)

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