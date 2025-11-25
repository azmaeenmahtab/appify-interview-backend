import type { Request, Response } from 'express';
import { createComment, getPostComments, getCommentById, deleteComment, toggleCommentLike, getCommentLikes } from '../models/comment';
import { getPostById, canAccessPost } from '../models/post';
import type { Comment } from '../models/comment';

// Create a comment on a post
export const addComment = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Post ID is required' });
    }

    const postId = parseInt(req.params.id);
    const userId = req.user?.id;
    const { content } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    // Check if post exists and user can access it
    const post = await getPostById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const canAccess = await canAccessPost(postId, parseInt(userId));
    if (!canAccess) {
      return res.status(403).json({ message: 'You do not have access to this post' });
    }

    // Create comment
    const comment: Comment = {
      user_id: parseInt(userId),
      post_id: postId,
      content: content.trim(),
    };

    const newComment = await createComment(comment);

    return res.status(201).json({
      message: 'Comment added successfully',
      comment: newComment,
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ message: 'Failed to add comment' });
  }
};

// Create a reply to a comment
export const addReply = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Comment ID is required' });
    }

    const parentCommentId = parseInt(req.params.id);
    const userId = req.user?.id;
    const { content } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Reply content is required' });
    }

    // Check if parent comment exists
    const parentComment = await getCommentById(parentCommentId);
    if (!parentComment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user can access the post
    const canAccess = await canAccessPost(parentComment.post_id, parseInt(userId));
    if (!canAccess) {
      return res.status(403).json({ message: 'You do not have access to this post' });
    }

    // Create reply
    const reply: Comment = {
      user_id: parseInt(userId),
      post_id: parentComment.post_id,
      parent_comment_id: parentCommentId,
      content: content.trim(),
    };

    const newReply = await createComment(reply);

    return res.status(201).json({
      message: 'Reply added successfully',
      comment: newReply,
    });
  } catch (error) {
    console.error('Error adding reply:', error);
    return res.status(500).json({ message: 'Failed to add reply' });
  }
};

// Get comments for a post
export const getComments = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Post ID is required' });
    }

    const postId = parseInt(req.params.id);
    const userId = req.user?.id ? parseInt(req.user.id) : undefined;
    const limit = parseInt(req.query.limit as string) || 5;
    const offset = parseInt(req.query.offset as string) || 0;

    // Check if post exists and user can access it
    const post = await getPostById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const canAccess = await canAccessPost(postId, userId);
    if (!canAccess) {
      return res.status(403).json({ message: 'You do not have access to this post' });
    }

    // Get comments
    const comments = await getPostComments(postId, userId, limit, offset);

    return res.json({
      comments,
      total: post.comments_count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({ message: 'Failed to fetch comments' });
  }
};

// Delete a comment
export const removeComment = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Comment ID is required' });
    }

    const commentId = parseInt(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const deleted = await deleteComment(commentId, parseInt(userId));

    if (!deleted) {
      return res.status(404).json({ message: 'Comment not found or unauthorized' });
    }

    return res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return res.status(500).json({ message: 'Failed to delete comment' });
  }
};

// Toggle like on comment
export const toggleLike = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Comment ID is required' });
    }

    const commentId = parseInt(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if comment exists
    const comment = await getCommentById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user can access the post
    const canAccess = await canAccessPost(comment.post_id, parseInt(userId));
    if (!canAccess) {
      return res.status(403).json({ message: 'You do not have access to this comment' });
    }

    // Toggle like
    const result = await toggleCommentLike(commentId, parseInt(userId));

    return res.json({
      message: result.liked ? 'Comment liked' : 'Comment unliked',
      liked: result.liked,
      likesCount: result.likesCount,
    });
  } catch (error) {
    console.error('Error toggling comment like:', error);
    return res.status(500).json({ message: 'Failed to toggle like' });
  }
};

// Get who liked a comment
export const getWhoLikedComment = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Comment ID is required' });
    }

    const commentId = parseInt(req.params.id);
    const userId = req.user?.id ? parseInt(req.user.id) : undefined;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Check if comment exists
    const comment = await getCommentById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user can access the post
    const canAccess = await canAccessPost(comment.post_id, userId);
    if (!canAccess) {
      return res.status(403).json({ message: 'You do not have access to this comment' });
    }

    // Get likes
    const likes = await getCommentLikes(commentId, limit, offset);

    return res.json({
      likes,
      total: comment.likes_count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching comment likes:', error);
    return res.status(500).json({ message: 'Failed to fetch likes' });
  }
};
