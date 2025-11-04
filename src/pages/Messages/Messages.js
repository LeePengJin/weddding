import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Messages.styles.css';

const Messages = () => {
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');

  // Mock data - In real app, this would come from API/database
  const [conversations] = useState([
    {
      id: 1,
      participantName: "Elegant Moments Photography",
      participantType: "vendor",
      participantAvatar: "https://ui-avatars.com/api/?name=EP&background=E16789&color=fff",
      lastMessage: "Thank you for your interest! I'd be happy to discuss your wedding photography needs.",
      timestamp: "2025-07-28T10:30:00",
      unread: false
    },
    {
      id: 2,
      participantName: "Golden Palace Catering",
      participantType: "vendor",
      participantAvatar: "https://ui-avatars.com/api/?name=GC&background=E16789&color=fff",
      lastMessage: "Here's the menu options we discussed. Let me know if you'd like to schedule a tasting.",
      timestamp: "2025-07-27T15:45:00",
      unread: false
    },
    {
      id: 3,
      participantName: "Blooming Gardens Florist",
      participantType: "vendor",
      participantAvatar: "https://ui-avatars.com/api/?name=BF&background=E16789&color=fff",
      lastMessage: "I've attached some flower arrangement samples based on your color scheme.",
      timestamp: "2025-07-26T09:15:00",
      unread: false
    }
  ]);

  const [messages] = useState({
    1: [
      {
        id: 1,
        senderId: "couple",
        senderName: "Sarah & John",
        content: "Hi! We love your portfolio and would like to know more about your wedding photography packages. We're planning our wedding for June 2025.",
        timestamp: "2025-07-28T10:15:00"
      },
      {
        id: 2,
        senderId: "vendor",
        senderName: "Elegant Moments Photography",
        content: "Hello Sarah & John! Thank you for reaching out. I'd be happy to discuss our wedding packages with you.",
        timestamp: "2025-07-28T10:20:00"
      },
      {
        id: 3,
        senderId: "couple",
        senderName: "Sarah & John",
        content: "Great! We're particularly interested in your full-day coverage options. Could you share the details and pricing?",
        timestamp: "2025-07-28T10:25:00"
      },
      {
        id: 4,
        senderId: "vendor",
        senderName: "Elegant Moments Photography",
        content: "Of course! I'll send over our full-day package details right away. Would you also like to schedule a consultation to discuss your specific needs?",
        timestamp: "2025-07-28T10:30:00"
      }
    ]
  });

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    const newMessageObj = {
      id: Date.now(),
      senderId: "couple",
      senderName: "Sarah & John",
      content: newMessage.trim(),
      timestamp: new Date().toISOString()
    };

    // In real app, this would be handled by API/database
    messages[selectedConversation.id] = [
      ...(messages[selectedConversation.id] || []),
      newMessageObj
    ];

    setNewMessage('');
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="messages-container">
      {/* Conversations List */}
      <div className="conversations-list">
        <div className="conversations-header">
          <h2>Messages</h2>
        </div>

        <div className="conversations">
          {conversations.map(conversation => (
            <div
              key={conversation.id}
              className={`conversation-item ${selectedConversation?.id === conversation.id ? 'active' : ''} ${conversation.unread ? 'unread' : ''}`}
              onClick={() => setSelectedConversation(conversation)}
            >
              <div className="conversation-avatar">
                <img src={conversation.participantAvatar} alt={conversation.participantName} />
              </div>
              <div className="conversation-content">
                <div className="conversation-header">
                  <h3>{conversation.participantName}</h3>
                  <span className="timestamp">{formatTimestamp(conversation.timestamp)}</span>
                </div>
                <p className="last-message">{conversation.lastMessage}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Window */}
      <div className="chat-window">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div className="chat-participant">
                <img 
                  src={selectedConversation.participantAvatar} 
                  alt={selectedConversation.participantName}
                  className="participant-avatar"
                />
                {selectedConversation.participantType === 'couple' ? (
                  <Link to={`/couple-profile/${selectedConversation.id}`} className="participant-name">
                    {selectedConversation.participantName}
                  </Link>
                ) : (
                  <span className="participant-name">{selectedConversation.participantName}</span>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="messages-list">
              {messages[selectedConversation.id]?.map(message => (
                <div
                  key={message.id}
                  className={`message ${message.senderId === 'couple' ? 'sent' : 'received'}`}
                >
                  <div className="message-content">
                    {message.content}
                  </div>
                  <div className="message-timestamp">
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <form className="message-input" onSubmit={handleSendMessage}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
              />
              <button type="submit" disabled={!newMessage.trim()}>
                <i className="fas fa-paper-plane"></i>
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