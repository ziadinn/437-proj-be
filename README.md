# Blog Backend API

A simple backend API built with Hono.js, TypeScript, and MongoDB for user authentication and blog management.

## Features

- User registration and login
- JWT-based authentication
- Password hashing with bcryptjs
- MongoDB integration
- TypeScript support

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure you have a `.env` file with the following variables:
```
MONGO_USER=your_mongodb_user
MONGO_PWD=your_mongodb_password
MONGO_CLUSTER=your_mongodb_cluster
DB_NAME=simple-blog-site
USERS_COLLECTION_NAME=users
CREDS_COLLECTION_NAME=userCreds
POSTS_COLLECTION_NAME=posts
JWT_SECRET=your_jwt_secret
PORT=3000
```

## Development

Start the development server:
```bash
npm run dev
```

Build the project:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## API Endpoints

### Authentication

#### Register User
- **POST** `/api/auth/register`
- **Body**: `{ "username": "string", "password": "string" }`
- **Response**: `{ "success": boolean, "message": string, "token"?: string, "user"?: User }`

#### Login User
- **POST** `/api/auth/login`
- **Body**: `{ "username": "string", "password": "string" }`
- **Response**: `{ "success": boolean, "message": string, "token"?: string, "user"?: User }`

### Health Check
- **GET** `/` - Returns API status

## Security Features

- Passwords are hashed using bcryptjs with 12 salt rounds
- JWT tokens expire after 7 days
- Input validation for username and password length
- Proper error handling and secure error messages 