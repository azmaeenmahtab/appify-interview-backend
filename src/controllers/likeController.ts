import type { Request, Response } from 'express';
import { toggleLike, getPostLikes, canAccessPost, getPostById } from '../models/post';

// Toggle like/unlike on a post
export const togglePostLike = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Post ID is required' });
    }

    const postId = parseInt(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if post exists
    const post = await getPostById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user can access this post (private post validation)
    const canAccess = await canAccessPost(postId, parseInt(userId));
    if (!canAccess) {
      return res.status(403).json({ message: 'You do not have access to this post' });
    }

    // Toggle like
    const result = await toggleLike(postId, parseInt(userId));

    return res.json({
      message: result.liked ? 'Post liked' : 'Post unliked',
      liked: result.liked,
      likesCount: result.likesCount,
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    return res.status(500).json({ message: 'Failed to toggle like' });
  }
};

// Get users who liked a post
export const getWhoLiked = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Post ID is required' });
    }

    const postId = parseInt(req.params.id);
    const userId = req.user?.id ? parseInt(req.user.id) : undefined;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Check if post exists
    const post = await getPostById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user can access this post
    const canAccess = await canAccessPost(postId, userId);
    if (!canAccess) {
      return res.status(403).json({ message: 'You do not have access to this post' });
    }

    // Get likes with pagination
    const likes = await getPostLikes(postId, limit, offset);

    return res.json({
      likes,
      total: post.likes_count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching likes:', error);
    return res.status(500).json({ message: 'Failed to fetch likes' });
  }
};
