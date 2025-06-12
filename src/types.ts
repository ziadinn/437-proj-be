export interface User {
  _id?: string
  username: string
  description: string
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