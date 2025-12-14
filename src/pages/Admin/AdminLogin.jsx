import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography } from '@mui/material';
import { apiFetch } from '../../lib/api';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiFetch('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

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
      <Box
        sx={{
          maxWidth: 400,
          width: '100%',
          backgroundColor: 'white',
          borderRadius: 3,
          boxShadow: '0 10px 30px rgba(16,24,40,0.08)',
          px: 4,
          py: 5,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, textAlign: 'center' }}>
          Admin Login
        </Typography>
        <Box component="form" onSubmit={onSubmit}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            sx={{ mb: 2 }}
          />
          {error && (
            <Typography color="error" sx={{ mb: 2, fontSize: '0.875rem' }}>
              {error}
            </Typography>
          )}
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={submitting}
            sx={{ mt: 1 }}
          >
            {submitting ? 'Logging in...' : 'Login'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

