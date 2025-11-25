import { Router } from 'express';
import { addComment, addReply, getComments, removeComment, toggleLike, getWhoLikedComment } from '../controllers/commentController';
import { verifyToken } from '../middleware/authMiddleware';

const router = Router();

// All comment routes require authentication
// Post comments
router.post('/posts/:id/comments', verifyToken, addComment);
router.get('/posts/:id/comments', verifyToken, getComments);

// Comment replies
router.post('/comments/:id/replies', verifyToken, addReply);
router.delete('/comments/:id', verifyToken, removeComment);

// Comment likes
router.post('/comments/:id/toggle-like', verifyToken, toggleLike);
router.get('/comments/:id/likes', verifyToken, getWhoLikedComment);

export default router;
