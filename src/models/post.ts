import pool from '../config/db';

export interface Post {
  id?: number;
  user_id: number;
  content?: string;
  image_url?: string;
  is_public: boolean;
  likes_count?: number;
  comments_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PostWithUser extends Post {
  user_first_name: string;
  user_last_name: string;
  user_email: string;
  is_liked_by_user?: boolean;
}

export interface LikeWithUser {
  id: number;
  user_id: number;
  post_id: number;
  created_at: string;
  user_first_name: string;
  user_last_name: string;
  user_email: string;
}

// Create a new post
export const createPost = async (post: Post): Promise<Post> => {
  const result = await pool.query(
    `INSERT INTO posts (user_id, content, image_url, is_public, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
     RETURNING *`,
    [post.user_id, post.content, post.image_url, post.is_public]
  );
  return result.rows[0];
};

// Get all posts with user information (for feed)
export const getPosts = async (userId?: number): Promise<PostWithUser[]> => {
  let query = `
    SELECT 
      p.id, p.user_id, p.content, p.image_url, p.is_public, 
      p.likes_count, p.comments_count, p.created_at, p.updated_at,
      u.first_name as user_first_name, 
      u.last_name as user_last_name, 
      u.email as user_email
  `;
  
  if (userId) {
    // Include is_liked_by_user for logged-in users
    query += `,
      EXISTS(SELECT 1 FROM likes WHERE likes.post_id = p.id AND likes.user_id = $1) as is_liked_by_user
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.is_public = true OR p.user_id = $1
    ORDER BY p.created_at DESC`;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } else {
    // No user logged in, show only public posts
    query += `
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.is_public = true 
    ORDER BY p.created_at DESC`;
    const result = await pool.query(query);
    return result.rows;
  }
};

// Get single post by ID
export const getPostById = async (postId: number): Promise<PostWithUser | null> => {
  const result = await pool.query(
    `SELECT 
      p.id, p.user_id, p.content, p.image_url, p.is_public, 
      p.likes_count, p.comments_count, p.created_at, p.updated_at,
      u.first_name as user_first_name, 
      u.last_name as user_last_name, 
      u.email as user_email
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.id = $1`,
    [postId]
  );
  return result.rows[0] || null;
};

// Delete a post (only by owner)
export const deletePost = async (postId: number, userId: number): Promise<boolean> => {
  const result = await pool.query(
    'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id',
    [postId, userId]
  );
  return result.rowCount ? result.rowCount > 0 : false;
};

// Get posts by specific user
export const getPostsByUserId = async (userId: number): Promise<PostWithUser[]> => {
  const result = await pool.query(
    `SELECT 
      p.id, p.user_id, p.content, p.image_url, p.is_public, 
      p.likes_count, p.comments_count, p.created_at, p.updated_at,
      u.first_name as user_first_name, 
      u.last_name as user_last_name, 
      u.email as user_email
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.user_id = $1
    ORDER BY p.created_at DESC`,
    [userId]
  );
  return result.rows;
};

// Toggle like on a post (like if not liked, unlike if already liked)
export const toggleLike = async (postId: number, userId: number): Promise<{ liked: boolean; likesCount: number }> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if user already liked the post
    const checkLike = await client.query(
      'SELECT id FROM likes WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );
    
    let liked = false;
    
    if (checkLike.rows.length > 0) {
      // Unlike: Remove like and decrement count
      await client.query(
        'DELETE FROM likes WHERE user_id = $1 AND post_id = $2',
        [userId, postId]
      );
      await client.query(
        'UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1',
        [postId]
      );
      liked = false;
    } else {
      // Like: Insert like and increment count
      await client.query(
        'INSERT INTO likes (user_id, post_id, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
        [userId, postId]
      );
      await client.query(
        'UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1',
        [postId]
      );
      liked = true;
    }
    
    // Get updated likes count
    const result = await client.query(
      'SELECT likes_count FROM posts WHERE id = $1',
      [postId]
    );
    
    await client.query('COMMIT');
    
    return {
      liked,
      likesCount: result.rows[0]?.likes_count || 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Get users who liked a post (paginated)
export const getPostLikes = async (postId: number, limit: number = 20, offset: number = 0): Promise<LikeWithUser[]> => {
  const result = await pool.query(
    `SELECT 
      l.id, l.user_id, l.post_id, l.created_at,
      u.first_name as user_first_name,
      u.last_name as user_last_name,
      u.email as user_email
    FROM likes l
    JOIN users u ON l.user_id = u.id
    WHERE l.post_id = $1
    ORDER BY l.created_at DESC
    LIMIT $2 OFFSET $3`,
    [postId, limit, offset]
  );
  return result.rows;
};

// Check if post can be accessed by user (for private post validation)
export const canAccessPost = async (postId: number, userId?: number): Promise<boolean> => {
  const result = await pool.query(
    'SELECT is_public, user_id FROM posts WHERE id = $1',
    [postId]
  );
  
  if (result.rows.length === 0) {
    return false; // Post doesn't exist
  }
  
  const post = result.rows[0];
  
  // Public posts are accessible to everyone
  if (post.is_public) {
    return true;
  }
  
  // Private posts only accessible to owner
  return userId !== undefined && post.user_id === userId;
};
