import { Hono } from 'hono'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import { getDatabase } from '../database.js'
import { Post, CreatePostRequest, UpdatePostRequest, PostResponse, PostsListResponse } from '../types.js'

const posts = new Hono()

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

// Helper function to validate ObjectId
const isValidObjectId = (id: string): boolean => {
  try {
    new ObjectId(id)
    return true
  } catch (error) {
    return false
  }
}

// Helper function to generate URL-safe slug from title
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

// Helper function to ensure unique slug
const ensureUniqueSlug = async (baseSlug: string, excludeId?: string): Promise<string> => {
  const db = getDatabase()
  const postsCollection = db.collection<Post>(process.env.POSTS_COLLECTION_NAME || 'posts')
  
  let slug = baseSlug
  let counter = 1
  
  while (true) {
    const query: any = { slug }
    if (excludeId) {
      query._id = { $ne: new ObjectId(excludeId) }
    }
    
    const existingPost = await postsCollection.findOne(query)
    if (!existingPost) {
      return slug
    }
    
    slug = `${baseSlug}-${counter}`
    counter++
  }
}

// Validate post data
const validatePostData = (data: CreatePostRequest | UpdatePostRequest): string | null => {
  if ('title' in data && data.title !== undefined) {
    if (!data.title.trim()) {
      return 'Title is required'
    }
    if (data.title.length > 200) {
      return 'Title must be 200 characters or less'
    }
  }
  
  if ('description' in data && data.description !== undefined) {
    if (data.description.length > 300) {
      return 'Description must be 300 characters or less'
    }
  }
  
  if ('content' in data && data.content !== undefined) {
    if (!data.content.trim()) {
      return 'Content is required'
    }
    if (data.content.length > 50000) {
      return 'Content must be 50,000 characters or less'
    }
  }
  
  return null
}

// GET /api/posts - Get all published posts
posts.get('/', async (c) => {
  try {
    const db = getDatabase()
    const postsCollection = db.collection<Post>(process.env.POSTS_COLLECTION_NAME || 'posts')
    
    // Get query parameters for pagination
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '10')
    const skip = (page - 1) * limit
    
    // Get only published posts, sorted by creation date (newest first)
    const posts = await postsCollection
      .find({ published: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()
    
    const total = await postsCollection.countDocuments({ published: true })
    
    // Convert ObjectId to string
    const postsResponse = posts.map(post => ({
      _id: post._id?.toString(),
      title: post.title,
      description: post.description,
      content: post.content,
      author: post.author,
      slug: post.slug,
      published: post.published,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt
    }))
    
    return c.json<PostsListResponse>({
      success: true,
      message: 'Posts retrieved successfully',
      posts: postsResponse,
      total
    })
    
  } catch (error) {
    console.error('Get posts error:', error)
    return c.json<PostsListResponse>({
      success: false,
      message: 'Failed to retrieve posts'
    }, 500)
  }
})

// GET /api/posts/user/:username - Get posts by specific user
posts.get('/user/:username', async (c) => {
  try {
    const username = c.req.param('username')
    const db = getDatabase()
    const postsCollection = db.collection<Post>(process.env.POSTS_COLLECTION_NAME || 'posts')
    
    // Get only published posts by this user
    const posts = await postsCollection
      .find({ author: username, published: true })
      .sort({ createdAt: -1 })
      .toArray()
    
    const postsResponse = posts.map(post => ({
      _id: post._id?.toString(),
      title: post.title,
      description: post.description,
      content: post.content,
      author: post.author,
      slug: post.slug,
      published: post.published,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt
    }))
    
    return c.json<PostsListResponse>({
      success: true,
      message: `Posts by ${username} retrieved successfully`,
      posts: postsResponse,
      total: posts.length
    })
    
  } catch (error) {
    console.error('Get user posts error:', error)
    return c.json<PostsListResponse>({
      success: false,
      message: 'Failed to retrieve user posts'
    }, 500)
  }
})

// GET /api/posts/:id - Get specific post by ID
posts.get('/:id', async (c) => {
  try {
    const postId = c.req.param('id')
    
    if (!isValidObjectId(postId)) {
      return c.json<PostResponse>({
        success: false,
        message: 'Invalid post ID'
      }, 400)
    }
    
    const db = getDatabase()
    const postsCollection = db.collection<Post>(process.env.POSTS_COLLECTION_NAME || 'posts')
    
    const post = await postsCollection.findOne({ _id: new ObjectId(postId) })
    
    if (!post) {
      return c.json<PostResponse>({
        success: false,
        message: 'Post not found'
      }, 404)
    }
    
    // Only return published posts for public access
    if (!post.published) {
      return c.json<PostResponse>({
        success: false,
        message: 'Post not found'
      }, 404)
    }
    
    return c.json<PostResponse>({
      success: true,
      message: 'Post retrieved successfully',
      post: {
        _id: post._id?.toString(),
        title: post.title,
        description: post.description,
        content: post.content,
        author: post.author,
        slug: post.slug,
        published: post.published,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      }
    })
    
  } catch (error) {
    console.error('Get post error:', error)
    return c.json<PostResponse>({
      success: false,
      message: 'Failed to retrieve post'
    }, 500)
  }
})

// POST /api/posts - Create new post (authenticated)
posts.post('/', async (c) => {
  try {
    // Check authentication
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json<PostResponse>({
        success: false,
        message: 'Authorization token required'
      }, 401)
    }
    
    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    if (!decoded) {
      return c.json<PostResponse>({
        success: false,
        message: 'Invalid or expired token'
      }, 401)
    }
    
    // Parse request body
    let body: CreatePostRequest
    try {
      body = await c.req.json() as CreatePostRequest
    } catch (jsonError) {
      return c.json<PostResponse>({
        success: false,
        message: 'Invalid JSON format'
      }, 400)
    }
    
    // Validate input
    const validationError = validatePostData(body)
    if (validationError) {
      return c.json<PostResponse>({
        success: false,
        message: validationError
      }, 400)
    }
    
    const { title, description, content, published = false } = body
    
    // Generate unique slug
    const baseSlug = generateSlug(title)
    const uniqueSlug = await ensureUniqueSlug(baseSlug)
    
    const now = new Date()
    const post: Post = {
      title: title.trim(),
      description: description?.trim() || '',
      content: content.trim(),
      author: decoded.username,
      slug: uniqueSlug,
      published,
      createdAt: now,
      updatedAt: now
    }
    
    const db = getDatabase()
    const postsCollection = db.collection<Post>(process.env.POSTS_COLLECTION_NAME || 'posts')
    
    const result = await postsCollection.insertOne(post)
    
    return c.json<PostResponse>({
      success: true,
      message: 'Post created successfully',
      post: {
        _id: result.insertedId.toString(),
        title: post.title,
        description: post.description,
        content: post.content,
        author: post.author,
        slug: post.slug,
        published: post.published,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      }
    }, 201)
    
  } catch (error) {
    console.error('Create post error:', error)
    return c.json<PostResponse>({
      success: false,
      message: 'Failed to create post'
    }, 500)
  }
})

// PUT /api/posts/:id - Update post (author only)
posts.put('/:id', async (c) => {
  try {
    // Check authentication
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json<PostResponse>({
        success: false,
        message: 'Authorization token required'
      }, 401)
    }
    
    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    if (!decoded) {
      return c.json<PostResponse>({
        success: false,
        message: 'Invalid or expired token'
      }, 401)
    }
    
    const postId = c.req.param('id')
    
    if (!isValidObjectId(postId)) {
      return c.json<PostResponse>({
        success: false,
        message: 'Invalid post ID'
      }, 400)
    }
    
    const db = getDatabase()
    const postsCollection = db.collection<Post>(process.env.POSTS_COLLECTION_NAME || 'posts')
    
    // Find the post
    const existingPost = await postsCollection.findOne({ _id: new ObjectId(postId) })
    if (!existingPost) {
      return c.json<PostResponse>({
        success: false,
        message: 'Post not found'
      }, 404)
    }
    
    // Check if user is the author
    if (existingPost.author !== decoded.username) {
      return c.json<PostResponse>({
        success: false,
        message: 'Not authorized to edit this post'
      }, 403)
    }
    
    // Parse request body
    let body: UpdatePostRequest
    try {
      body = await c.req.json() as UpdatePostRequest
    } catch (jsonError) {
      return c.json<PostResponse>({
        success: false,
        message: 'Invalid JSON format'
      }, 400)
    }
    
    // Validate input
    const validationError = validatePostData(body)
    if (validationError) {
      return c.json<PostResponse>({
        success: false,
        message: validationError
      }, 400)
    }
    
    // Prepare update data
    const updateData: Partial<Post> = {
      updatedAt: new Date()
    }
    
    if (body.title !== undefined) {
      updateData.title = body.title.trim()
      // Regenerate slug if title changed
      if (body.title.trim() !== existingPost.title) {
        const baseSlug = generateSlug(body.title.trim())
        updateData.slug = await ensureUniqueSlug(baseSlug, postId.toString())
      }
    }
    
    if (body.description !== undefined) {
      updateData.description = body.description.trim()
    }
    
    if (body.content !== undefined) {
      updateData.content = body.content.trim()
    }
    
    if (body.published !== undefined) {
      updateData.published = body.published
    }
    
    // Update the post
    await postsCollection.updateOne(
      { _id: new ObjectId(postId) },
      { $set: updateData }
    )
    
    // Get the updated post
    const updatedPost = await postsCollection.findOne({ _id: new ObjectId(postId) })
    
    if (!updatedPost) {
      return c.json<PostResponse>({
        success: false,
        message: 'Error retrieving updated post'
      }, 500)
    }
    
    return c.json<PostResponse>({
      success: true,
      message: 'Post updated successfully',
      post: {
        _id: updatedPost._id?.toString(),
        title: updatedPost.title,
        description: updatedPost.description,
        content: updatedPost.content,
        author: updatedPost.author,
        slug: updatedPost.slug,
        published: updatedPost.published,
        createdAt: updatedPost.createdAt,
        updatedAt: updatedPost.updatedAt
      }
    })
    
  } catch (error) {
    console.error('Update post error:', error)
    return c.json<PostResponse>({
      success: false,
      message: 'Failed to update post'
    }, 500)
  }
})

// DELETE /api/posts/:id - Delete post (author only)
posts.delete('/:id', async (c) => {
  try {
    // Check authentication
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json<PostResponse>({
        success: false,
        message: 'Authorization token required'
      }, 401)
    }
    
    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    if (!decoded) {
      return c.json<PostResponse>({
        success: false,
        message: 'Invalid or expired token'
      }, 401)
    }
    
    const postId = c.req.param('id')
    
    if (!isValidObjectId(postId)) {
      return c.json<PostResponse>({
        success: false,
        message: 'Invalid post ID'
      }, 400)
    }
    
    const db = getDatabase()
    const postsCollection = db.collection<Post>(process.env.POSTS_COLLECTION_NAME || 'posts')
    
    // Find the post
    const existingPost = await postsCollection.findOne({ _id: new ObjectId(postId) })
    if (!existingPost) {
      return c.json<PostResponse>({
        success: false,
        message: 'Post not found'
      }, 404)
    }
    
    // Check if user is the author
    if (existingPost.author !== decoded.username) {
      return c.json<PostResponse>({
        success: false,
        message: 'Not authorized to delete this post'
      }, 403)
    }
    
    // Delete the post
    await postsCollection.deleteOne({ _id: new ObjectId(postId) })
    
    return c.json<PostResponse>({
      success: true,
      message: 'Post deleted successfully'
    })
    
  } catch (error) {
    console.error('Delete post error:', error)
    return c.json<PostResponse>({
      success: false,
      message: 'Failed to delete post'
    }, 500)
  }
})

export default posts 