import pool from '../config/db';

export interface User {
  id?: string; // optional, set by DB
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  registeredAt: string;
}

// Fetch all users from the database
export const getUsers = async (): Promise<User[]> => {
  const result = await pool.query('SELECT id, first_name as "firstName", last_name as "lastName", email, password, registered_at as "registeredAt" FROM users');
  return result.rows;
};

// Create a new user in the database
export const createUser = async (user: User): Promise<void> => {
  await pool.query(
    'INSERT INTO users (first_name, last_name, email, password, registered_at) VALUES ($1, $2, $3, $4, $5)',
    [user.firstName, user.lastName, user.email, user.password, user.registeredAt]
  );
};
