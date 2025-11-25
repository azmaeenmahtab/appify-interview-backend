import { Router } from 'express';
import { register, login, verify } from '../controllers/authController';
import { verifyToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/verify', verifyToken, verify);

export default router;
