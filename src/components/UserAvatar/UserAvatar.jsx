import React from 'react';
import { Avatar } from '@mui/material';

const UserAvatar = ({ user, size = 40, onClick, sx = {} }) => {
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

  // Get the first character of the name
  const getInitial = () => {
    if (!user) return '?';
    
    // Try to get name from user object (could be name, vendorName, or businessName)
    const name = user.name || user.vendorName || user.businessName || user.email || '';
    
    // Get first character and make it uppercase
    return name.charAt(0).toUpperCase();
  };

  const initial = getInitial();
  const avatarColor = '#f5bdba'; // Platform icon color
  
  // Check if user has a profile picture
  const profilePicture = user?.profilePicture ? getImageUrl(user.profilePicture) : null;

  // If profile picture exists, use it; otherwise show initial
  if (profilePicture) {
    return (
      <Avatar
        onClick={onClick}
        src={profilePicture}
        alt={user?.name || 'User'}
        sx={{
          width: size,
          height: size,
          cursor: onClick ? 'pointer' : 'default',
          ...sx,
        }}
      />
    );
  }

  return (
    <Avatar
      onClick={onClick}
      sx={{
        width: size,
        height: size,
        backgroundColor: avatarColor,
        color: '#ffffff',
        fontSize: size * 0.5,
        fontWeight: 600,
        cursor: onClick ? 'pointer' : 'default',
        ...sx,
      }}
    >
      {initial}
    </Avatar>
  );
};

export default UserAvatar;

