export interface User {
  _id?: string
  username: string
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

export interface AuthResponse {
  success: boolean
  message: string
  token?: string
  user?: Omit<User, '_id'>
} 