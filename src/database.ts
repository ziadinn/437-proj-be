import { MongoClient, Db } from 'mongodb'

let db: Db

export const connectToDatabase = async (): Promise<Db> => {
  if (db) {
    return db
  }

  const mongoUser = process.env.MONGO_USER
  const mongoPwd = process.env.MONGO_PWD
  const mongoCluster = process.env.MONGO_CLUSTER
  const dbName = process.env.DB_NAME

  if (!mongoUser || !mongoPwd || !mongoCluster || !dbName) {
    throw new Error('Missing required MongoDB environment variables')
  }

  const uri = `mongodb+srv://${mongoUser}:${mongoPwd}@${mongoCluster}/?retryWrites=true&w=majority`
  
  try {
    const client = new MongoClient(uri)
    await client.connect()
    
    db = client.db(dbName)
    
    console.log('Successfully connected to MongoDB Atlas')
    return db
  } catch (error) {
    console.error('Error connecting to MongoDB:', error)
    throw error
  }
}

export const getDatabase = (): Db => {
  if (!db) {
    throw new Error('Database not initialized. Call connectToDatabase first.')
  }
  return db
} 