'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, Send, Reply, MoreVertical, Edit, Trash2, Heart, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastContainer';

interface Comment {
  id: string;
  poId: string;
  userId: string;
  userName: string;
  userRole: string;
  content: string;
  timestamp: Date;
  parentId?: string; // For replies
  likes: string[]; // Array of user IDs who liked
  isEdited?: boolean;
  mentions?: string[]; // Array of mentioned user IDs
}

interface CommentsSystemProps {
  poId: string;
  className?: string;
}

export default function CommentsSystem({ poId, className = '' }: CommentsSystemProps) {
  const { user, userData } = useAuth();
  const { showSuccess, showError } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(false);

  // Mock comments data - in real app, fetch from Firestore
  useEffect(() => {
    loadComments();
  }, [poId]);

  const loadComments = async () => {
    // Mock data - replace with actual Firestore query
    const mockComments: Comment[] = [
      {
        id: '1',
        poId,
        userId: 'user1',
        userName: 'Bhikan Deshmukh',
        userRole: 'Admin',
        content: 'Please review the specifications for this order. The delivery date seems tight.',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        likes: ['user2'],
        mentions: []
      },
      {
        id: '2',
        poId,
        userId: 'user2',
        userName: 'Rajesh Kumar',
        userRole: 'Manager',
        content: 'I agree with @Bhikan. We should extend the delivery date by 3 days to ensure quality.',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        likes: ['user1'],
        mentions: ['user1'],
        parentId: '1'
      },
      {
        id: '3',
        poId,
        userId: 'user3',
        userName: 'Priya Sharma',
        userRole: 'Employee',
        content: 'The vendor has confirmed they can meet the original timeline. Should we proceed?',
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        likes: [],
        mentions: []
      }
    ];
    setComments(mockComments);
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;

    setLoading(true);
    try {
      const comment: Comment = {
        id: Date.now().toString(),
        poId,
        userId: user.uid,
        userName: userData?.name || 'Unknown User',
        userRole: userData?.role || 'Employee',
        content: newComment,
        timestamp: new Date(),
        likes: [],
        mentions: extractMentions(newComment),
        parentId: replyingTo || undefined
      };

      // In real app, save to Firestore
      setComments(prev => [...prev, comment]);
      setNewComment('');
      setReplyingTo(null);
      
      showSuccess('Comment Added', 'Your comment has been posted successfully');
    } catch (error) {
      showError('Failed to Post Comment', 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editContent.trim()) return;

    try {
      setComments(prev => prev.map(comment => 
        comment.id === commentId 
          ? { ...comment, content: editContent, isEdited: true }
          : comment
      ));
      
      setEditingComment(null);
      setEditContent('');
      showSuccess('Comment Updated', 'Your comment has been updated');
    } catch (error) {
      showError('Failed to Update Comment', 'Please try again');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      setComments(prev => prev.filter(comment => comment.id !== commentId));
      showSuccess('Comment Deleted', 'Comment has been removed');
    } catch (error) {
      showError('Failed to Delete Comment', 'Please try again');
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;

    try {
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          const likes = comment.likes.includes(user.uid)
            ? comment.likes.filter(id => id !== user.uid)
            : [...comment.likes, user.uid];
          return { ...comment, likes };
        }
        return comment;
      }));
    } catch (error) {
      showError('Failed to Like Comment', 'Please try again');
    }
  };

  const extractMentions = (content: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const isOwner = comment.userId === user?.uid;
    const canEdit = isOwner || userData?.role === 'Admin';
    const isLiked = user && comment.likes.includes(user.uid);

    return (
      <div key={comment.id} className={`${isReply ? 'ml-12 mt-3' : 'mb-6'}`}>
        <div className="flex space-x-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>

          {/* Comment Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-gray-50 rounded-lg p-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">{comment.userName}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    comment.userRole === 'Admin' ? 'bg-red-100 text-red-700' :
                    comment.userRole === 'Manager' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {comment.userRole}
                  </span>
                  <span className="text-xs text-gray-500">{formatTimestamp(comment.timestamp)}</span>
                  {comment.isEdited && (
                    <span className="text-xs text-gray-400">(edited)</span>
                  )}
                </div>

                {/* Actions Menu */}
                {canEdit && (
                  <div className="relative group">
                    <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <button
                        onClick={() => {
                          setEditingComment(comment.id);
                          setEditContent(comment.content);
                        }}
                        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Content */}
              {editingComment === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditComment(comment.id)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingComment(null);
                        setEditContent('');
                      }}
                      className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-800 text-sm leading-relaxed">
                  {comment.content.split(/(@\w+)/).map((part, index) => 
                    part.startsWith('@') ? (
                      <span key={index} className="text-blue-600 font-medium">{part}</span>
                    ) : (
                      part
                    )
                  )}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-4 mt-2 text-sm">
              <button
                onClick={() => handleLikeComment(comment.id)}
                className={`flex items-center space-x-1 ${
                  isLiked ? 'text-red-600' : 'text-gray-500 hover:text-red-600'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                <span>{comment.likes.length}</span>
              </button>

              {!isReply && (
                <button
                  onClick={() => setReplyingTo(comment.id)}
                  className="flex items-center space-x-1 text-gray-500 hover:text-blue-600"
                >
                  <Reply className="w-4 h-4" />
                  <span>Reply</span>
                </button>
              )}
            </div>

            {/* Replies */}
            {!isReply && comments
              .filter(c => c.parentId === comment.id)
              .map(reply => renderComment(reply, true))
            }

            {/* Reply Form */}
            {replyingTo === comment.id && (
              <div className="mt-3 ml-12">
                <div className="flex space-x-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-white" />
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={`Reply to ${comment.userName}...`}
                      className="w-full p-2 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={2}
                    />
                    <div className="flex space-x-2 mt-2">
                      <button
                        onClick={handleSubmitComment}
                        disabled={!newComment.trim() || loading}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        Reply
                      </button>
                      <button
                        onClick={() => {
                          setReplyingTo(null);
                          setNewComment('');
                        }}
                        className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const topLevelComments = comments.filter(comment => !comment.parentId);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center space-x-2 mb-6">
        <MessageCircle className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Comments ({comments.length})
        </h3>
      </div>

      {/* New Comment Form */}
      {user && !replyingTo && (
        <div className="mb-6">
          <div className="flex space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment... Use @username to mention someone"
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">
                  Tip: Use @username to mention team members
                </span>
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || loading}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  <span>Post Comment</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-6">
        {topLevelComments.length > 0 ? (
          topLevelComments.map(comment => renderComment(comment))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No comments yet. Be the first to comment!</p>
          </div>
        )}
      </div>
    </div>
  );
}