import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Register.css';
import { Box, Button, TextField, Typography, Tooltip } from '@mui/material';
import { apiFetch } from '../../lib/api';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      // Client-side password policy
      const policy = [
        [/^.{8,}$/, 'at least 8 characters'],
        (v) => /[a-z]/.test(v),
        (v) => /[A-Z]/.test(v),
        (v) => /[0-9]/.test(v),
        (v) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v),
      ];
      const ok = policy[0][0].test(password) && policy.slice(1).every((fn) => fn(password));
      if (!ok) throw new Error('Password must be min 8 chars and include lower, upper, number, symbol');

      await apiFetch('/auth/register/request', { method: 'POST', body: JSON.stringify({ name, email, password }) });
      sessionStorage.setItem('otpPurpose', 'register');
      sessionStorage.setItem('otpEmail', email);
      navigate('/otp');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-hero" style={{ backgroundImage: "url('" + process.env.PUBLIC_URL + "/images/register.jpg')" }} />
      <div className="register-panel">
        <div className="register-card">
          <Typography variant="h5" className="register-title">Get Started Now</Typography>
          <form onSubmit={onSubmit}>
            <Box className="form-group">
              <TextField fullWidth label="Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Enter your name" />
            </Box>
            <Box className="form-group">
              <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter your email" />
            </Box>
            <Box className="form-group">
              <Tooltip title="Min 8 chars, include lowercase, uppercase, number, and symbol" placement="top-start">
                <TextField fullWidth label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter your password" />
              </Tooltip>
            </Box>
            <Box className="form-group">
              <TextField fullWidth label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Repeat your password" />
            </Box>
            {error && <div className="error-text">{error}</div>}
            {success && <div className="meta-text" style={{ color: 'green' }}>{success}</div>}
            <Button className="register-button" type="submit" variant="contained" color="primary" disabled={submitting} fullWidth>
              {submitting ? 'Creating…' : 'Sign up'}
            </Button>
          </form>
          <div className="meta-text">
            Already have an account? <Link className="inline-link" to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}


