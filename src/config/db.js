import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

try {
    // Run a test query to ensure DB connection works
    const connection = await db.getConnection();
    await connection.ping(); // or `await connection.query('SELECT 1')`
    console.log('Connected to MySQL database successfully');
    connection.release();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1); // Exit the app if DB is not reachable
  }

export default db;
