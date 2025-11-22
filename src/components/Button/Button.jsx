import React from 'react';
import { Button as MuiButton } from '@mui/material';

export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  style = {},
  ...props 
}) => {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '9999px',
    transition: 'all 0.3s',
    fontWeight: 500,
    outline: 'none',
    border: 'none',
    cursor: 'pointer',
    textTransform: 'none',
  };
  
  const variants = {
    primary: {
      backgroundColor: '#f43f5e',
      color: 'white',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      '&:hover': {
        backgroundColor: '#e11d48',
        boxShadow: '0 4px 6px rgba(244, 63, 94, 0.3)',
      },
    },
    secondary: {
      backgroundColor: 'white',
      color: '#9f1239',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      '&:hover': {
        backgroundColor: '#fff1f2',
      },
    },
    outline: {
      border: '2px solid #f43f5e',
      color: '#f43f5e',
      backgroundColor: 'transparent',
      '&:hover': {
        backgroundColor: '#fff1f2',
      },
    },
  };

  const sizes = {
    sm: { padding: '6px 16px', fontSize: '0.875rem' },
    md: { padding: '12px 24px', fontSize: '1rem' },
    lg: { padding: '16px 32px', fontSize: '1.125rem' },
  };

  return (
    <MuiButton
      variant="contained"
      sx={{
        ...baseStyles,
        ...variants[variant],
        ...sizes[size],
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </MuiButton>
  );
};
