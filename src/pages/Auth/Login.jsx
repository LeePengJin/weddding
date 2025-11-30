import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Login.css';
import { Box, Button, TextField, Typography } from '@mui/material';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(email, password);
      // Always redirect based on user role, ignoring stale location state
      // This ensures vendors go to vendor dashboard and couples go to their dashboard
      if (user.role === 'vendor') {
        navigate('/vendor/dashboard', { replace: true });
      } else if (user.role === 'couple') {
        // For couples, check if there's a valid from location that matches their role
        const from = location.state?.from?.pathname;
        // Only use 'from' if it's not a vendor/admin route
        if (from && !from.startsWith('/vendor') && !from.startsWith('/admin')) {
          navigate(from, { replace: true });
        } else {
          navigate('/project-dashboard', { replace: true });
        }
      } else {
        // Default to homepage
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-hero" style={{ backgroundImage: "url('" + process.env.PUBLIC_URL + "/images/login.jpg')" }} />
      <div className="login-panel">
        <div className="login-card">
          <Typography variant="h5" className="login-title">Welcome back</Typography>
          <form className="form-group" onSubmit={onSubmit}>
            <Box className="form-group">
              <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter your email" variant="outlined" />
            </Box>
            <Box className="form-group">
              <TextField fullWidth label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter your password" variant="outlined" />
            </Box>
            <Link className="helper-link" to="/forgot-password">Forgot password?</Link>
            {error && <div style={{ color: 'red', margin: '8px 16px' }}>{error}</div>}
            <Button className="login-button" type="submit" variant="contained" color="primary" disabled={submitting} fullWidth sx={{ mt: 1 }}>
              {submitting ? 'Signing in…' : 'Log in'}
            </Button>
          </form>
          <div className="meta-text">
            Don't have an account? <Link className="inline-link" to="/register">Sign up</Link> &nbsp;  
            <br></br>Want to become a partner of Weddding? <Link className="inline-link" to="/vendor/register">Click here!</Link>
          </div>
        </div>
      </div>
    </div>
  );
}


