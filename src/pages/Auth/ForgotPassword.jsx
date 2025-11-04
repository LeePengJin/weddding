import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './ForgotPassword.css';
import { Box, Button, TextField, Typography } from '@mui/material';
import { apiFetch } from '../../lib/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/auth/forgot/request', { method: 'POST', body: JSON.stringify({ email }) });
      sessionStorage.setItem('otpPurpose', 'reset');
      sessionStorage.setItem('otpEmail', email);
      setSuccess('If the email exists, an OTP has been sent.');
      setTimeout(() => (window.location.href = '/otp'), 500);
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="forgot-page">
      <div className="forgot-hero" style={{ backgroundImage: "url('" + process.env.PUBLIC_URL + "/images/password_reset.jpg')" }} />
      <div className="forgot-panel">
        <div className="forgot-card">
          <Button className="back-link" onClick={() => navigate('/login')} sx={{ p: 0, mb: 1 }}>
            <span className="back-icon">←</span> Back to login
          </Button>
          <Typography variant="h5" className="forgot-title">Forget your password?</Typography>
          <Typography className="forgot-subtitle">Don’t worry, happens to all of us. Enter your email below to recover your password.</Typography>
          <form onSubmit={onSubmit}>
            <div className="form-group">
              <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter your email" />
            </div>
            {error && <div className="error-text">{error}</div>}
            {success && <div className="success-text">{success}</div>}
            <Button className="forgot-submit" variant="contained" color="primary" type="submit" disabled={submitting} fullWidth>{submitting ? 'Submitting…' : 'Submit'}</Button>
          </form>
          <div className="meta-text">
            Remember your password? <Link className="inline-link" to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}


