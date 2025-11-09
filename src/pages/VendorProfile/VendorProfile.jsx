import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  Avatar,
  Divider,
  Paper,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import ConfirmationDialog from '../../components/ConfirmationDialog/ConfirmationDialog';
import { validateMalaysianContactNumber, validateName as validateNameUtil } from '../../utils/validation';
import './VendorProfile.css';


const VendorProfile = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    businessName: '',
    email: '',
    contactNumber: '',
    location: '',
    description: '',
    profileImage: null,
  });

  const [originalData, setOriginalData] = useState({
    businessName: '',
    contactNumber: '',
    location: '',
    description: '',
  });

  const [originalProfileImage, setOriginalProfileImage] = useState(null);
  const [displayData, setDisplayData] = useState({
    businessName: '',
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({
    businessName: '',
    contactNumber: '',
    location: '',
    description: '',
    profileImage: '',
  });

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Initialize form data from user
  useEffect(() => {
    if (user) {
      const vendor = user.vendor || {};
      const initialData = {
        businessName: user.name || '',
        email: user.email || '',
        contactNumber: user.contactNumber || '',
        location: vendor.location || '',
        description: vendor.description || '',
        profileImage: null,
      };
      setFormData(initialData);
      setOriginalData({
        businessName: initialData.businessName,
        contactNumber: initialData.contactNumber,
        location: initialData.location,
        description: initialData.description,
      });
      setOriginalProfileImage(user.profilePicture || null);
      // Set display data (only updates after save)
      setDisplayData({
        businessName: initialData.businessName,
      });
    }
  }, [user]);

  // Track changes
  useEffect(() => {
    const businessNameChanged = formData.businessName !== originalData.businessName;
    const contactChanged = formData.contactNumber !== originalData.contactNumber;
    const locationChanged = formData.location !== originalData.location;
    const descriptionChanged = formData.description !== originalData.description;
    const imageChanged = formData.profileImage instanceof File;

    setHasChanges(
      businessNameChanged ||
      contactChanged ||
      locationChanged ||
      descriptionChanged ||
      imageChanged
    );
  }, [formData, originalData]);

  // Validation functions
  const validateBusinessName = (name) => {
    return validateNameUtil(name, 120); // Business name max 120 characters
  };

  const validateContactNumber = (contactNumber) => {
    if (!contactNumber || !contactNumber.trim()) {
      return ''; // Contact number is optional
    }
    return validateMalaysianContactNumber(contactNumber);
  };

  const validateLocation = (location) => {
    if (!location || !location.trim()) {
      return ''; // Location is optional
    }
    if (location.length < 2) {
      return 'Location must be at least 2 characters';
    }
    if (location.length > 120) {
      return 'Location must be at most 120 characters';
    }
    const SAFE_TEXT = /^[A-Za-z0-9 .,'-]+$/;
    if (!SAFE_TEXT.test(location)) {
      return 'Location may only include letters, numbers, spaces, period, comma, apostrophe, and hyphen';
    }
    return '';
  };

  const validateDescription = (description) => {
    if (!description || !description.trim()) {
      return ''; // Description is optional
    }
    if (description.length > 2000) {
      return 'Description must be at most 2000 characters';
    }
    return '';
  };

  const validateProfileImage = (file) => {
    if (!file) {
      return '';
    }
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file (JPG, PNG, GIF, etc.)';
    }
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return 'Image size must be less than 5MB';
    }
    return '';
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');

    // Real-time validation
    if (field === 'businessName') {
      const error = validateBusinessName(value);
      setFieldErrors((prev) => ({ ...prev, businessName: error }));
    } else if (field === 'contactNumber') {
      const error = validateContactNumber(value);
      setFieldErrors((prev) => ({ ...prev, contactNumber: error }));
    } else if (field === 'location') {
      const error = validateLocation(value);
      setFieldErrors((prev) => ({ ...prev, location: error }));
    } else if (field === 'description') {
      const error = validateDescription(value);
      setFieldErrors((prev) => ({ ...prev, description: error }));
    }
  };

  const handleInputBlur = (field, value) => {
    // Validate on blur
    if (field === 'businessName') {
      const error = validateBusinessName(value);
      setFieldErrors((prev) => ({ ...prev, businessName: error }));
    } else if (field === 'contactNumber') {
      const error = validateContactNumber(value);
      setFieldErrors((prev) => ({ ...prev, contactNumber: error }));
    } else if (field === 'location') {
      const error = validateLocation(value);
      setFieldErrors((prev) => ({ ...prev, location: error }));
    } else if (field === 'description') {
      const error = validateDescription(value);
      setFieldErrors((prev) => ({ ...prev, description: error }));
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageError = validateProfileImage(file);
      if (imageError) {
        setFieldErrors((prev) => ({ ...prev, profileImage: imageError }));
        setError(imageError);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      setFieldErrors((prev) => ({ ...prev, profileImage: '' }));
      setError('');

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const newPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(newPreviewUrl);
      setFormData((prev) => ({ ...prev, profileImage: file }));
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) {
      setError('Unable to get your email address');
      return;
    }

    try {
      await apiFetch('/auth/forgot/request', {
        method: 'POST',
        body: JSON.stringify({ email: user.email }),
      });
      sessionStorage.setItem('otpPurpose', 'change_password');
      sessionStorage.setItem('otpEmail', user.email);
      navigate('/otp');
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    }
  };

  const validateAllFields = () => {
    const businessNameError = validateBusinessName(formData.businessName);
    const contactError = validateContactNumber(formData.contactNumber);
    const locationError = validateLocation(formData.location);
    const descriptionError = validateDescription(formData.description);
    const imageError = formData.profileImage instanceof File
      ? validateProfileImage(formData.profileImage)
      : '';

    setFieldErrors({
      businessName: businessNameError,
      contactNumber: contactError,
      location: locationError,
      description: descriptionError,
      profileImage: imageError,
    });

    return !businessNameError && !contactError && !locationError && !descriptionError && !imageError;
  };

  const handleSave = () => {
    if (!hasChanges) {
      setError('No changes to save');
      return;
    }

    if (!validateAllFields()) {
      setError('Please fix the errors before saving');
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmDialog(false);
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updateData = {};

      if (formData.businessName !== originalData.businessName) {
        updateData.name = formData.businessName;
      }
      if (formData.contactNumber !== originalData.contactNumber) {
        updateData.contactNumber = formData.contactNumber;
      }
      if (formData.location !== originalData.location) {
        updateData.location = formData.location;
      }
      if (formData.description !== originalData.description) {
        updateData.description = formData.description;
      }

      // Handle profile image upload
      if (formData.profileImage instanceof File) {
        const formDataToSend = new FormData();
        formDataToSend.append('profileImage', formData.profileImage);

        const imageResponse = await apiFetch('/auth/profile/image', {
          method: 'POST',
          body: formDataToSend,
        });

        if (imageResponse.profileImageUrl) {
          updateData.profilePicture = imageResponse.profileImageUrl;
        }
      }

      // Update profile
      if (Object.keys(updateData).length > 0) {
        await apiFetch('/auth/profile', {
          method: 'PATCH',
          body: JSON.stringify(updateData),
        });
      }

      setSuccess('Profile updated successfully!');
      setOriginalData({
        businessName: formData.businessName,
        contactNumber: formData.contactNumber,
        location: formData.location,
        description: formData.description,
      });
      // Update display data only after successful save
      setDisplayData({
        businessName: formData.businessName,
      });
      if (formData.profileImage instanceof File && updateData.profilePicture) {
        setOriginalProfileImage(updateData.profilePicture);
      }
      setFormData((prev) => ({ ...prev, profileImage: null }));

      window.location.reload();
    } catch (err) {
      setError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Update document title
  useEffect(() => {
    document.title = 'Profile - Weddding';
    return () => {
      document.title = 'Weddding';
    };
  }, []);

  // Helper function to convert relative image URLs to full backend URLs
  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/uploads')) {
      return `http://localhost:4000${url}`;
    }
    return url;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!user || user.role !== 'vendor') {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Access denied. Vendor account required.</Typography>
      </Box>
    );
  }

  const profileImageUrl = formData.profileImage instanceof File
    ? previewUrl
    : getImageUrl(originalProfileImage || user?.profilePicture || null);

  const avatarUser = profileImageUrl
    ? null
    : { ...user, name: displayData.businessName || user?.name };

  return (
    <Box className="vendor-profile-page">
      <Box className="vendor-profile-container">
        {/* Header Section with Avatar */}
        <Paper 
          elevation={0} 
          className="vendor-profile-header"
          sx={{
            background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
            borderRadius: 3,
            border: '1px solid #e0e0e0',
            p: 4,
          }}
        >
          <Box className="vendor-profile-header-content">
            <Box className="vendor-profile-avatar-section">
              {profileImageUrl ? (
                <Avatar
                  src={profileImageUrl}
                  alt="Profile"
                  onClick={handleAvatarClick}
                  sx={{
                    width: 140,
                    height: 140,
                    cursor: 'pointer',
                    border: '4px solid #f5bdba',
                    boxShadow: '0 4px 12px rgba(245, 189, 186, 0.3)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: '0 6px 16px rgba(245, 189, 186, 0.4)',
                    },
                  }}
                />
              ) : (
                <Box 
                  onClick={handleAvatarClick} 
                  sx={{ 
                    cursor: 'pointer',
                    transition: 'transform 0.3s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                    },
                  }}
                >
                  <UserAvatar user={avatarUser || user} size={140} />
                </Box>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              {fieldErrors.profileImage && (
                <Typography
                  sx={{
                    color: 'error.main',
                    fontSize: '11px',
                    mt: 1,
                    textAlign: 'center',
                    maxWidth: 250,
                  }}
                >
                  {fieldErrors.profileImage}
                </Typography>
              )}
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
                {displayData.businessName || 'Business Name'}
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  fontSize: '14px',
                  color: '#666',
                }}
              >
                Click avatar to change profile picture
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Main Content Card */}
        <Card elevation={0} className="vendor-profile-card" sx={{ borderRadius: 3, border: '1px solid #e0e0e0' }}>
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            <Typography variant="h6" sx={{ mb: 4, fontWeight: 600, color: '#474747', fontSize: '18px', letterSpacing: '0.5px' }}>
              BUSINESS INFORMATION
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
              {/* Email - Read Only */}
              <TextField
                fullWidth
                label="Email"
                value={formData.email}
                disabled
                variant="outlined"
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: '14px',
                    color: '#838383',
                    border: 'none',
                  },
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#f9fafb',
                  },
                }}
              />

              {/* Business Name */}
              <TextField
                fullWidth
                label="Business Name"
                value={formData.businessName}
                onChange={(e) => handleInputChange('businessName', e.target.value)}
                onBlur={(e) => handleInputBlur('businessName', e.target.value)}
                error={!!fieldErrors.businessName}
                helperText={fieldErrors.businessName}
                variant="outlined"
                required
                sx={{
                  '& .MuiInputBase-input':{
                    border: 'none',
                  },
                  '& .MuiFormHelperText-root': {
                    fontSize: '12px',
                    marginTop: '4px',
                  },
                }}
              />

              {/* Contact Number */}
              <TextField
                fullWidth
                label="Contact Number"
                value={formData.contactNumber}
                onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                onBlur={(e) => handleInputBlur('contactNumber', e.target.value)}
                error={!!fieldErrors.contactNumber}
                helperText={fieldErrors.contactNumber || 'e.g., 012-3456789, 03-87654321'}
                variant="outlined"
                placeholder="e.g., 012-3456789"
                sx={{
                  '& .MuiInputBase-input':{
                    border: 'none',
                  },'& .MuiFormHelperText-root': {
                    fontSize: '12px',
                    marginTop: '4px',
                  },
                }}
              />

              {/* Location */}
              <TextField
                fullWidth
                label="Location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                onBlur={(e) => handleInputBlur('location', e.target.value)}
                error={!!fieldErrors.location}
                helperText={fieldErrors.location}
                variant="outlined"
                placeholder="Enter your business location"
                multiline
                rows={2}
                sx={{
                  '& .MuiFormHelperText-root': {
                    fontSize: '12px',
                    marginTop: '4px',
                  },
                }}
              />

              {/* Description */}
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                onBlur={(e) => handleInputBlur('description', e.target.value)}
                error={!!fieldErrors.description}
                helperText={fieldErrors.description || `${formData.description.length}/2000 characters`}
                variant="outlined"
                multiline
                rows={12}
                placeholder="Describe your business, services, and what makes you unique..."
                sx={{
                  '& .MuiFormHelperText-root': {
                    fontSize: '12px',
                    marginTop: '4px',
                  },
                }}
              />
            </Box>

            <Divider sx={{ my: 5, borderColor: '#e0e0e0' }} />

            {/* Password Section */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 2.5, fontWeight: 600, color: '#474747', fontSize: '16px' }}>
                Password
              </Typography>
              <Button
                variant="contained"
                onClick={handleChangePassword}
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
                Change Password
              </Button>
            </Box>

            {/* Error and Success Messages */}
            {error && (
              <Typography color="error" sx={{ mb: 2, fontSize: '14px' }}>
                {error}
              </Typography>
            )}
            {success && (
              <Typography color="success.main" sx={{ mb: 2, fontSize: '14px' }}>
                {success}
              </Typography>
            )}

            {/* Save Button */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 5, pt: 3, borderTop: '1px solid #e0e0e0' }}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={!hasChanges || saving}
                sx={{
                  backgroundColor: '#e16789',
                  color: '#ffffff',
                  textTransform: 'none',
                  px: 5,
                  py: 1.5,
                  borderRadius: 2,
                  fontSize: '15px',
                  fontWeight: 600,
                  minWidth: 160,
                  boxShadow: '0 2px 8px rgba(225, 103, 137, 0.3)',
                  '&:hover': {
                    backgroundColor: '#d1537a',
                    boxShadow: '0 4px 12px rgba(225, 103, 137, 0.4)',
                    transform: 'translateY(-1px)',
                  },
                  '&:disabled': {
                    backgroundColor: '#e0e0e0',
                    color: '#9e9e9e',
                    boxShadow: 'none',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmSave}
        title="Save Changes?"
        description="Are you sure you want to save the changes to your profile?"
        confirmText="Save"
        cancelText="Cancel"
      />
    </Box>
  );
};

export default VendorProfile;

