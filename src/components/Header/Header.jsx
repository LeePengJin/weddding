import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Container,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
  Badge,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../Button/Button';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../UserAvatar/UserAvatar';
import { useWebSocket } from '../../context/WebSocketContext';
import { apiFetch } from '../../lib/api';

const navLinks = [
  { name: 'Home', path: '/' },
  { name: 'About Us', path: '/about' },
  { name: 'Features', path: '/features' },
  { name: 'FAQ', path: '/faq' },
];

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const dropdownRef = useRef(null);
  let socket;
  let isConnected = false;

  try {
    const ws = useWebSocket();
    socket = ws.socket;
    isConnected = ws.isConnected;
  } catch (err) {
    socket = null;
  }

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const fetchUnread = async () => {
      if (!user) {
        setUnreadCount(0);
        return;
      }
      try {
        const data = await apiFetch('/conversations/unread-count');
        setUnreadCount(data.unreadCount || 0);
      } catch {
        setUnreadCount(0);
      }
    };

    fetchUnread();

    if (socket && isConnected) {
      const handleUpdate = () => fetchUnread();
      socket.on('conversation-updated', handleUpdate);
      socket.on('new-message-notification', handleUpdate);
      return () => {
        socket.off('conversation-updated', handleUpdate);
        socket.off('new-message-notification', handleUpdate);
      };
    }
  }, [user, socket, isConnected]);

  useEffect(() => {
    const handleConversationRead = () => {
      if (user) {
        apiFetch('/conversations/unread-count')
          .then((data) => setUnreadCount(data.unreadCount || 0))
          .catch(() => {});
      }
    };

    window.addEventListener('conversation-read', handleConversationRead);
    return () => window.removeEventListener('conversation-read', handleConversationRead);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleNavClick = (path) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleGetStarted = () => {
    navigate('/login');
    setIsMobileMenuOpen(false);
  };

  const handleMessages = () => {
    navigate('/messages');
    setIsMobileMenuOpen(false);
  };

  const handleProfile = () => {
    setDropdownOpen(false);
    navigate('/profile');
  };

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <Box
        component="header"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(148,163,184,0.25)',
          backgroundColor: 'rgba(255,255,255,0.92)',
          boxShadow: '0 6px 18px rgba(15,23,42,0.12)',
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            height: { xs: 68, md: 80 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            py: 1,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              cursor: 'pointer',
            }}
              onClick={() => handleNavClick('/')}
          >
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: '#f43f5e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 12px 24px rgba(244,63,94,0.25)',
                transition: 'all 0.3s ease',
              }}
            >
              <FavoriteIcon fontSize="small" />
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#0f172a',
              }}
            >
              Weddding
            </Typography>
          </Box>

          {isDesktop && (
            <Box
              component="nav"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                fontFamily: "'Literata', serif",
              }}
            >
              {navLinks.map((link) => {
                const active = isActive(link.path);
                return (
                  <Box
                    key={link.name}
                    component="button"
                    onClick={() => handleNavClick(link.path)}
                    sx={{
                      position: 'relative',
                      background: 'none',
                      border: 'none',
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      color: active ? '#f43f5e' : '#475569',
                      cursor: 'pointer',
                      px: 1.5,
                      pb: 1.2,
                      transition: 'color 0.2s ease',
                      '&:hover': { color: '#0f172a' },
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        left: '20%',
                        right: '20%',
                        bottom: 0,
                        height: 3,
                        borderRadius: 999,
                        backgroundColor: '#f43f5e',
                        transform: active ? 'scaleX(1)' : 'scaleX(0)',
                        opacity: active ? 1 : 0,
                        transition: 'transform 0.25s ease, opacity 0.25s ease',
                      },
                      '&:hover::after': {
                        transform: 'scaleX(1)',
                        opacity: 1,
                      },
                    }}
                  >
                    {link.name}
                  </Box>
                );
              })}
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {isDesktop && !loading && !user && (
              <Button size="sm" onClick={handleGetStarted}>
                Get Started
              </Button>
            )}

            {isDesktop && user && (
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}
                ref={dropdownRef}
              >
                <IconButton onClick={handleMessages} sx={{ color: '#0f172a' }}>
                  <Badge color="error" badgeContent={unreadCount > 99 ? '99+' : unreadCount || 0}>
                    <ChatBubbleOutlineIcon />
                  </Badge>
                </IconButton>
                <IconButton onClick={() => setDropdownOpen((prev) => !prev)}>
                  <UserAvatar user={user} size={34} />
                </IconButton>
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        position: 'absolute',
                        top: '110%',
                        right: 0,
                        background: '#fff',
                        borderRadius: 16,
                        border: '1px solid rgba(148,163,184,0.2)',
                        boxShadow: '0 25px 60px rgba(15,23,42,0.15)',
                        overflow: 'hidden',
                        minWidth: 180,
                      }}
                    >
                      <button
                        onClick={handleProfile}
                        style={{
                          width: '100%',
                          padding: '12px 18px',
                          background: 'none',
                          border: 'none',
                          textAlign: 'left',
                          fontFamily: "'Literata', serif",
                          cursor: 'pointer',
                        }}
                      >
                        Profile
                      </button>
                      <button
                        onClick={handleLogout}
                        style={{
                          width: '100%',
                          padding: '12px 18px',
                          background: 'none',
                          border: 'none',
                          textAlign: 'left',
                          fontFamily: "'Literata', serif",
                          cursor: 'pointer',
                        }}
                      >
                        Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>
            )}
            <IconButton
              onClick={() => setIsMobileMenuOpen(true)}
              sx={{
                display: { xs: 'flex', md: 'none' },
                borderRadius: '50%',
                backgroundColor: 'rgba(148,163,184,0.15)',
              }}
            >
              <MenuIcon />
            </IconButton>
          </Box>
        </Container>
      </Box>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 3,
                color: '#fff',
              }}
            >
              <Typography
                variant="h6"
                sx={{ fontFamily: "'Playfair Display', serif", letterSpacing: '0.08em' }}
              >
                Menu
              </Typography>
              <IconButton
                onClick={() => setIsMobileMenuOpen(false)}
                sx={{ color: '#fff' }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                color: '#fff',
              }}
            >
              {navLinks.map((link, idx) => (
                <motion.button
                  key={link.name}
                  onClick={() => handleNavClick(link.path)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + idx * 0.05 }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    fontSize: '1.8rem',
                    fontFamily: "'Playfair Display', serif",
                    cursor: 'pointer',
                  }}
                >
                  {link.name}
                </motion.button>
              ))}
              {!user && (
                <Button
                  size="md"
                  onClick={handleGetStarted}
                  style={{ width: '70%', marginTop: '1rem' }}
                >
                  Get Started
                </Button>
              )}
              {user && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '70%' }}>
                  <Button size="md" onClick={handleMessages}>
                    Messages
                  </Button>
                  <Button size="md" onClick={() => handleNavClick('/profile')}>
                    Profile
                  </Button>
                  <Button size="md" onClick={handleLogout}>
                    Logout
                  </Button>
                </Box>
              )}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
