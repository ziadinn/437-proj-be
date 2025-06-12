import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDatabase } from '../database.js'
import { User, UserCredentials, LoginRequest, RegisterRequest, AuthResponse } from '../types.js'

const auth = new Hono()

// Register endpoint
auth.post('/register', async (c) => {
  try {
    const body = await c.req.json() as RegisterRequest
    const { username, password } = body

    if (!username || !password) {
      return c.json<AuthResponse>({ 
        success: false, 
        message: 'Username and password are required' 
      }, 400)
    }

    if (username.length < 3) {
      return c.json<AuthResponse>({ 
        success: false, 
        message: 'Username must be at least 3 characters long' 
      }, 400)
    }

    if (password.length < 6) {
      return c.json<AuthResponse>({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
      }, 400)
    }

    const db = getDatabase()
    const usersCollection = db.collection<User>(process.env.USERS_COLLECTION_NAME || 'users')
    const credsCollection = db.collection<UserCredentials>(process.env.CREDS_COLLECTION_NAME || 'userCreds')

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ username })
    if (existingUser) {
      return c.json<AuthResponse>({ 
        success: false, 
        message: 'Username already exists' 
      }, 409)
    }

    // Hash password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Create user and credentials
    const now = new Date()
    const user: User = {
      username,
      createdAt: now,
      updatedAt: now
    }

    const userCreds: UserCredentials = {
      username,
      hashedPassword,
      createdAt: now,
      updatedAt: now
    }

    // Insert user and credentials
    await usersCollection.insertOne(user)
    await credsCollection.insertOne(userCreds)

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured')
    }

    const token = jwt.sign(
      { username },
      jwtSecret,
      { expiresIn: '7d' }
    )

    return c.json<AuthResponse>({
      success: true,
      message: 'User registered successfully',
      token,
      user: { username, createdAt: now, updatedAt: now }
    }, 201)

  } catch (error) {
    console.error('Registration error:', error)
    return c.json<AuthResponse>({ 
      success: false, 
      message: 'Internal server error' 
    }, 500)
  }
})

// Login endpoint
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json() as LoginRequest
    const { username, password } = body

    if (!username || !password) {
      return c.json<AuthResponse>({ 
        success: false, 
        message: 'Username and password are required' 
      }, 400)
    }

    const db = getDatabase()
    const usersCollection = db.collection<User>(process.env.USERS_COLLECTION_NAME || 'users')
    const credsCollection = db.collection<UserCredentials>(process.env.CREDS_COLLECTION_NAME || 'userCreds')

    // Find user credentials
    const userCreds = await credsCollection.findOne({ username })
    if (!userCreds) {
      return c.json<AuthResponse>({ 
        success: false, 
        message: 'Invalid username or password' 
      }, 401)
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, userCreds.hashedPassword)
    if (!isPasswordValid) {
      return c.json<AuthResponse>({ 
        success: false, 
        message: 'Invalid username or password' 
      }, 401)
    }

    // Get user data
    const user = await usersCollection.findOne({ username })
    if (!user) {
      return c.json<AuthResponse>({ 
        success: false, 
        message: 'User not found' 
      }, 404)
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured')
    }

    const token = jwt.sign(
      { username },
      jwtSecret,
      { expiresIn: '7d' }
    )

    return c.json<AuthResponse>({
      success: true,
      message: 'Login successful',
      token,
      user: { username: user.username, createdAt: user.createdAt, updatedAt: user.updatedAt }
    })

  } catch (error) {
    console.error('Login error:', error)
    return c.json<AuthResponse>({ 
      success: false, 
      message: 'Internal server error' 
    }, 500)
  }
})

export default auth 