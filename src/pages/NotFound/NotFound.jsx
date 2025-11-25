import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { Home as HomeIcon, Search as SearchIcon, FavoriteBorder as HeartIcon } from '@mui/icons-material';
import { Button } from '../../components/Button/Button';

export default function NotFound() {
  const navigate = useNavigate();

  const handleNavigate = (page) => {
    if (page === 'home') {
      navigate('/');
    } else if (page === 'faq') {
      // Navigate to help center or search - for now just go to home
      navigate('/');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#FAFAFA',
        position: 'relative',
        overflow: 'hidden',
        pt: '80px',
      }}
    >
      {/* Background Decorative Elements */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '25%',
            left: '25%',
            width: '384px',
            height: '384px',
            bgcolor: 'rgba(255, 182, 193, 0.5)',
            borderRadius: '50%',
            filter: 'blur(120px)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '25%',
            right: '25%',
            width: '320px',
            height: '320px',
            bgcolor: 'rgba(211, 211, 211, 0.8)',
            borderRadius: '50%',
            filter: 'blur(100px)',
          }}
        />
      </Box>

      <Box
        sx={{
          maxWidth: '1200px',
          mx: 'auto',
          px: 3,
          textAlign: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ marginBottom: '2rem', position: 'relative', display: 'inline-block' }}
        >
          <Box
            sx={{
              fontSize: { xs: '10rem', md: '12rem' },
              fontFamily: 'serif',
              lineHeight: 1,
              color: '#fce7f3',
              userSelect: 'none',
            }}
          >
            404
          </Box>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <motion.div
              initial={{ rotate: -10 }}
              animate={{ rotate: 10 }}
              transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            >
              <HeartIcon
                sx={{
                  width: '96px',
                  height: '96px',
                  color: '#f9a8d4',
                  strokeWidth: 1.5,
                }}
              />
            </motion.div>
          </Box>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontFamily: 'serif',
            color: '#0f172a',
            marginBottom: '1.5rem',
            fontWeight: 400,
          }}
        >
          This page got cold feet.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          style={{
            fontSize: '1.125rem',
            color: '#64748b',
            maxWidth: '28rem',
            margin: '0 auto 2.5rem',
            lineHeight: 1.75,
          }}
        >
          We couldn't find the page you were looking for. It might have been moved, deleted, or perhaps it just eloped.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
          <Button
            onClick={() => handleNavigate('home')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <HomeIcon sx={{ width: '16px', height: '16px' }} />
            Return Home
          </Button>
          <Box
            component="button"
            onClick={() => handleNavigate('faq')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              px: 3,
              py: 1.5,
              borderRadius: '9999px',
              color: '#475569',
              bgcolor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '1rem',
              transition: 'all 0.3s',
              '&:hover': {
                color: '#f43f5e',
                bgcolor: '#fff1f2',
              },
            }}
          >
            <SearchIcon sx={{ width: '16px', height: '16px' }} />
            Search Help Center
          </Box>
          </Box>
        </motion.div>
      </Box>
    </Box>
  );
}
