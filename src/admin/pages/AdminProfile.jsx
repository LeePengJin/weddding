import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, Paper, TextField, Typography } from '@mui/material';
import { apiFetch } from '../../lib/api';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import './AdminProfile.css';

export default function AdminProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await apiFetch('/admin/auth/me');
        if (cancelled) return;
        setAdmin({ ...me, role: 'admin', status: 'active' });
      } catch {
        if (cancelled) return;
        navigate('/admin/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const profile = useMemo(() => {
    return {
      name: admin?.name || '',
      email: admin?.email || '',
      contactNumber: admin?.contactNumber || '',
      role: admin?.role || 'admin',
      status: admin?.status || 'active',
    };
  }, [admin]);

  const validatePassword = (pwd) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) return 'Password must contain at least one symbol';
    return null;
  };

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');
    const err = validatePassword(newPassword);
    if (!currentPassword) {
      setError('Current password is required');
      return;
    }
    if (err) {
      setError(err);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setChanging(true);
    try {
      await apiFetch('/admin/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setError(e?.message || 'Failed to change password');
    } finally {
      setChanging(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!admin) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Access denied. Admin account required.</Typography>
      </Box>
    );
  }

  return (
    <Box className="admin-profile-page">
      <Box className="admin-profile-container">
        <Paper
          elevation={0}
          className="admin-profile-header"
          sx={{
            background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
            borderRadius: 3,
            border: '1px solid #e0e0e0',
            p: 4,
          }}
        >
          <Box className="admin-profile-header-content">
            <Box className="admin-profile-avatar-section">
              <UserAvatar user={admin} size={140} />
              <Typography
                variant="h4"
                sx={{
                  mt: 3,
                  mb: 0.5,
                  fontWeight: 700,
                  color: '#1a1a1a',
                  fontSize: { xs: '1.5rem', md: '1.75rem' },
                }}
              >
                {profile.name || 'Admin'}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontSize: '14px',
                  color: '#666',
                }}
              >
                Your admin profile details are read-only.
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Card elevation={0} className="admin-profile-card" sx={{ borderRadius: 3, border: '1px solid #e0e0e0' }}>
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            <Typography
              variant="h6"
              sx={{ mb: 4, fontWeight: 600, color: '#474747', fontSize: '18px', letterSpacing: '0.5px' }}
            >
              ADMIN INFORMATION
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
              <TextField
                fullWidth
                label="Name"
                value={profile.name}
                disabled
                variant="outlined"
                sx={{
                  '& .MuiInputBase-input': { fontSize: '14px', color: '#838383' },
                  '& .MuiOutlinedInput-root': { backgroundColor: '#f9fafb' },
                }}
              />

              <TextField
                fullWidth
                label="Email"
                value={profile.email}
                disabled
                variant="outlined"
                sx={{
                  '& .MuiInputBase-input': { fontSize: '14px', color: '#838383' },
                  '& .MuiOutlinedInput-root': { backgroundColor: '#f9fafb' },
                }}
              />

              <TextField
                fullWidth
                label="Contact Number"
                value={profile.contactNumber}
                disabled
                variant="outlined"
                sx={{
                  '& .MuiInputBase-input': { fontSize: '14px', color: '#838383' },
                  '& .MuiOutlinedInput-root': { backgroundColor: '#f9fafb' },
                }}
              />

              <TextField
                fullWidth
                label="Role"
                value={profile.role}
                disabled
                variant="outlined"
                sx={{
                  '& .MuiInputBase-input': { fontSize: '14px', color: '#838383' },
                  '& .MuiOutlinedInput-root': { backgroundColor: '#f9fafb' },
                }}
              />

              <TextField
                fullWidth
                label="Account Status"
                value={profile.status}
                disabled
                variant="outlined"
                sx={{
                  '& .MuiInputBase-input': { fontSize: '14px', color: '#838383' },
                  '& .MuiOutlinedInput-root': { backgroundColor: '#f9fafb' },
                }}
              />
            </Box>

            <Box sx={{ mt: 5, pt: 3, borderTop: '1px solid #e0e0e0' }}>
              <Typography variant="subtitle1" sx={{ mb: 2.5, fontWeight: 600, color: '#474747', fontSize: '16px' }}>
                Password
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 520 }}>
                <TextField
                  fullWidth
                  label="Current Password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <TextField
                  fullWidth
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  helperText="Min 8 chars, with uppercase, lowercase, number, and symbol"
                />
                <TextField
                  fullWidth
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Box>
                  <Button
                    variant="contained"
                    onClick={handleChangePassword}
                    disabled={changing}
                    sx={{
                      backgroundColor: '#e16789',
                      color: '#ffffff',
                      textTransform: 'none',
                      px: 4,
                      py: 1.25,
                      borderRadius: 2,
                      fontSize: '14px',
                      fontWeight: 500,
                      boxShadow: '0 2px 8px rgba(225, 103, 137, 0.3)',
                      '&:hover': {
                        backgroundColor: '#d1537a',
                        boxShadow: '0 4px 12px rgba(225, 103, 137, 0.4)',
                      },
                    }}
                  >
                    {changing ? 'Updating...' : 'Update Password'}
                  </Button>
                </Box>
              </Box>

              {error && (
                <Typography color="error" sx={{ mt: 2, fontSize: '14px' }}>
                  {error}
                </Typography>
              )}
              {success && (
                <Typography color="success.main" sx={{ mt: 2, fontSize: '14px' }}>
                  {success}
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}


