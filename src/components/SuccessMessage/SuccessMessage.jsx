import React from 'react';
import { Snackbar, Alert } from '@mui/material';

const SuccessMessage = ({ open, onClose, message, severity = 'success' }) => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={3000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{
        top: '80px !important', // Position below navbar
      }}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        sx={{
          fontFamily: "'Literata', serif",
          '& .MuiAlert-icon': {
            fontSize: '1.25rem',
          },
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default SuccessMessage;

