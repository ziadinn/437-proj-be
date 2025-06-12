import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDatabase } from '../database.js'
import { User, UserCredentials, LoginRequest, RegisterRequest, AuthResponse, UpdateProfileRequest, ProfileUpdateResponse } from '../types.js'

const auth = new Hono()

// Helper function to verify JWT token
const verifyToken = (token: string): { username: string } | null => {
  try {
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured')
    }
    
    const decoded = jwt.verify(token, jwtSecret) as { username: string }
    return decoded
  } catch (error) {
    return null
  }
}

// Register endpoint
auth.post('/register', async (c) => {
  try {
    let body: RegisterRequest
    try {
      body = await c.req.json() as RegisterRequest
    } catch (jsonError) {
      return c.json<AuthResponse>({ 
        success: false, 
        message: 'Invalid JSON format' 
      }, 400)
    }
    
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
      description: '', // Empty description by default
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
      user: { username, description: '', createdAt: now, updatedAt: now }
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
    let body: LoginRequest
    try {
      body = await c.req.json() as LoginRequest
    } catch (jsonError) {
      return c.json<AuthResponse>({ 
        success: false, 
        message: 'Invalid JSON format' 
      }, 400)
    }
    
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
      user: { 
        username: user.username, 
        description: user.description, 
        createdAt: user.createdAt, 
        updatedAt: user.updatedAt 
      }
    })

  } catch (error) {
    console.error('Login error:', error)
    return c.json<AuthResponse>({ 
      success: false, 
      message: 'Internal server error' 
    }, 500)
  }
})

// Update profile endpoint
auth.put('/profile', async (c) => {
  try {
    // Get authorization header
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json<ProfileUpdateResponse>({ 
        success: false, 
        message: 'Authorization token required' 
      }, 401)
    }

    // Extract and verify token
    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    if (!decoded) {
      return c.json<ProfileUpdateResponse>({ 
        success: false, 
        message: 'Invalid or expired token' 
      }, 401)
    }

    // Parse request body
    let body: UpdateProfileRequest
    try {
      body = await c.req.json() as UpdateProfileRequest
    } catch (jsonError) {
      return c.json<ProfileUpdateResponse>({ 
        success: false, 
        message: 'Invalid JSON format' 
      }, 400)
    }

    const { username: newUsername, description } = body

    // Validate inputs
    if (newUsername && newUsername.length < 3) {
      return c.json<ProfileUpdateResponse>({ 
        success: false, 
        message: 'Username must be at least 3 characters long' 
      }, 400)
    }

    const db = getDatabase()
    const usersCollection = db.collection<User>(process.env.USERS_COLLECTION_NAME || 'users')
    const credsCollection = db.collection<UserCredentials>(process.env.CREDS_COLLECTION_NAME || 'userCreds')

    // Find credentials by JWT username (this is the permanent login identifier)
    const userCreds = await credsCollection.findOne({ username: decoded.username })
    if (!userCreds) {
      return c.json<ProfileUpdateResponse>({ 
        success: false, 
        message: 'Invalid authentication token' 
      }, 401)
    }

    // For profile updates, we need to find the user record
    // Since username might have changed, we'll add a userId field for tracking
    // For now, let's look up by both username and creation time matching
    let currentUser = await usersCollection.findOne({ username: decoded.username })
    
    if (!currentUser) {
      // Look for user created around the same time as credentials
      currentUser = await usersCollection.findOne({
        createdAt: userCreds.createdAt
      })
    }

    if (!currentUser) {
      return c.json<ProfileUpdateResponse>({ 
        success: false, 
        message: 'User profile not found' 
      }, 404)
    }

    // Check if new username already exists (if username is being changed)
    if (newUsername && newUsername !== currentUser.username) {
      const existingUser = await usersCollection.findOne({ username: newUsername })
      if (existingUser) {
        return c.json<ProfileUpdateResponse>({ 
          success: false, 
          message: 'Username already exists' 
        }, 409)
      }
    }

    // Prepare update data
    const updateData: Partial<User> = {
      updatedAt: new Date()
    }

    if (newUsername) {
      updateData.username = newUsername
    }
    if (description !== undefined) {
      updateData.description = description
    }

    // Update user record using the current username
    const result = await usersCollection.updateOne(
      { username: currentUser.username },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return c.json<ProfileUpdateResponse>({ 
        success: false, 
        message: 'User not found' 
      }, 404)
    }

    // Note: We don't update the credentials collection username
    // The credentials username serves as a permanent login identifier
    // while the users collection username is the display name that can change

    // Get updated user data
    const updatedUser = await usersCollection.findOne({ 
      username: newUsername || currentUser.username 
    })

    if (!updatedUser) {
      return c.json<ProfileUpdateResponse>({ 
        success: false, 
        message: 'Error retrieving updated user data' 
      }, 500)
    }

    return c.json<ProfileUpdateResponse>({
      success: true,
      message: 'Profile updated successfully',
      user: {
        username: updatedUser.username,
        description: updatedUser.description,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    })

  } catch (error) {
    console.error('Profile update error:', error)
    return c.json<ProfileUpdateResponse>({ 
      success: false, 
      message: 'Internal server error' 
    }, 500)
  }
})

export default auth 