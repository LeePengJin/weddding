import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Grow } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

export default function VendorSubmitted() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f7f7fb',
        padding: 2,
      }}
    >
      <Grow in timeout={400}>
        <Box
          sx={{
            maxWidth: 520,
            width: '100%',
            textAlign: 'center',
            backgroundColor: 'white',
            borderRadius: 3,
            boxShadow: '0 10px 30px rgba(16,24,40,0.08)',
            px: { xs: 3, md: 6 },
            py: { xs: 6, md: 8 },
          }}
        >
          <CheckCircleOutlineIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            Your request has been submitted for verification.
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            You will be notified by email once your account is approved.
          </Typography>
          <Button variant="contained" color="primary" size="large" fullWidth onClick={() => navigate('/login')}>
            Return to Login
          </Button>
        </Box>
      </Grow>
    </Box>
  );
}


