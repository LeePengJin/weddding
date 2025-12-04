import React from 'react';
import { Box, Typography, Divider, List, ListItem, ListItemText, Paper } from '@mui/material';
import { Receipt } from '@mui/icons-material';

const OrderSummary = ({ order }) => {
  return (
    <Paper 
      elevation={0}
      sx={{ 
        bgcolor: 'background.paper', 
        borderRadius: 3, 
        border: '1px solid',
        borderColor: 'divider',
        p: { xs: 3, md: 4 }, 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column' 
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider', pb: 3, mb: 3 }}>
        <Typography variant="h6" color="primary.main" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Receipt fontSize="small" color="action" />
          Payment Summary
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontFamily: 'monospace' }}>
          Booking ID: {order.id?.slice(0, 8) || 'N/A'}
        </Typography>
      </Box>

      {/* Booking Details */}
      {order.vendorName && (
        <Box sx={{ mb: 3, pb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Booking For:
          </Typography>
          {order.services && order.services.length > 0 && (
            <Box sx={{ mb: 2 }}>
              {order.services.map((service, idx) => (
                <Typography key={idx} variant="body1" fontWeight="medium" color="text.primary" sx={{ mb: 0.5 }}>
                  • {service.name}
                </Typography>
              ))}
            </Box>
          )}
          <Typography variant="body2" color="text.secondary">
            Vendor: <Typography component="span" variant="body2" fontWeight="medium" color="primary.main">{order.vendorName}</Typography>
          </Typography>
        </Box>
      )}

      {/* Payment Tracking (if applicable) */}
      {order.totalAmount !== undefined && order.paid !== undefined && (
        <Box sx={{ mb: 3, pb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Payment Progress:
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">Total Amount:</Typography>
            <Typography variant="body2" fontWeight="medium">RM {order.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">Paid:</Typography>
            <Typography variant="body2" fontWeight="medium" color="success.main">RM {order.paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">Remaining:</Typography>
            <Typography variant="body2" fontWeight="medium" color="primary.main">RM {order.remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
          </Box>
        </Box>
      )}

      {/* Current Payment Items */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', maxHeight: 300, pr: 1, mb: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Current Payment:
        </Typography>
        <List disablePadding>
          {order.items.map((item) => (
            <ListItem key={item.id} disableGutters sx={{ alignItems: 'flex-start', py: 1.5, borderBottom: '1px dashed', borderColor: 'divider' }}>
              <ListItemText
                primary={
                  <Typography variant="body2" fontWeight="medium" color="text.primary">
                    {item.name}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
                    {item.description}
                  </Typography>
                }
                sx={{ m: 0 }}
              />
              <Typography variant="body2" fontWeight="600" color="primary.main" sx={{ whiteSpace: 'nowrap', ml: 2 }}>
                RM {item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Payment Breakdown */}
      <Box sx={{ pt: 3, mt: 'auto', borderTop: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {order.items[0]?.id === 'cancellation_fee' && (
          <Typography variant="caption" color="text.secondary">
            This payment only covers the <strong>cancellation fee</strong> for this booking. No additional
            services will be booked or paid for.
          </Typography>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'text.secondary' }}>
          <Typography variant="body2">Subtotal</Typography>
          <Typography variant="body2">RM {order.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'text.secondary' }}>
          <Typography variant="body2">Service Tax (6%)</Typography>
          <Typography variant="body2">RM {order.tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
        </Box>
        <Divider sx={{ my: 1 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" color="primary.main">Total Due</Typography>
          <Typography variant="h5" color="primary.main">RM {order.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default OrderSummary;
