import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ResetPassword.css';
import { Box, Button, TextField, Typography } from '@mui/material';
import { apiFetch } from '../../lib/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const prevPassword = sessionStorage.getItem('prevPassword') || '';

  const validatePassword = (pwd) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) return 'Password must contain at least one symbol';
    return null;
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const err = validatePassword(password);
    if (err) { setError(err); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    const email = sessionStorage.getItem('otpEmail');
    const code = sessionStorage.getItem('otpCode');
    if (!email || !code) { setError('Reset session expired. Please request a new OTP.'); return; }
    apiFetch('/auth/forgot/reset', { method: 'POST', body: JSON.stringify({ email, code, newPassword: password }) })
      .then(() => {
        setSuccess('Your password has been reset successfully. Redirecting to login…');
        sessionStorage.removeItem('otpPurpose');
        sessionStorage.removeItem('otpEmail');
        sessionStorage.removeItem('otpCode');
        setTimeout(() => navigate('/login'), 1200);
      })
      .catch((e2) => setError(e2.message || 'Reset failed'));
  };

  return (
    <div className="reset-page">
      <div className="reset-hero" style={{ backgroundImage: "url('" + process.env.PUBLIC_URL + "/images/password_reset.jpg')" }} />
      <div className="reset-panel">
        <div className="reset-card">
          <Typography variant="h5" className="reset-title">Reset Password</Typography>
          <Typography className="reset-subtitle">Please set a new password for your account.</Typography>
          <Box component="form" onSubmit={onSubmit}>
            <div className="form-group">
              <TextField fullWidth label="Create Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter your password" />
            </div>
            <div className="form-group">
              <TextField fullWidth label="Re-enter Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Re-enter your password" />
            </div>
            {error && <div className="error-text">{error}</div>}
            {success && <div className="success-text">{success}</div>}
            <Button className="reset-submit" variant="contained" color="primary" type="submit" fullWidth>Set Password</Button>
          </Box>
        </div>
      </div>
    </div>
  );
}


