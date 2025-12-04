import React from 'react';
import { Box, Typography, Divider, Paper } from '@mui/material';

const PaymentReceipt = ({ payment, booking, orderDetails, paymentMethod }) => {
  if (!payment || !booking) return null;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getPaymentMethodLabel = (method) => {
    const labels = {
      credit_card: 'Credit Card',
      touch_n_go: "Touch 'n Go",
      bank_transfer: 'Bank Transfer',
    };
    return labels[method] || method;
  };

  return (
    <Box
      sx={{
        display: 'none',
        '@media print': {
          display: 'block',
          width: '100%',
          maxWidth: '800px',
          margin: '0 auto',
          padding: 2,
          paddingTop: 1,
          bgcolor: 'white',
        },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          bgcolor: 'white',
          '@media print': {
            boxShadow: 'none',
            p: 2,
            pt: 1,
          },
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3, '@media print': { mb: 2 } }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: '#2C3E50' }}>
            Payment Receipt
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Weddding Platform
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Receipt Details */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Receipt Number
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
            {(payment.id || '').toString().substring(0, 8).toUpperCase() || 'N/A'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Payment Date
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {formatDate(payment.paymentDate)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Payment Type
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500, textTransform: 'capitalize' }}>
              {payment.paymentType}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Payment Method
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {getPaymentMethodLabel(payment.paymentMethod)}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Booking Information */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Booking Information
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Booking ID:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                {(booking.id || '').toString().substring(0, 8).toUpperCase() || 'N/A'}
              </Typography>
            </Box>
            {booking.project && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Project:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {booking.project.projectName}
                </Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Reserved Date:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {new Date(booking.reservedDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Vendor Information */}
        {booking.vendor && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Vendor Information
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Vendor:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {booking.vendor.user?.name || booking.vendor.businessName || 'N/A'}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        <Divider sx={{ mb: 3 }} />

        {/* Services */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Services
          </Typography>
          {booking.selectedServices && booking.selectedServices.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {booking.selectedServices.map((service, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    py: 1,
                    borderBottom: index < booking.selectedServices.length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {service.serviceListing?.name || 'Service'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Quantity: {service.quantity}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    RM {formatCurrency(service.totalPrice)}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No services listed
            </Typography>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Payment Summary */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Payment Summary
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {orderDetails && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    RM {formatCurrency(orderDetails.subtotal)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Tax (6%):</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    RM {formatCurrency(orderDetails.tax)}
                  </Typography>
                </Box>
              </>
            )}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                pt: 2,
                borderTop: '2px solid',
                borderColor: 'primary.main',
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Total Paid
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                RM {formatCurrency(payment.amount)}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="caption" color="text.secondary">
            Thank you for your payment. This is an official receipt.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            For inquiries, please contact support@weddding.com
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default PaymentReceipt;

