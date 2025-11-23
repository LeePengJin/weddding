import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, InputAdornment, Tooltip, IconButton } from '@mui/material';
import { HelpOutline, ErrorOutline } from '@mui/icons-material';

const CardForm = ({ onChange, errors }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [cardType, setCardType] = useState('unknown');
  
  // Detect card type based on number
  useEffect(() => {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    if (cleanNumber.startsWith('4')) {
      setCardType('visa');
    } else if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber)) {
      setCardType('mastercard');
    } else if (/^3[47]/.test(cleanNumber)) {
      setCardType('amex');
    } else {
      setCardType('unknown');
    }
  }, [cardNumber]);

  // Format card number with spaces
  const handleCardChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 19) value = value.slice(0, 19);
    
    const parts = [];
    for (let i = 0; i < value.length; i += 4) {
      parts.push(value.substring(i, i + 4));
    }
    const formatted = parts.join(' ');
    setCardNumber(formatted);
    onChange({ cardNumber: formatted, expiry, cvc, name });
  };

  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);

    if (value.length >= 2) {
      setExpiry(`${value.slice(0, 2)}/${value.slice(2)}`);
    } else {
      setExpiry(value);
    }
    onChange({ cardNumber, expiry: value.length >= 2 ? `${value.slice(0, 2)}/${value.slice(2)}` : value, cvc, name });
  };

  const handleCvcChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCvc(value);
    onChange({ cardNumber, expiry, cvc: value, name });
  };

  const handleNameChange = (e) => {
    setName(e.target.value);
    onChange({ cardNumber, expiry, cvc, name: e.target.value });
  };

  const inputStyle = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      backgroundColor: 'background.paper',
      transition: 'all 0.2s',
      '& fieldset': {
        borderColor: 'divider',
      },
      '&:hover fieldset': {
        borderColor: 'text.secondary',
      },
      '&.Mui-focused fieldset': {
        borderColor: 'primary.main',
        borderWidth: 2,
      },
    },
    '& .MuiInputLabel-root': {
      color: 'text.secondary',
      '&.Mui-focused': {
        color: 'primary.main',
      },
    },
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, animation: 'fadeIn 0.5s' }}>
      <Box>
        <TextField
          fullWidth
          label="Cardholder Name"
          value={name}
          onChange={handleNameChange}
          error={!!errors.name}
          helperText={errors.name}
          variant="outlined"
          sx={inputStyle}
        />
      </Box>

      <Box>
        <TextField
          fullWidth
          label="Card Number"
          value={cardNumber}
          onChange={handleCardChange}
          error={!!errors.cardNumber}
          helperText={errors.cardNumber}
          variant="outlined"
          sx={inputStyle}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                 {/* Simple visual indicator for card type */}
                 {cardType !== 'unknown' && (
                   <Typography variant="caption" fontWeight="bold" sx={{ textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 1 }}>
                     {cardType}
                   </Typography>
                 )}
              </InputAdornment>
            )
          }}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
        <Box>
          <TextField
            fullWidth
            label="Expiry Date"
            placeholder="MM / YY"
            value={expiry}
            onChange={handleExpiryChange}
            error={!!errors.expiry}
            helperText={errors.expiry}
            variant="outlined"
            sx={inputStyle}
          />
        </Box>
        
        <Box>
          <TextField
            fullWidth
            label="CVC"
            placeholder="123"
            value={cvc}
            onChange={handleCvcChange}
            error={!!errors.cvc}
            helperText={errors.cvc}
            inputProps={{ maxLength: 4 }}
            variant="outlined"
            sx={inputStyle}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Security code on the back of your card" arrow>
                    <HelpOutline fontSize="small" sx={{ color: 'text.disabled', cursor: 'help' }} />
                  </Tooltip>
                </InputAdornment>
              )
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default CardForm;
