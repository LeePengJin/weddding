import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      // Disconnect if user logs out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Get token from cookies
    const getToken = () => {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'token') {
          return value;
        }
      }
      return null;
    };

    // Try to get token from cookies (may not work if httpOnly)
    const token = getToken();
    
    // Create socket connection
    // Note: httpOnly cookies are sent automatically by browser if withCredentials is true
    // The server will read the token from the cookie header
    const newSocket = io('http://localhost:4000', {
      ...(token ? { auth: { token: token } } : {}),
      transports: ['websocket', 'polling'], // Fallback to polling if WebSocket fails
      withCredentials: true, // Send cookies automatically (including httpOnly cookies)
      autoConnect: true,
    });
    
    console.log('🔌 Creating WebSocket connection...', {
      hasToken: !!token,
      withCredentials: true,
      note: token ? 'Using token from cookie' : 'Will use httpOnly cookie from browser',
    });
    
    console.log('🔌 Creating WebSocket connection...', {
      hasToken: !!token,
      withCredentials: true,
      note: token ? 'Using token from cookie' : 'Will use httpOnly cookie from browser',
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected, socket ID:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('⚠️ WebSocket connection error:', error.message);
      console.error('Error details:', error);
      setIsConnected(false);
      
      // If it's an auth error, don't retry (will keep failing)
      if (error.message?.includes('Authentication') || error.message?.includes('token')) {
        console.error('❌ Authentication failed. Make sure you are logged in.');
        return;
      }
      
      // Retry connection after a delay for other errors
      setTimeout(() => {
        if (socketRef.current && !socketRef.current.connected) {
          console.log('🔄 Retrying WebSocket connection...');
          socketRef.current.connect();
        }
      }, 3000);
    });

    // Debug: Log all events for troubleshooting (disabled to reduce console noise)
    // Uncomment if needed for debugging:
    // newSocket.onAny((event, ...args) => {
    //   console.log('📡 WebSocket event:', event, args);
    // });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [user]);

  const joinConversation = useCallback((conversationId) => {
    if (socket && isConnected) {
      socket.emit('join-conversation', conversationId);
    }
  }, [socket, isConnected]);

  const leaveConversation = useCallback((conversationId) => {
    if (socket && isConnected) {
      socket.emit('leave-conversation', conversationId);
    }
  }, [socket, isConnected]);

  const value = {
    socket,
    isConnected,
    joinConversation,
    leaveConversation,
  };

  // Expose WebSocket status to window for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__websocketStatus = {
        connected: isConnected,
        socketId: socket?.id,
        socket: socket,
      };
    }
  }, [socket, isConnected]);

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
}

