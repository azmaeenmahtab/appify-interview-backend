import pool from '../config/db';

export interface Comment {
  id?: number;
  user_id: number;
  post_id: number;
  parent_comment_id?: number | null;
  content: string;
  likes_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CommentWithUser extends Comment {
  user_first_name: string;
  user_last_name: string;
  user_email: string;
  is_liked_by_user?: boolean;
  replies?: CommentWithUser[];
  reply_count?: number;
}

export interface CommentLikeWithUser {
  id: number;
  user_id: number;
  comment_id: number;
  created_at: string;
  user_first_name: string;
  user_last_name: string;
  user_email: string;
}

// Create a comment or reply
export const createComment = async (comment: Comment): Promise<CommentWithUser> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert comment
    const result = await client.query(
      `INSERT INTO comments (user_id, post_id, parent_comment_id, content, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [comment.user_id, comment.post_id, comment.parent_comment_id || null, comment.content]
    );
    
    // Increment post comment count if it's a top-level comment
    if (!comment.parent_comment_id) {
      await client.query(
        'UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1',
        [comment.post_id]
      );
    }
    
    await client.query('COMMIT');
    
    // Fetch with user info
    const commentWithUser = await client.query(
      `SELECT 
        c.id, c.user_id, c.post_id, c.parent_comment_id, c.content, 
        c.likes_count, c.created_at, c.updated_at,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = $1`,
      [result.rows[0].id]
    );
    
    return commentWithUser.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Get comments for a post with nested replies (recursive)
export const getPostComments = async (
  postId: number, 
  userId?: number, 
  limit: number = 5, 
  offset: number = 0
): Promise<CommentWithUser[]> => {
  // Recursive CTE to get all comments and their nested replies
  const query = `
    WITH RECURSIVE comment_tree AS (
      -- Base case: top-level comments
      SELECT 
        c.id, c.user_id, c.post_id, c.parent_comment_id, c.content,
        c.likes_count, c.created_at, c.updated_at,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        ${userId ? `EXISTS(SELECT 1 FROM comment_likes WHERE comment_likes.comment_id = c.id AND comment_likes.user_id = $2) as is_liked_by_user,` : 'false as is_liked_by_user,'}
        0 as depth,
        ARRAY[c.created_at::text, LPAD(c.id::text, 10, '0')] as path
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1 AND c.parent_comment_id IS NULL
      
      UNION ALL
      
      -- Recursive case: replies to comments
      SELECT 
        c.id, c.user_id, c.post_id, c.parent_comment_id, c.content,
        c.likes_count, c.created_at, c.updated_at,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        ${userId ? `EXISTS(SELECT 1 FROM comment_likes WHERE comment_likes.comment_id = c.id AND comment_likes.user_id = $2) as is_liked_by_user,` : 'false as is_liked_by_user,'}
        ct.depth + 1,
        ct.path || ARRAY[c.created_at::text, LPAD(c.id::text, 10, '0')]
      FROM comments c
      JOIN users u ON c.user_id = u.id
      JOIN comment_tree ct ON c.parent_comment_id = ct.id
    )
    SELECT * FROM comment_tree
    ORDER BY path
    LIMIT $${userId ? 3 : 2} OFFSET $${userId ? 4 : 3}
  `;
  
  const params = userId 
    ? [postId, userId, limit * 10, offset] // Get more to account for nesting
    : [postId, limit * 10, offset];
  
  const result = await pool.query(query, params);
  
  // Build nested structure
  return buildCommentTree(result.rows);
};

// Helper function to build nested comment tree
function buildCommentTree(flatComments: any[]): CommentWithUser[] {
  const commentMap = new Map<number, CommentWithUser>();
  const rootComments: CommentWithUser[] = [];
  
  // First pass: create all comment objects
  flatComments.forEach(comment => {
    commentMap.set(comment.id, {
      ...comment,
      replies: [],
    });
  });
  
  // Second pass: build tree structure
  flatComments.forEach(comment => {
    const commentNode = commentMap.get(comment.id)!;
    
    if (comment.parent_comment_id === null) {
      rootComments.push(commentNode);
    } else {
      const parent = commentMap.get(comment.parent_comment_id);
      if (parent) {
        parent.replies!.push(commentNode);
      }
    }
  });
  
  return rootComments;
}

// Get single comment by ID
export const getCommentById = async (commentId: number): Promise<CommentWithUser | null> => {
  const result = await pool.query(
    `SELECT 
      c.id, c.user_id, c.post_id, c.parent_comment_id, c.content,
      c.likes_count, c.created_at, c.updated_at,
      u.first_name as user_first_name,
      u.last_name as user_last_name,
      u.email as user_email
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = $1`,
    [commentId]
  );
  
  return result.rows[0] || null;
};

// Delete a comment (cascades to replies via DB constraint)
export const deleteComment = async (commentId: number, userId: number): Promise<boolean> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get comment details
    const comment = await client.query(
      'SELECT post_id, parent_comment_id FROM comments WHERE id = $1 AND user_id = $2',
      [commentId, userId]
    );
    
    if (comment.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    
    // Delete comment (cascade will handle replies)
    await client.query('DELETE FROM comments WHERE id = $1', [commentId]);
    
    // Decrement post comment count if it was top-level
    if (!comment.rows[0].parent_comment_id) {
      await client.query(
        'UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = $1',
        [comment.rows[0].post_id]
      );
    }
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Toggle like on a comment
export const toggleCommentLike = async (commentId: number, userId: number): Promise<{ liked: boolean; likesCount: number }> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if user already liked the comment
    const checkLike = await client.query(
      'SELECT id FROM comment_likes WHERE user_id = $1 AND comment_id = $2',
      [userId, commentId]
    );
    
    let liked = false;
    
    if (checkLike.rows.length > 0) {
      // Unlike
      await client.query(
        'DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2',
        [userId, commentId]
      );
      await client.query(
        'UPDATE comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1',
        [commentId]
      );
      liked = false;
    } else {
      // Like
      await client.query(
        'INSERT INTO comment_likes (user_id, comment_id, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
        [userId, commentId]
      );
      await client.query(
        'UPDATE comments SET likes_count = likes_count + 1 WHERE id = $1',
        [commentId]
      );
      liked = true;
    }
    
    // Get updated likes count
    const result = await client.query(
      'SELECT likes_count FROM comments WHERE id = $1',
      [commentId]
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

// Get users who liked a comment
export const getCommentLikes = async (commentId: number, limit: number = 20, offset: number = 0): Promise<CommentLikeWithUser[]> => {
  const result = await pool.query(
    `SELECT 
      cl.id, cl.user_id, cl.comment_id, cl.created_at,
      u.first_name as user_first_name,
      u.last_name as user_last_name,
      u.email as user_email
    FROM comment_likes cl
    JOIN users u ON cl.user_id = u.id
    WHERE cl.comment_id = $1
    ORDER BY cl.created_at DESC
    LIMIT $2 OFFSET $3`,
    [commentId, limit, offset]
  );
  
  return result.rows;
};
