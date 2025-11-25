import { Router } from 'express';
import { create, getAll, getOne, remove } from '../controllers/postController';
import { togglePostLike, getWhoLiked } from '../controllers/likeController';
import { verifyToken } from '../middleware/authMiddleware';
import { upload } from '../middleware/upload';

const router = Router();

// All post routes require authentication
router.post('/', verifyToken, upload.single('image'), create);
router.get('/', verifyToken, getAll);
router.get('/:id', verifyToken, getOne);
router.delete('/:id', verifyToken, remove);

// Like routes
router.post('/:id/toggle-like', verifyToken, togglePostLike);
router.get('/:id/likes', verifyToken, getWhoLiked);

export default router;
