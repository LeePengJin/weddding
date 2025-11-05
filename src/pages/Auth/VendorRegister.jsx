import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import './VendorRegister.css';
import { Box, Button, Grid, MenuItem, TextField, Typography } from '@mui/material';

const BUSINESS_TYPES = [
  'Photographer',
  'Videographer',
  'Venue',
  'Caterer',
  'Florist',
  'DJ/Music',
  'Other'
];

export default function VendorRegister() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    businessName: '',
    email: '',
    password: '',
    confirmPassword: '',
    contactNumber: '',
    businessType: '',
    location: '',
    verificationDocs: []
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // Combine with existing files
    const currentFiles = formData.verificationDocs;
    const totalFiles = currentFiles.length + files.length;
    
    if (totalFiles > 5) {
      setError(`Maximum 5 files allowed. You already have ${currentFiles.length} file(s).`);
      e.target.value = ''; // Reset input
      return;
    }
    
    setFormData(prev => ({ ...prev, verificationDocs: [...prev.verificationDocs, ...files] }));
    setError('');
    e.target.value = ''; // Reset input to allow selecting same files again if needed
  };

  const removeFile = (index) => {
    setFormData(prev => ({
      ...prev,
      verificationDocs: prev.verificationDocs.filter((_, i) => i !== index)
    }));
    setError('');
  };

  const validatePassword = (password) => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return 'Password must contain at least one symbol';
    }
    return null;
  };

  const validateForm = () => {
    if (!formData.businessName.trim()) {
      return 'Business name is required';
    }
    if (!formData.email.trim()) {
      return 'Email is required';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      return 'Please enter a valid email address';
    }
    if (!formData.password) {
      return 'Password is required';
    }
    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      return passwordError;
    }
    if (!formData.confirmPassword) {
      return 'Please confirm your password';
    }
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }
    if (!formData.contactNumber.trim()) {
      return 'Contact number is required';
    }
    if (!/^[\d\s\-\+(\)]+$/.test(formData.contactNumber)) {
      return 'Please enter a valid contact number';
    }
    if (!formData.businessType) {
      return 'Business type is required';
    }
    if (!formData.location.trim()) {
      return 'Location is required';
    }
    if (formData.verificationDocs.length === 0) {
      return 'At least one verification document is required';
    }
    if (formData.verificationDocs.length > 5) {
      return 'Maximum 5 files allowed';
    }
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('businessName', formData.businessName);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('password', formData.password);
      formDataToSend.append('contactNumber', formData.contactNumber);
      formDataToSend.append('businessType', formData.businessType);
      formDataToSend.append('location', formData.location);
      
      // Append all verification documents
      formData.verificationDocs.forEach((file, index) => {
        formDataToSend.append(`verificationDocs`, file);
      });

      const response = await fetch('http://localhost:4000/auth/vendor/register', {
        method: 'POST',
        credentials: 'include',
        body: formDataToSend
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(errorData.error || 'Registration failed');
      }

      setSuccess('Registration request submitted! You will receive an email once your account is approved.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="vendor-register-page">
      <div className="vendor-register-hero" style={{ backgroundImage: "url('" + process.env.PUBLIC_URL + "/images/vendor_registration.jpg')" }} />
      <div className="vendor-register-panel">
        <div className="vendor-register-card">
          <Typography variant="h5" className="vendor-register-title">Start business with Weddding</Typography>
          <Box component="form" onSubmit={onSubmit}>
            <Box className="form-group">
              <TextField fullWidth label="Business name" name="businessName" value={formData.businessName} onChange={handleChange} required placeholder="Enter your business name" />
            </Box>

            <Box className="form-group">
              <TextField fullWidth label="Email" name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="Enter your email" />
            </Box>

            <Box className="form-group">
              <TextField fullWidth label="Password" name="password" type="password" value={formData.password} onChange={handleChange} required placeholder="Enter your password" />
            </Box>

            <Box className="form-group">
              <TextField fullWidth label="Confirm Password" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required placeholder="Repeat your password" />
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Contact number" name="contactNumber" type="tel" value={formData.contactNumber} onChange={handleChange} required placeholder="Enter company contact number" />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField select fullWidth label="Business Type" name="businessType" value={formData.businessType} onChange={handleChange} required sx={{ minWidth: 280 }}>
                  <MenuItem value="">Select a business type</MenuItem>
                  {BUSINESS_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            <Box className="form-group">
              <TextField fullWidth label="Location" name="location" value={formData.location} onChange={handleChange} required placeholder="Enter company Location" />
            </Box>

            <div className="form-group">
              <label className="field-label">Verification Documents</label>
              <div className="file-upload-wrapper">
                <input
                  type="file"
                  id="verificationDocs"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  multiple
                  className="file-input"
                />
                <label htmlFor="verificationDocs" className="file-upload-button">
                  {formData.verificationDocs.length > 0 
                    ? `${formData.verificationDocs.length} file(s) selected` 
                    : 'Select File(s)'}
                </label>
                <div className="file-info">
                  {formData.verificationDocs.length > 0 && (
                    <span className="file-count">(1-5 files allowed)</span>
                  )}
                </div>
              </div>
              {formData.verificationDocs.length > 0 && (
                <div className="file-list">
                  {formData.verificationDocs.map((file, index) => (
                    <div key={index} className="file-item">
                      <span className="file-name">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="file-remove"
                        aria-label="Remove file"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="error-text">{error}</div>}
            {success && <div className="success-text">{success}</div>}

            <Button className="vendor-register-button" type="submit" variant="contained" color="primary" disabled={submitting} fullWidth>
              {submitting ? 'Submitting…' : 'Request Account Creation'}
            </Button>
          </Box>
          <div className="meta-text">
            Already have an account? <Link className="inline-link" to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

