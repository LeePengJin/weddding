import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { apiFetch } from '../../lib/api';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import { IconButton, Tooltip, Box } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import './Messages.styles.css';

const Messages = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { socket, isConnected, joinConversation, leaveConversation } = useWebSocket();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const previousConversationIdRef = useRef(null);

  // Get conversation ID from URL params (for navigation from catalog)
  const conversationIdFromUrl = searchParams.get('conversationId');

  useEffect(() => {
    fetchConversations();
  }, [user]);

  useEffect(() => {
    if (conversationIdFromUrl && conversations && conversations.length > 0) {
      // Find and select the conversation from URL
      const conv = conversations.find((c) => c && c.id === conversationIdFromUrl && c.participant);
      if (conv) {
        setSelectedConversation(conv);
      }
    }
  }, [conversationIdFromUrl, conversations]);

  // Handle WebSocket events
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Listen for new messages in the current conversation
    const handleNewMessage = (message) => {
      if (selectedConversation && message.conversationId === selectedConversation.id) {
        setMessages((prev) => {
          // Check if message already exists (avoid duplicates)
          const exists = prev.some((m) => m.id === message.id || (m.id?.startsWith('temp-') && m.content === message.content && m.senderId === message.senderId));
          if (exists) {
            // Replace temp message with real message
            return prev.map((m) => 
              (m.id?.startsWith('temp-') && m.content === message.content && m.senderId === message.senderId) 
                ? message 
                : m
            );
          }
          return [...prev, message];
        });
        // Refresh conversations to update last message (debounced to avoid excessive calls)
        setTimeout(() => fetchConversations(), 100);
      } else {
        // Message in another conversation - just refresh conversations (debounced)
        setTimeout(() => fetchConversations(), 100);
      }
    };

    // Listen for conversation updates (unread counts, etc.)
    const handleConversationUpdate = (conversation) => {
      setConversations((prev) => {
        const index = prev.findIndex((c) => c.id === conversation.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...conversation };
          return updated;
        } else {
          // New conversation
          return [conversation, ...prev];
        }
      });
    };

    // Listen for new message notifications (for unread badges)
    const handleNewMessageNotification = (data) => {
      fetchConversations(); // Refresh to update unread counts
    };

    socket.on('new-message', handleNewMessage);
    socket.on('conversation-updated', handleConversationUpdate);
    socket.on('new-message-notification', handleNewMessageNotification);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('conversation-updated', handleConversationUpdate);
      socket.off('new-message-notification', handleNewMessageNotification);
    };
  }, [socket, isConnected, selectedConversation]);

  // Join/leave conversation rooms when selection changes
  useEffect(() => {
    const conversationId = selectedConversation?.id;
    
    if (!socket) {
      // Still fetch messages even without socket
      if (conversationId) {
        fetchMessages(conversationId);
      }
      return;
    }

    // If not connected, wait for connection then join
    if (!isConnected) {
      const handleConnect = () => {
        if (conversationId && conversationId !== previousConversationIdRef.current) {
          if (previousConversationIdRef.current) {
            leaveConversation(previousConversationIdRef.current);
          }
          joinConversation(conversationId);
          previousConversationIdRef.current = conversationId;
          fetchMessages(conversationId);
        }
      };
      socket.once('connect', handleConnect);
      // Still fetch messages
      if (conversationId) {
        fetchMessages(conversationId);
      }
      return () => {
        socket.off('connect', handleConnect);
      };
    }

    // Only join/leave if conversation actually changed
    if (conversationId !== previousConversationIdRef.current) {
      // Leave previous conversation room
      if (previousConversationIdRef.current) {
        leaveConversation(previousConversationIdRef.current);
      }

      // Join new conversation room
      if (conversationId) {
        joinConversation(conversationId);
        previousConversationIdRef.current = conversationId;
        fetchMessages(conversationId);
      } else {
        previousConversationIdRef.current = null;
      }
    }

    return () => {
      // Only leave on unmount if we have a conversation
      if (previousConversationIdRef.current && conversationId === previousConversationIdRef.current) {
        leaveConversation(previousConversationIdRef.current);
      }
    };
  }, [selectedConversation?.id, socket, isConnected]); // Removed joinConversation/leaveConversation from deps

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/conversations');
      // Ensure data is an array and filter out any invalid entries
      const validConversations = Array.isArray(data) 
        ? data.filter((c) => c && c.id && c.participant)
        : [];
      setConversations(validConversations);
      
      // If URL has conversationId, select it
      if (conversationIdFromUrl) {
        const conv = validConversations.find((c) => c.id === conversationIdFromUrl);
        if (conv && conv.participant) {
          setSelectedConversation(conv);
        }
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
      setConversations([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const data = await apiFetch(`/conversations/${conversationId}/messages`);
      setMessages(data);
      
      // Refresh conversations to update unread count after marking as read
      fetchConversations();
      
      // Trigger a custom event to notify Navbar to refresh unread count
      // This ensures the navbar counter updates immediately
      window.dispatchEvent(new CustomEvent('conversation-read', { 
        detail: { conversationId } 
      }));
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX

    try {
      setSending(true);
      
      // Optimistically add message for instant feedback
      const tempMessage = {
        id: `temp-${Date.now()}`,
        conversationId: selectedConversation.id,
        senderId: user?.id,
        content: messageContent,
        timestamp: new Date().toISOString(),
        sender: {
          id: user?.id,
          name: user?.name || 'You',
        },
      };
      setMessages((prev) => [...prev, tempMessage]);

      // Send to server
      const message = await apiFetch(`/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: messageContent }),
      });

      // Replace temp message with real message (in case WebSocket doesn't fire)
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempMessage.id);
        // Check if message already exists (from WebSocket)
        const exists = filtered.some((m) => m.id === message.id);
        if (!exists) {
          return [...filtered, message];
        }
        return filtered;
      });
      
      // Refresh conversations to update last message
      fetchConversations();
    } catch (err) {
      console.error('Failed to send message:', err);
      // Restore message input on error
      setNewMessage(messageContent);
      // Remove temp message
      setMessages((prev) => prev.filter((m) => !m.id?.startsWith('temp-')));
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const isMessageFromCurrentUser = (message) => {
    return message.senderId === user?.id;
  };

  // Check if user is vendor and if we're in vendor layout
  const isVendor = user?.role === 'vendor';
  const isInVendorLayout = location.pathname.startsWith('/vendor/messages');

  if (loading && conversations.length === 0) {
    return (
      <div className={`messages-container ${isVendor ? 'vendor-view' : ''}`}>
        <div className="loading-container">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading conversations...</p>
        </div>
      </div>
    );
  }

  // Get connection status color
  const getConnectionStatusColor = () => {
    if (isConnected) return '#4caf50'; // Green - connected
    if (socket && !isConnected) return '#ff9800'; // Orange - connecting/reconnecting
    return '#f44336'; // Red - disconnected/not connected
  };

  return (
    <div className={`messages-container ${isVendor && !isInVendorLayout ? 'vendor-view' : ''} ${isInVendorLayout ? 'in-vendor-layout' : ''}`}>

      {/* Conversations List */}
      <div className={`conversations-list ${selectedConversation ? 'mobile-hidden' : 'mobile-visible'}`}>
        <div className="conversations-header">
          {isInVendorLayout && (
            <Tooltip title="Back to Dashboard">
              <IconButton
                onClick={() => navigate('/vendor/dashboard')}
                sx={{ mr: 1, color: '#111827' }}
                aria-label="Back to dashboard"
              >
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>
          )}
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Messages
            <Box
              sx={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: getConnectionStatusColor(),
                flexShrink: 0,
              }}
            />
          </h2>
          {selectedConversation && (
            <button
              className="mobile-back-btn"
              onClick={() => {
                setSelectedConversation(null);
                const basePath = isInVendorLayout ? '/vendor/messages' : '/messages';
                navigate(basePath, { replace: true });
              }}
              aria-label="Back to conversations"
            >
              <i className="fas fa-arrow-left"></i>
            </button>
          )}
        </div>

        <div className="conversations">
          {!conversations || conversations.length === 0 ? (
            <div className="no-conversations">
              <i className="fas fa-comments"></i>
              <p>No conversations yet</p>
              <p className="hint">Start a conversation from a product detail page</p>
            </div>
          ) : (
            conversations
              .filter((conversation) => conversation && conversation.id && conversation.participant)
              .map((conversation) => (
                <div
                  key={conversation.id}
                  className={`conversation-item ${
                    selectedConversation?.id === conversation.id ? 'active' : ''
                  } ${conversation.unreadCount > 0 ? 'unread' : ''}`}
                  onClick={() => {
                    setSelectedConversation(conversation);
                    // Update URL without reload
                    const basePath = isInVendorLayout ? '/vendor/messages' : '/messages';
                    navigate(`${basePath}?conversationId=${conversation.id}`, { replace: true });
                  }}
                >
                  <div className="conversation-avatar">
                    <UserAvatar
                      user={{
                        id: conversation.participant?.id || '',
                        name: conversation.participant?.name || 'Unknown',
                        profilePicture: conversation.participant?.profilePicture,
                      }}
                      size={48}
                    />
                  </div>
                  <div className="conversation-content">
                    <div className="conversation-header">
                      <h3>{conversation.participant?.name || 'Unknown'}</h3>
                      {conversation.lastMessage && (
                        <span className="timestamp">
                          {formatTimestamp(conversation.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    <div className="conversation-footer">
                      <p className="last-message">
                        {conversation.lastMessage
                          ? conversation.lastMessage.content
                          : 'No messages yet'}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <span className="unread-badge">{conversation.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className={`chat-window ${selectedConversation ? 'mobile-visible' : 'mobile-hidden'}`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              {isInVendorLayout && (
                <Tooltip title="Back to Dashboard">
                  <IconButton
                    onClick={() => navigate('/vendor/dashboard')}
                    sx={{ mr: 1, color: '#111827' }}
                    aria-label="Back to dashboard"
                  >
                    <ArrowBackIcon />
                  </IconButton>
                </Tooltip>
              )}
              <div className="chat-participant">
                <UserAvatar
                  user={{
                    id: selectedConversation?.participant?.id || '',
                    name: selectedConversation?.participant?.name || 'Unknown',
                    profilePicture: selectedConversation?.participant?.profilePicture,
                  }}
                  size={40}
                />
                <span className="participant-name">{selectedConversation?.participant?.name || 'Unknown'}</span>
              </div>
            </div>

            {/* Messages */}
            <div className="messages-list">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <i className="fas fa-comment-dots"></i>
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`message ${isMessageFromCurrentUser(message) ? 'sent' : 'received'}`}
                  >
                    <div className="message-content">{message.content}</div>
                    <div className="message-timestamp">
                      {formatTimestamp(message.timestamp)}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form className="message-input" onSubmit={handleSendMessage}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
              />
              <button type="submit" disabled={!newMessage.trim() || sending}>
                {sending ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <i className="fas fa-paper-plane"></i>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="no-conversation-selected">
            <i className="fas fa-comments"></i>
            <h3>Select a conversation to start messaging</h3>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
