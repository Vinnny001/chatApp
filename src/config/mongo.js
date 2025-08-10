// config/mongo.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const connectMongo = async () => {
  try {
    await mongoose.connect(MONGO_URI); // No options needed in Mongoose 6+
    console.log('Connected to MongoDB successfully');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1); // Exit the app if DB is not reachable
  }
};

export default connectMongo;

