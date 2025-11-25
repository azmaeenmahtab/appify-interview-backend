import type { Request, Response } from 'express';
import { getUsers, createUser } from '../models/user';
import type { User } from '../models/user';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret';

export const register = async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = req.body;
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  const users = await getUsers();
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(409).json({ message: 'Email already registered.' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const registeredAt = new Date().toISOString();
  const newUser: User = {
    firstName,
    lastName,
    email,
    password: hashedPassword,
    registeredAt,
  };
  await createUser(newUser);
  return res.status(201).json({ message: 'User registered successfully.' });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required.' });
  }
  const users = await getUsers();
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }
  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
  return res.json({ token, user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email } });
};
