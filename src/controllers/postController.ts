import type { Request, Response } from 'express';
import { createPost, getPosts, getPostById, deletePost } from '../models/post';
import type { Post } from '../models/post';

// Create a new post
export const create = async (req: Request, res: Response) => {
  try {
    const { content, isPublic } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Validate: either content or image must be present
    const imageUrl = req.file ? (req.file as any).path : null;
    
    if (!content && !imageUrl) {
      return res.status(400).json({ message: 'Post must contain text or an image' });
    }

    const post: Post = {
      user_id: parseInt(userId),
      content: content || null,
      image_url: imageUrl,
      is_public: isPublic === 'true' || isPublic === true,
    };

    const newPost = await createPost(post);
    
    return res.status(201).json({
      message: 'Post created successfully',
      post: newPost,
    });
  } catch (error) {
    console.error('Error creating post:', error);
    return res.status(500).json({ message: 'Failed to create post' });
  }
};

// Get all posts (feed)
export const getAll = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id ? parseInt(req.user.id) : undefined;
    const posts = await getPosts(userId);
    
    return res.json({ posts });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return res.status(500).json({ message: 'Failed to fetch posts' });
  }
};

// Get single post
export const getOne = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Post ID is required' });
    }
    
    const postId = parseInt(req.params.id);
    const post = await getPostById(postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    return res.json({ post });
  } catch (error) {
    console.error('Error fetching post:', error);
    return res.status(500).json({ message: 'Failed to fetch post' });
  }
};

// Delete a post
export const remove = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Post ID is required' });
    }
    
    const postId = parseInt(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const deleted = await deletePost(postId, parseInt(userId));

    if (!deleted) {
      return res.status(404).json({ message: 'Post not found or unauthorized' });
    }

    return res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    return res.status(500).json({ message: 'Failed to delete post' });
  }
};
