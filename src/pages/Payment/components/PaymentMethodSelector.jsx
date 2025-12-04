import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { CreditCard, Smartphone, CheckCircle } from '@mui/icons-material';

const PaymentMethodSelector = ({ selected, onSelect }) => {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 4 }}>
      <Paper
        elevation={0}
        component="button"
        onClick={() => onSelect('card')}
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
          borderRadius: 3,
          border: '1px solid',
          borderColor: selected === 'card' ? 'primary.main' : 'divider',
          backgroundColor: selected === 'card' ? 'primary.main' : 'background.paper',
          color: selected === 'card' ? 'primary.contrastText' : 'text.secondary',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'pointer',
          overflow: 'hidden',
          outline: 'none',
          '&:hover': {
            borderColor: selected === 'card' ? 'primary.dark' : 'text.primary',
            transform: 'translateY(-2px)',
            boxShadow: 2,
          },
        }}
      >
        {selected === 'card' && (
          <Box sx={{ position: 'absolute', top: 12, right: 12, animation: 'fadeIn 0.4s' }}>
            <CheckCircle sx={{ color: 'inherit', fontSize: 20, opacity: 0.8 }} />
          </Box>
        )}
        
        <CreditCard sx={{ fontSize: 32, mb: 2, opacity: selected === 'card' ? 1 : 0.7 }} />
        <Typography variant="body1" fontWeight={600} sx={{ position: 'relative', zIndex: 1 }}>
          Card
        </Typography>
      </Paper>

      <Paper
        elevation={0}
        component="button"
        onClick={() => onSelect('tng')}
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
          borderRadius: 3,
          border: '1px solid',
          borderColor: selected === 'tng' ? 'info.main' : 'divider',
          backgroundColor: selected === 'tng' ? '#0054A6' : 'background.paper', // TNG Blue
          color: selected === 'tng' ? 'white' : 'text.secondary',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'pointer',
          overflow: 'hidden',
          outline: 'none',
          '&:hover': {
            borderColor: selected === 'tng' ? '#00428a' : 'text.primary',
            transform: 'translateY(-2px)',
            boxShadow: 2,
          },
        }}
      >
        {selected === 'tng' && (
          <Box sx={{ position: 'absolute', top: 12, right: 12, animation: 'fadeIn 0.4s' }}>
            <CheckCircle sx={{ color: 'inherit', fontSize: 20, opacity: 0.8 }} />
          </Box>
        )}

        <Smartphone sx={{ fontSize: 32, mb: 2, opacity: selected === 'tng' ? 1 : 0.7 }} />
        <Typography variant="body1" fontWeight={600} sx={{ position: 'relative', zIndex: 1 }}>
          Touch 'n Go
        </Typography>
      </Paper>
    </Box>
  );
};

export default PaymentMethodSelector;
