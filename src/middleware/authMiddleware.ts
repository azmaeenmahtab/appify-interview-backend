import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUsers } from '../models/user';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret';

interface JwtPayload {
  userId: string;
  email: string;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
    }
  }
}

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const users = await getUsers();
    const user = users.find(u => u.id === decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    // Attach user to request object
    req.user = {
      id: user.id!,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};
