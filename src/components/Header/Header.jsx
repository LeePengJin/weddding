import React, { useState, useEffect, useRef } from 'react';
import { Menu as MenuIcon, Close as CloseIcon, Favorite as HeartHandshakeIcon } from '@mui/icons-material';
import { Button } from '../Button/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../UserAvatar/UserAvatar';
import { IconButton, Box, useTheme, useMediaQuery, Typography, Badge } from '@mui/material';
import { useWebSocket } from '../../context/WebSocketContext';
import { apiFetch } from '../../lib/api';

export const Header = () => {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  let socket, isConnected;
  try {
    const ws = useWebSocket();
    socket = ws.socket;
    isConnected = ws.isConnected;
  } catch (err) {
    socket = null;
    isConnected = false;
  }
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Wedding Project', href: '/projects' },
    { name: 'About Us', href: '/about' },
  ];

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMobileMenuOpen]);

  const handleGetStarted = () => {
    if (user) {
      navigate('/projects');
    } else {
      navigate('/login');
    }
  };

  // Fetch unread message count
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const data = await apiFetch('/conversations/unread-count');
        setUnreadCount(data.unreadCount || 0);
      } catch (err) {
        setUnreadCount(0);
      }
    };

    fetchUnreadCount();

    // Listen for WebSocket updates
    if (socket && isConnected) {
      const handleConversationUpdate = () => {
        fetchUnreadCount();
      };

      const handleNewMessageNotification = () => {
        fetchUnreadCount();
      };

      socket.on('conversation-updated', handleConversationUpdate);
      socket.on('new-message-notification', handleNewMessageNotification);

      return () => {
        socket.off('conversation-updated', handleConversationUpdate);
        socket.off('new-message-notification', handleNewMessageNotification);
      };
    }
  }, [user, socket, isConnected]);

  // Listen for conversation-read events from Messages page
  useEffect(() => {
    const handleConversationRead = () => {
      if (user) {
        apiFetch('/conversations/unread-count')
          .then((data) => {
            setUnreadCount(data.unreadCount || 0);
          })
          .catch(() => {});
      }
    };

    window.addEventListener('conversation-read', handleConversationRead);
    return () => {
      window.removeEventListener('conversation-read', handleConversationRead);
    };
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleProfileClick = () => {
    setDropdownOpen(false);
    navigate('/profile');
  };

  const handleLogoutClick = () => {
    setDropdownOpen(false);
    logout();
  };

  return (
    <>
      {/* Floating Card Nav Container */}
      <Box
        sx={{
          position: 'fixed',
          top: 24,
          left: 0,
          right: 0,
          zIndex: 40,
          display: 'flex',
          justifyContent: 'center',
          px: 2,
          pointerEvents: 'none',
        }}
      >
        <motion.header 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
            borderRadius: '9999px',
            padding: isMobile ? '8px 12px' : '12px 24px',
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 16 : 48,
            maxWidth: '1280px',
            width: '100%',
            justifyContent: 'space-between',
          }}
        >
            {/* Logo */}
            <Link 
              to="/" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                textDecoration: 'none',
                paddingLeft: isMobile ? 8 : 0,
                flexShrink: 0,
              }}
            >
                <Box
                  sx={{
                    backgroundColor: '#f43f5e',
                    padding: '6px',
                    borderRadius: '50%',
                    color: 'white',
                    boxShadow: '0 4px 6px rgba(244, 63, 94, 0.2)',
                    transition: 'transform 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '&:hover': {
                      transform: 'rotate(12deg)',
                    },
                  }}
                >
                    <HeartHandshakeIcon sx={{ width: 20, height: 20 }} />
                </Box>
                <Typography
                  component="span"
                  sx={{
                    fontFamily: 'serif',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    letterSpacing: '-0.025em',
                    color: '#0f172a',
                  }}
                >
                  Weddding
                </Typography>
            </Link>

            {/* Desktop Nav with Sliding Indicator */}
            {!isMobile && (
              <Box
                component="nav"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  padding: '4px',
                  backgroundColor: 'rgba(148, 163, 184, 0.5)',
                  borderRadius: '9999px',
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                }}
              >
                {navLinks.map((link, index) => (
                  <Link
                    key={link.name}
                    to={link.href}
                    style={{
                      position: 'relative',
                      padding: '8px 20px',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: hoveredIndex === index ? '#0f172a' : '#475569',
                      textDecoration: 'none',
                      transition: 'color 0.2s',
                      zIndex: 10,
                      display: 'block',
                    }}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <AnimatePresence mode="wait">
                      {hoveredIndex === index && (
                        <motion.div
                          key="nav-hover"
                          layoutId="nav-hover"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'white',
                            borderRadius: '9999px',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            zIndex: -1,
                            pointerEvents: 'none',
                          }}
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                    </AnimatePresence>
                    <span style={{ position: 'relative', zIndex: 1 }}>
                      {link.name}
                    </span>
                  </Link>
                ))}
              </Box>
            )}

            {/* CTA & Mobile Toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                {!loading && !user && (
                  <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                    <Button size="sm" onClick={handleGetStarted}>Get Started</Button>
                  </Box>
                )}
                {!loading && user && (
                  <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1.5 }}>
                    <IconButton
                      onClick={() => navigate('/messages')}
                      sx={{
                        position: 'relative',
                        padding: 1,
                      }}
                      title="Messages"
                    >
                      <Badge badgeContent={unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : 0} color="error">
                        <Box
                          component="i"
                          className="fas fa-comment"
                          sx={{
                            fontSize: '1.2rem',
                            color: '#0f172a',
                          }}
                        />
                      </Badge>
                    </IconButton>
                    <Box sx={{ position: 'relative' }} ref={dropdownRef}>
                      <IconButton
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        sx={{
                          padding: 0.5,
                        }}
                      >
                        <UserAvatar user={user} size={32} />
                      </IconButton>
                      {dropdownOpen && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            mt: 1,
                            backgroundColor: 'white',
                            borderRadius: 2,
                            boxShadow: 3,
                            minWidth: 150,
                            zIndex: 1000,
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            component="button"
                            onClick={handleProfileClick}
                            sx={{
                              width: '100%',
                              padding: 1.5,
                              textAlign: 'left',
                              border: 'none',
                              backgroundColor: 'transparent',
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                              },
                            }}
                          >
                            Profile
                          </Box>
                          <Box
                            component="button"
                            onClick={handleLogoutClick}
                            sx={{
                              width: '100%',
                              padding: 1.5,
                              textAlign: 'left',
                              border: 'none',
                              backgroundColor: 'transparent',
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                              },
                            }}
                          >
                            Logout
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}
                
                <IconButton 
                    sx={{ 
                      display: { xs: 'flex', md: 'none' },
                      padding: 1.25,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(148, 163, 184, 0.1)',
                      '&:hover': { backgroundColor: 'rgba(148, 163, 184, 0.2)' }
                    }}
                    onClick={() => setIsMobileMenuOpen(true)}
                    aria-label="Toggle menu"
                >
                    <MenuIcon sx={{ width: 20, height: 20, color: '#0f172a' }} />
                </IconButton>
            </Box>
        </motion.header>
      </Box>

      {/* Full Screen Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, clipPath: "circle(0% at 100% 0%)" }}
            animate={{ opacity: 1, clipPath: "circle(150% at 100% 0%)" }}
            exit={{ opacity: 0, clipPath: "circle(0% at 100% 0%)" }}
            transition={{ type: "spring", damping: 25, stiffness: 100 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              backgroundColor: '#FAFAFA',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box sx={{ p: 3, pt: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 4 }}>
                 <Typography
                   sx={{
                     fontFamily: 'serif',
                     fontSize: '1.5rem',
                     fontWeight: 700,
                     color: '#0f172a',
                   }}
                 >
                   Menu
                 </Typography>
                 <IconButton 
                    onClick={() => setIsMobileMenuOpen(false)}
                    sx={{ 
                      padding: 1.5,
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      boxShadow: 2,
                      '&:hover': { boxShadow: 4 }
                    }}
                >
                    <CloseIcon sx={{ width: 24, height: 24, color: '#0f172a' }} />
                </IconButton>
            </Box>
            
            <Box
              component="nav"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                pb: 10,
              }}
            >
              {navLinks.map((link, idx) => (
                <motion.div
                  key={link.name}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + idx * 0.1 }}
                >
                  <Link
                    to={link.href}
                    style={{
                      fontSize: '2.25rem',
                      fontFamily: 'serif',
                      fontWeight: 500,
                      color: '#0f172a',
                      textDecoration: 'none',
                      transition: 'color 0.2s',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.color = '#f43f5e';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.color = '#0f172a';
                    }}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                style={{ marginTop: 40, width: '100%', padding: '0 40px', maxWidth: '384px' }}
              >
                <Button 
                  onClick={() => {
                    handleGetStarted();
                    setIsMobileMenuOpen(false);
                  }}
                  style={{ width: '100%', fontSize: '1.125rem', padding: '16px 0' }}
                >
                  {user ? 'Go to Projects' : 'Start Planning Free'}
                </Button>
              </motion.div>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
