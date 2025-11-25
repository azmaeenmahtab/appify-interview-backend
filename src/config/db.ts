import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Use DATABASE_URL if provided (for Neon), otherwise use individual config
const pool = process.env.DATABASE_URL 
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Required for Neon
      }
    })
  : new Pool({
      host: process.env.DB_HOST as string,
      user: process.env.DB_USER as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_NAME as string,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    });

export default pool;