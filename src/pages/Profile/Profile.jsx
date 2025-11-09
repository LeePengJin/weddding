import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, TextField, Button, Typography } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import ConfirmationDialog from '../../components/ConfirmationDialog/ConfirmationDialog';
import { validateMalaysianContactNumber, validateName as validateNameUtil } from '../../utils/validation';
import './Profile.css';

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    contactNumber: '',
    email: '',
    profileImage: null, // This will be a File object when a new image is selected
  });

  const [originalData, setOriginalData] = useState({
    name: '',
    contactNumber: '',
  });

  const [originalProfileImage, setOriginalProfileImage] = useState(null);

  const [hasChanges, setHasChanges] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({
    name: '',
    contactNumber: '',
    profileImage: '',
  });

  // Cleanup object URL on unmount or when file changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (user) {
      const initialData = {
        name: user.name || '',
        contactNumber: user.contactNumber || user.phone || '',
        email: user.email || '',
        profileImage: null, // Only track new file uploads here
      };
      setFormData(initialData);
      setOriginalData({
        name: initialData.name,
        contactNumber: initialData.contactNumber,
      });
      setOriginalProfileImage(user.profilePicture || null);
    }
  }, [user]);

  useEffect(() => {
    const nameChanged = formData.name !== originalData.name;
    const contactChanged = formData.contactNumber !== originalData.contactNumber;
    const imageChanged = formData.profileImage instanceof File;
    
    setHasChanges(nameChanged || contactChanged || imageChanged);
  }, [formData, originalData]);

  // Validation functions using shared utilities
  const validateName = (name) => {
    return validateNameUtil(name);
  };

  const validateContactNumber = (contactNumber) => {
    if (!contactNumber || !contactNumber.trim()) {
      return ''; // Contact number is optional in profile
    }
    return validateMalaysianContactNumber(contactNumber);
  };

  const validateProfileImage = (file) => {
    if (!file) {
      return '';
    }
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file (JPG, PNG, GIF, etc.)';
    }
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      return 'Image size must be less than 5MB';
    }
    return '';
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
    
    // Validate on change
    if (field === 'name') {
      const nameError = validateName(value);
      setFieldErrors((prev) => ({ ...prev, name: nameError }));
    } else if (field === 'contactNumber') {
      const contactError = validateContactNumber(value);
      setFieldErrors((prev) => ({ ...prev, contactNumber: contactError }));
    }
  };

  const handleInputBlur = (field, value) => {
    // Validate on blur
    if (field === 'name') {
      const nameError = validateName(value);
      setFieldErrors((prev) => ({ ...prev, name: nameError }));
    } else if (field === 'contactNumber') {
      const contactError = validateContactNumber(value);
      setFieldErrors((prev) => ({ ...prev, contactNumber: contactError }));
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate profile image
      const imageError = validateProfileImage(file);
      if (imageError) {
        setFieldErrors((prev) => ({ ...prev, profileImage: imageError }));
        setError(imageError);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      // Clear errors if validation passes
      setFieldErrors((prev) => ({ ...prev, profileImage: '' }));
      setError('');
      
      // Cleanup previous preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      // Create new preview URL
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
      // Request OTP for password change
      await apiFetch('/auth/forgot/request', {
        method: 'POST',
        body: JSON.stringify({ email: user.email }),
      });
      // Set session storage for OTP flow
      sessionStorage.setItem('otpPurpose', 'change_password');
      sessionStorage.setItem('otpEmail', user.email);
      // Redirect to OTP page
      navigate('/otp');
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    }
  };

  const validateAllFields = () => {
    const nameError = validateName(formData.name);
    const contactError = validateContactNumber(formData.contactNumber);
    const imageError = formData.profileImage instanceof File 
      ? validateProfileImage(formData.profileImage) 
      : '';
    
    setFieldErrors({
      name: nameError,
      contactNumber: contactError,
      profileImage: imageError,
    });
    
    return !nameError && !contactError && !imageError;
  };

  const handleSave = () => {
    if (!hasChanges) {
      setError('No changes to save');
      return;
    }
    
    // Validate all fields before showing confirmation dialog
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
      
      if (formData.name !== originalData.name) {
        updateData.name = formData.name;
      }
      
      if (formData.contactNumber !== originalData.contactNumber) {
        updateData.contactNumber = formData.contactNumber;
      }

      // Handle profile image upload if changed
      if (formData.profileImage instanceof File) {
        const formDataToSend = new FormData();
        formDataToSend.append('profileImage', formData.profileImage);
        
        // Upload image first
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
        name: formData.name,
        contactNumber: formData.contactNumber,
      });
      // Update original profile image if it was changed
      if (formData.profileImage instanceof File && updateData.profilePicture) {
        setOriginalProfileImage(updateData.profilePicture);
      }
      setFormData((prev) => ({ ...prev, profileImage: null }));
      
      // Refresh user data
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

  if (loading) {
    return <Box>Loading...</Box>;
  }

  if (!user) {
    return <Box>Please log in to view your profile.</Box>;
  }

  // Helper function to convert relative image URLs to full backend URLs
  const getImageUrl = (url) => {
    if (!url) return null;
    // If it's already a full URL (http/https), return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // If it's a relative path starting with /uploads, prepend backend URL
    if (url.startsWith('/uploads')) {
      return `http://localhost:4000${url}`;
    }
    // Otherwise return as is (might be a data URL or other format)
    return url;
  };

  // Get preview URL for profile image
  // If a new file is selected, show preview; otherwise show existing image or UserAvatar
  const profileImageUrl = formData.profileImage instanceof File
    ? previewUrl
    : getImageUrl(originalProfileImage || user?.profilePicture || null);
  
  // Create user object with updated name for avatar if no profile image
  const avatarUser = profileImageUrl 
    ? null 
    : { ...user, name: formData.name || user?.name };

  return (
    <Box className="profile-page">
      <Box className="profile-container">
        {/* Left Side - Avatar and Name */}
        <Box className="profile-left">
          <Box className="profile-avatar-container">
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt="Profile"
                className="profile-avatar-image"
                onClick={handleAvatarClick}
              />
            ) : (
              <Box onClick={handleAvatarClick} className="profile-avatar-clickable">
                <UserAvatar user={avatarUser || user} size={100} />
              </Box>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </Box>
          {fieldErrors.profileImage && (
            <Typography className="profile-error-text" sx={{ color: 'error.main', fontSize: '11px', mt: 0.5, textAlign: 'center' }}>
              {fieldErrors.profileImage}
            </Typography>
          )}
          <Typography className="profile-name">{formData.name || 'No Name'}</Typography>
        </Box>

        {/* Divider */}
        <Box className="profile-divider">
          <img src="https://www.figma.com/api/mcp/asset/2b72e787-8b76-4f71-b080-cafd3523f4d1" alt="" />
        </Box>

        {/* Right Side - Form */}
        <Box className="profile-right">
          <Box className="profile-section-header">
            <Typography className="profile-section-title">PERSONAL INFORMATION</Typography>
          </Box>

          <Box className="profile-form-grid">
            {/* Email - Read Only */}
            <Box className="profile-field">
              <Typography className="profile-field-label">Email:</Typography>
              <TextField
                fullWidth
                value={formData.email}
                disabled
                className="profile-input"
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: '12px',
                    color: '#838383',
                    padding: '5px 10px',
                    height: '30px',
                    border: 'none',
                  },
                  '& .MuiOutlinedInput-root': {
                    height: '30px',
                    borderRadius: '6px',
                  },
                }}
              />
            </Box>

            {/* Name - Editable */}
            <Box className="profile-field">
              <Typography className="profile-field-label">Name:</Typography>
              <TextField
                fullWidth
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                onBlur={(e) => handleInputBlur('name', e.target.value)}
                error={!!fieldErrors.name}
                helperText={fieldErrors.name}
                className="profile-input"
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: '12px',
                    color: '#838383',
                    padding: '5px 10px',
                    height: '30px',
                    border: 'none',
                  },
                  '& .MuiOutlinedInput-root': {
                    height: '30px',
                    borderRadius: '6px',
                  },
                  '& .MuiFormHelperText-root': {
                    margin: '2px 0 0 0',
                    fontSize: '11px',
                  },
                }}
              />
            </Box>

            {/* Contact Number - Editable */}
            <Box className="profile-field">
              <Typography className="profile-field-label">Contact Number:</Typography>
              <TextField
                fullWidth
                value={formData.contactNumber}
                onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                onBlur={(e) => handleInputBlur('contactNumber', e.target.value)}
                error={!!fieldErrors.contactNumber}
                helperText={fieldErrors.contactNumber}
                className="profile-input"
                placeholder="e.g., 011-2640 6728"
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: '12px',
                    color: '#838383',
                    padding: '5px 10px',
                    height: '30px',
                    border: 'none',
                  },
                  '& .MuiOutlinedInput-root': {
                    height: '30px',
                    borderRadius: '6px',
                  },
                  '& .MuiFormHelperText-root': {
                    margin: '2px 0 0 0',
                    fontSize: '11px',
                  },
                }}
              />
            </Box>

            {/* Password Section */}
            <Box className="profile-password-section">
              <Typography className="profile-field-label">Password</Typography>
              <Button
                className="profile-change-password-btn"
                onClick={handleChangePassword}
                sx={{
                  backgroundColor: '#e16789',
                  color: '#ffffff',
                  fontSize: '12px',
                  padding: '5px 10px',
                  height: '30px',
                  borderRadius: '6px',
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: '#d1537a',
                  },
                }}
              >
                Change Password
              </Button>
            </Box>

            {/* Save Button */}
            <Box className="profile-save-section">
              <Button
                className="profile-save-btn"
                onClick={handleSave}
                disabled={!hasChanges || saving}
                sx={{
                  backgroundColor: '#e16789',
                  color: '#ffffff',
                  fontSize: '12px',
                  padding: '5px 10px',
                  height: '30px',
                  borderRadius: '6px',
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: '#d1537a',
                  },
                  '&:disabled': {
                    backgroundColor: '#ccc',
                    color: '#666',
                  },
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </Box>
          </Box>

          {error && (
            <Typography className="profile-error" sx={{ color: 'error.main', mt: 2 }}>
              {error}
            </Typography>
          )}
          {success && (
            <Typography className="profile-success" sx={{ color: 'success.main', mt: 2 }}>
              {success}
            </Typography>
          )}
        </Box>
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

export default Profile;

