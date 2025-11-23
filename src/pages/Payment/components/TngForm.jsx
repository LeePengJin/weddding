import React, { useState } from 'react';
import { Box, Typography, TextField, Paper } from '@mui/material';
import { Smartphone, NotificationsActive, ArrowForward } from '@mui/icons-material';

const TngForm = ({ onChange, errors }) => {
  const [phoneNumber, setPhoneNumber] = useState('');

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    setPhoneNumber(value);
    onChange({ phoneNumber: value });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, animation: 'fadeIn 0.5s' }}>
      {/* Visual Instruction Card */}
      <Paper 
        elevation={0}
        sx={{ 
          background: 'linear-gradient(135deg, #0054A6 0%, #0072E0 100%)', // TNG Corporate Blue Gradient
          borderRadius: 3, 
          p: 4, 
          color: 'white',
          position: 'relative', 
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 84, 166, 0.15)'
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <Box sx={{ width: 64, height: 64, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, backdropFilter: 'blur(4px)' }}>
            <Smartphone sx={{ fontSize: 32, color: 'white' }} />
          </Box>
          
          <Typography variant="h6" gutterBottom>
            Instant eWallet Payment
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, maxWidth: 300, mb: 4 }}>
            We will send a payment request notification directly to your Touch 'n Go eWallet app.
          </Typography>
          
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1.5, 
            fontSize: '0.75rem', 
            fontWeight: '600', 
            color: '#0054A6', 
            bgcolor: 'white', 
            px: 3, 
            py: 1.5, 
            borderRadius: 100, 
            boxShadow: 2
          }}>
            <span>1. Enter Number</span>
            <ArrowForward sx={{ fontSize: 14, color: 'text.secondary' }} />
            <span>2. Tap Pay</span>
            <ArrowForward sx={{ fontSize: 14, color: 'text.secondary' }} />
            <span>3. Approve</span>
          </Box>
        </Box>
      </Paper>

      <Box>
        <TextField
          fullWidth
          label="TNG Registered Mobile Number"
          placeholder="12 345 6789"
          value={phoneNumber}
          onChange={handlePhoneChange}
          error={!!errors.phoneNumber}
          helperText={errors.phoneNumber}
          variant="outlined"
          InputProps={{
            startAdornment: <Typography color="text.secondary" sx={{ mr: 1, fontWeight: 500 }}>+60</Typography>,
            sx: { 
              borderRadius: 2,
              '& fieldset': { borderColor: 'divider' },
              '&:hover fieldset': { borderColor: 'text.secondary' },
              '&.Mui-focused fieldset': { borderColor: '#0054A6', borderWidth: 2 },
            }
          }}
          InputLabelProps={{
            sx: { color: 'text.secondary', '&.Mui-focused': { color: '#0054A6' } }
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block', ml: 1 }}>
          * Ensure your eWallet balance is sufficient before proceeding.
        </Typography>
      </Box>
    </Box>
  );
};

export default TngForm;
