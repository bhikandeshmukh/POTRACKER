'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MessageCircle, Send, Reply, MoreVertical, Edit, Trash2, Heart, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastContainer';
import { commentService } from '@/lib/services';
import { getUserInfo } from '@/lib/utils/userUtils';
import { useDataFetching } from '@/hooks/useDataFetching';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import { Comment, User as UserType } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import { getAllUsers } from '@/lib/firestore';

interface CommentsSystemProps {
  poId: string;
  className?: string;
}

export default function CommentsSystem({ poId, className = '' }: CommentsSystemProps) {
  const { user, userData } = useAuth();
  const { showSuccess, showError } = useToast();
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [users, setUsers] = useState<(UserType & { id: string })[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = useCallback(async () => {
    return commentService.getCommentsForPO(poId);
  }, [poId]);

  const loadUsers = useCallback(async () => {
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Close mention dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setShowMentions(false);
      }
    };

    if (showMentions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMentions]);

  const { data: commentsResponse, loading, refetch } = useDataFetching(fetchComments);
  const comments = commentsResponse?.data || [];

  const { execute: executeAddComment, loading: addingComment } = useAsyncOperation(
    (content: string, parentId?: string) => 
      commentService.addComment(poId, getUserInfo(user, userData), content, parentId)
  );

  const { execute: executeUpdateComment } = useAsyncOperation(
    (commentId: string, content: string) => 
      commentService.updateComment(commentId, content, getUserInfo(user, userData))
  );

  const { execute: executeDeleteComment } = useAsyncOperation(
    (commentId: string) => 
      commentService.deleteComment(commentId, { uid: user!.uid, name: userData!.name, role: userData!.role })
  );

  const { execute: executeLikeComment } = useAsyncOperation(
    (commentId: string, isLiking: boolean) => 
      commentService.likeComment(commentId, user!.uid, isLiking)
  );

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user || !userData) return;

    const result = await executeAddComment(newComment, replyingTo || undefined);
    
    if (result) {
      setNewComment('');
      setReplyingTo(null);
      await refetch();
      showSuccess('Comment Added', 'Your comment has been posted successfully');
    } else {
      showError('Failed to Post Comment', 'Please try again');
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editContent.trim() || !user || !userData) return;

    const result = await executeUpdateComment(commentId, editContent);
    
    if (result) {
      setEditingComment(null);
      setEditContent('');
      await refetch();
      showSuccess('Comment Updated', 'Your comment has been updated');
    } else {
      showError('Failed to Update Comment', 'Please try again');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?') || !user || !userData) return;

    const result = await executeDeleteComment(commentId);
    
    if (result) {
      await refetch();
      showSuccess('Comment Deleted', 'Comment has been removed');
    } else {
      showError('Failed to Delete Comment', 'Please try again');
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;

    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    
    const isCurrentlyLiked = comment.likes.includes(user.uid);
    
    const result = await executeLikeComment(commentId, !isCurrentlyLiked);
    
    if (result) {
      await refetch();
    } else {
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

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setNewComment(value);
    setCursorPosition(cursorPos);
    
    // Check if user is typing a mention
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentions(true);
      setSelectedMentionIndex(0);
    } else {
      setShowMentions(false);
      setMentionQuery('');
      setSelectedMentionIndex(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < filteredUsers.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : filteredUsers.length - 1
        );
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredUsers[selectedMentionIndex].name);
      } else if (e.key === 'Escape') {
        setShowMentions(false);
        setMentionQuery('');
      }
    }
  };

  const insertMention = (userName: string) => {
    const textBeforeCursor = newComment.substring(0, cursorPosition);
    const textAfterCursor = newComment.substring(cursorPosition);
    
    // Find the @ symbol position
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const beforeAt = textBeforeCursor.substring(0, atIndex);
      const newText = beforeAt + `@${userName} ` + textAfterCursor;
      
      setNewComment(newText);
      setShowMentions(false);
      setMentionQuery('');
      
      // Focus back to textarea
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = beforeAt.length + userName.length + 2;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(mentionQuery.toLowerCase()) && 
    u.id !== user?.uid // Don't show current user
  ).slice(0, 5); // Limit to 5 suggestions

  const formatTimestamp = (timestamp: Date | Timestamp) => {
    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
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
                  <span className="text-xs text-gray-500">{formatTimestamp(comment.timestamp instanceof Date ? comment.timestamp : comment.timestamp.toDate())}</span>
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
                          setEditingComment(comment.id || '');
                          setEditContent(comment.content);
                        }}
                        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteComment(comment.id || '')}
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
                      onClick={() => handleEditComment(comment.id || '')}
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
                      <span 
                        key={index} 
                        className="text-blue-600 font-medium hover:text-blue-800 cursor-pointer bg-blue-50 px-1 rounded"
                        title={`Mentioned user: ${part}`}
                      >
                        {part}
                      </span>
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
                onClick={() => handleLikeComment(comment.id || '')}
                className={`flex items-center space-x-1 ${
                  isLiked ? 'text-red-600' : 'text-gray-500 hover:text-red-600'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                <span>{comment.likes.length}</span>
              </button>

              {!isReply && (
                <button
                  onClick={() => setReplyingTo(comment.id || '')}
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
            {replyingTo === comment.id && comment.id && (
              <div className="mt-3 ml-12">
                <div className="flex space-x-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-white" />
                  </div>
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={newComment}
                      onChange={handleTextareaChange}
                      onKeyDown={handleKeyDown}
                      placeholder={`Reply to ${comment.userName}... Use @username to mention`}
                      className="w-full p-2 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={2}
                    />
                    
                    {/* Mention Dropdown for Reply */}
                    {showMentions && filteredUsers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {filteredUsers.map((mentionUser, index) => (
                          <button
                            key={mentionUser.id}
                            onClick={() => insertMention(mentionUser.name)}
                            className={`w-full px-3 py-2 text-left flex items-center space-x-2 border-b border-gray-100 last:border-b-0 ${
                              index === selectedMentionIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                              <User className="w-3 h-3 text-white" />
                            </div>
                            <div>
                              <div className="font-medium text-sm text-gray-900">{mentionUser.name}</div>
                              <div className="text-xs text-gray-500">{mentionUser.role}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
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
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={newComment}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Add a comment... Use @username to mention someone"
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
              
              {/* Mention Dropdown */}
              {showMentions && filteredUsers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {filteredUsers.map((mentionUser, index) => (
                    <button
                      key={mentionUser.id}
                      onClick={() => insertMention(mentionUser.name)}
                      className={`w-full px-3 py-2 text-left flex items-center space-x-2 border-b border-gray-100 last:border-b-0 ${
                        index === selectedMentionIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <User className="w-3 h-3 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-sm text-gray-900">{mentionUser.name}</div>
                        <div className="text-xs text-gray-500">{mentionUser.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">
                  Tip: Use @username to mention team members
                </span>
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || addingComment}
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