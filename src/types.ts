export interface User {
  _id?: string
  username: string
  description: string
  profileImageBase64?: string
  createdAt: Date
  updatedAt: Date
}

export interface UserCredentials {
  _id?: string
  username: string
  hashedPassword: string
  createdAt: Date
  updatedAt: Date
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
}

export interface UpdateProfileRequest {
  username?: string
  description?: string
  profileImageBase64?: string
}

export interface AuthResponse {
  success: boolean
  message: string
  token?: string
  user?: Omit<User, '_id'>
}

export interface ProfileUpdateResponse {
  success: boolean
  message: string
  user?: Omit<User, '_id'>
}

export interface Post {
  _id?: string
  title: string
  description?: string
  content: string
  author: string
  slug: string
  published: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreatePostRequest {
  title: string
  description?: string
  content: string
  published?: boolean
}

export interface UpdatePostRequest {
  title?: string
  description?: string
  content?: string
  published?: boolean
}

export interface PostResponse {
  success: boolean
  message: string
  post?: Post
}

export interface PostsListResponse {
  success: boolean
  message: string
  posts?: Post[]
  total?: number
} 