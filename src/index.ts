import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import postRoutes from './routes/posts';
import commentRoutes from './routes/comments';
import dotenv from 'dotenv';
import pool from './config/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());




app.use('/auth', authRoutes);
app.use('/posts', postRoutes);
app.use('/', commentRoutes);

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;