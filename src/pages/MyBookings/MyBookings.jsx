import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  CardActions,
  Tabs,
  Tab,
  Stack,
  Divider,
  IconButton,
  LinearProgress,
} from '@mui/material';
import {
  ArrowBack,
  Payment as PaymentIcon,
  CheckCircle,
  Cancel,
  Schedule,
  Close,
  Visibility,
  Star,
  Message,
} from '@mui/icons-material';
import { apiFetch } from '../../lib/api';
import './MyBookings.styles.css';

const STATUS_CONFIG = {
  pending_vendor_confirmation: {
    label: 'Pending Vendor Confirmation',
    color: 'warning',
    icon: Schedule,
    description: 'Waiting for vendor to accept your booking request',
  },
  pending_deposit_payment: {
    label: 'Deposit Payment Due',
    color: 'info',
    icon: PaymentIcon,
    description: 'Please pay the deposit to confirm your booking',
  },
  confirmed: {
    label: 'Confirmed',
    color: 'success',
    icon: CheckCircle,
    description: 'Booking confirmed. Awaiting wedding date',
  },
  pending_final_payment: {
    label: 'Final Payment Due',
    color: 'info',
    icon: PaymentIcon,
    description: 'Please pay the final payment after your wedding',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'default',
    icon: Cancel,
    description: 'This booking has been cancelled',
  },
  rejected: {
    label: 'Rejected',
    color: 'error',
    icon: Cancel,
    description: 'Vendor has rejected your booking request',
  },
  completed: {
    label: 'Completed',
    color: 'success',
    icon: CheckCircle,
    description: 'Booking completed. You can now leave a review',
  },
};

const MyBookings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch('/bookings');
      setBookings(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (booking) => {
    setSelectedBooking(booking);
    setShowDetailDialog(true);
  };

  const handlePayDeposit = (booking) => {
    navigate(`/payment?bookingId=${booking.id}&type=deposit`);
  };

  const handlePayFinal = (booking) => {
    navigate(`/payment?bookingId=${booking.id}&type=final`);
  };

  const handleLeaveReview = (booking) => {
    // Navigate to review page (to be implemented)
    navigate(`/bookings/${booking.id}/review`);
  };

  const handleMessageVendor = async (booking) => {
    try {
      // vendor.id is the userId (Vendor model uses userId as primary key)
      const vendorId = booking.vendor?.id || booking.vendorId;
      if (!vendorId) {
        setError('Vendor information not available');
        return;
      }
      const conversation = await apiFetch('/conversations', {
        method: 'POST',
        body: JSON.stringify({ vendorId }),
      });
      navigate(`/messages?conversationId=${conversation.id}`);
    } catch (err) {
      setError(err.message || 'Failed to start conversation');
    }
  };

  const calculateTotal = (booking) => {
    if (!booking || !booking.selectedServices || booking.selectedServices.length === 0) {
      return 0;
    }
    return booking.selectedServices.reduce((sum, service) => {
      return sum + (parseFloat(service.totalPrice) || 0);
    }, 0);
  };

  const getStatusConfig = (status) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.pending_vendor_confirmation;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getNextAction = (booking) => {
    switch (booking.status) {
      case 'pending_vendor_confirmation':
        return { label: 'Waiting for vendor response', action: null };
      case 'pending_deposit_payment':
        return { label: 'Pay Deposit', action: () => handlePayDeposit(booking) };
      case 'confirmed':
        return { label: 'Awaiting wedding date', action: null };
      case 'pending_final_payment':
        return { label: 'Pay Final Payment', action: () => handlePayFinal(booking) };
      case 'completed':
        return { label: 'Leave Review', action: () => handleLeaveReview(booking) };
      default:
        return { label: null, action: null };
    }
  };

  const filteredBookings = bookings.filter((booking) => {
    if (selectedTab === 0) return true; // All
    if (selectedTab === 1) return booking.status === 'pending_vendor_confirmation';
    if (selectedTab === 2) return ['pending_deposit_payment', 'pending_final_payment'].includes(booking.status);
    if (selectedTab === 3) return ['confirmed', 'pending_final_payment'].includes(booking.status);
    if (selectedTab === 4) return booking.status === 'completed';
    return true;
  });

  if (loading && bookings.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="my-bookings" sx={{ minHeight: '100vh', backgroundColor: '#f5f6fa', pb: 6 }}>
      <Box sx={{ backgroundColor: 'white', borderBottom: '1px solid #e0e0e0', mb: 4 }}>
        <Box sx={{ maxWidth: '1200px', margin: '0 auto', px: 3, py: 3 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/project-dashboard')}
            sx={{ mb: 2, textTransform: 'none' }}
          >
            Back to Dashboard
          </Button>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            My Bookings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track and manage all your booking requests
          </Typography>
        </Box>
      </Box>

      <Box sx={{ maxWidth: '1200px', margin: '0 auto', px: 3 }}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper elevation={2} sx={{ mb: 3 }}>
          <Tabs
            value={selectedTab}
            onChange={(e, newValue) => setSelectedTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="All Bookings" />
            <Tab label="Pending" />
            <Tab label="Payment Due" />
            <Tab label="Confirmed" />
            <Tab label="Completed" />
          </Tabs>
        </Paper>

        {filteredBookings.length === 0 ? (
          <Paper elevation={2} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No bookings found
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {filteredBookings.map((booking) => {
              const statusConfig = getStatusConfig(booking.status);
              const StatusIcon = statusConfig.icon;
              const nextAction = getNextAction(booking);
              const total = calculateTotal(booking);
              const depositPaid = (booking.payments || [])
                .filter((p) => p.paymentType === 'deposit')
                .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
              const finalPaid = (booking.payments || [])
                .filter((p) => p.paymentType === 'final')
                .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

              return (
                <Card key={booking.id} elevation={2}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                          {booking.vendor?.user?.name || 'Vendor'}
                        </Typography>
                        {booking.project && (
                          <Typography variant="body2" color="text.secondary">
                            Project: {booking.project.projectName}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        icon={<StatusIcon />}
                        label={statusConfig.label}
                        color={statusConfig.color}
                        size="small"
                      />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 4, mb: 2, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Reserved Date
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {formatDate(booking.reservedDate)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Total Amount
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          RM {(total || 0).toLocaleString()}
                        </Typography>
                      </Box>
                      {booking.status === 'pending_deposit_payment' && booking.depositDueDate && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Deposit Due
                          </Typography>
                          <Typography variant="body2" fontWeight="medium" color="error">
                            {formatDate(booking.depositDueDate)}
                          </Typography>
                        </Box>
                      )}
                      {booking.status === 'pending_final_payment' && booking.finalDueDate && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Final Payment Due
                          </Typography>
                          <Typography variant="body2" fontWeight="medium" color="error">
                            {formatDate(booking.finalDueDate)}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* Payment Progress */}
                    {['pending_deposit_payment', 'confirmed', 'pending_final_payment', 'completed'].includes(
                      booking.status
                    ) && (
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Payment Progress
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            RM {depositPaid + finalPaid} / RM {total}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={((depositPaid + finalPaid) / total) * 100}
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>
                    )}

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {statusConfig.description}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Visibility />}
                        onClick={() => handleViewDetails(booking)}
                      >
                        View Details
                      </Button>
                      {nextAction.action && (
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={booking.status.includes('payment') ? <PaymentIcon /> : <Star />}
                          onClick={nextAction.action}
                        >
                          {nextAction.label}
                        </Button>
                      )}
                      {booking.status !== 'rejected' && booking.status !== 'cancelled' && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Message />}
                          onClick={() => handleMessageVendor(booking)}
                        >
                          Message Vendor
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* Booking Detail Dialog */}
      <Dialog open={showDetailDialog} onClose={() => setShowDetailDialog(false)} maxWidth="md" fullWidth>
        {selectedBooking && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" component="div">
                Booking Details - {selectedBooking.vendor?.user?.name || selectedBooking.vendorId || 'Vendor'}
              </Typography>
              <IconButton
                aria-label="close"
                onClick={() => setShowDetailDialog(false)}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                  color: (theme) => theme.palette.grey[500],
                }}
              >
                <Close />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Booking Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Status:</Typography>
                      <Chip
                        label={getStatusConfig(selectedBooking.status).label}
                        color={getStatusConfig(selectedBooking.status).color}
                        size="small"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Reserved Date:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {formatDate(selectedBooking.reservedDate)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Booking Date:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {formatDate(selectedBooking.bookingDate)}
                      </Typography>
                    </Box>
                    {selectedBooking.project && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Project:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {selectedBooking.project.projectName}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Services ({selectedBooking.selectedServices.length})
                  </Typography>
                  <Stack spacing={1}>
                    {selectedBooking.selectedServices.map((service, index) => {
                      const pricingPolicy = service.serviceListing?.pricingPolicy || 'fixed_package';
                      const basePrice = parseFloat(service.serviceListing?.price || 0);
                      const totalPrice = parseFloat(service.totalPrice || 0);
                      const quantity = service.quantity || 1;

                      // Generate pricing breakdown text based on pricing policy
                      let breakdownText = '';
                      switch (pricingPolicy) {
                        case 'per_unit':
                          breakdownText = `${quantity} units × RM${basePrice.toLocaleString()} = RM${totalPrice.toLocaleString()}`;
                          break;
                        case 'per_table':
                          breakdownText = `${quantity} table${quantity !== 1 ? 's' : ''} × RM${basePrice.toLocaleString()} = RM${totalPrice.toLocaleString()}`;
                          break;
                        case 'fixed_package':
                          breakdownText = `Fixed package: RM${totalPrice.toLocaleString()}`;
                          break;
                        case 'tiered_package':
                          breakdownText = `Tiered pricing: RM${totalPrice.toLocaleString()} (Quantity: ${quantity})`;
                          break;
                        case 'time_based':
                          const hourlyRate = parseFloat(service.serviceListing?.hourlyRate || basePrice);
                          const hours = totalPrice / hourlyRate;
                          breakdownText = `${hours.toFixed(1)} hours × RM${hourlyRate.toLocaleString()}/hour = RM${totalPrice.toLocaleString()}`;
                          break;
                        default:
                          breakdownText = `Quantity: ${quantity} × RM${basePrice.toLocaleString()}`;
                      }

                      return (
                        <Box
                          key={index}
                          sx={{
                            p: 2,
                            backgroundColor: '#f5f5f5',
                            borderRadius: 1,
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Typography variant="body2" fontWeight="medium">
                              {service.serviceListing.name}
                            </Typography>
                            <Typography variant="body2" fontWeight="medium" color="primary.main">
                              RM {totalPrice.toLocaleString()}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {breakdownText}
                          </Typography>
                          <Chip
                            label={pricingPolicy.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            size="small"
                            sx={{ mt: 0.5, height: 20, fontSize: '0.65rem' }}
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, pt: 2, borderTop: 1 }}>
                    <Typography variant="h6">Total:</Typography>
                    <Typography variant="h6">RM {(calculateTotal(selectedBooking) || 0).toLocaleString()}</Typography>
                  </Box>
                </Box>

                {selectedBooking.payments && selectedBooking.payments.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Payment History
                      </Typography>
                      <Stack spacing={1}>
                        {selectedBooking.payments.map((payment, index) => (
                          <Box
                            key={index}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              p: 1,
                              backgroundColor: '#f5f5f5',
                              borderRadius: 1,
                            }}
                          >
                            <Box>
                              <Typography variant="body2" fontWeight="medium" textTransform="capitalize">
                                {payment.paymentType} Payment
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {payment.paymentMethod.replace('_', ' ')} • {formatDate(payment.paymentDate)}
                              </Typography>
                            </Box>
                            <Typography variant="body2" fontWeight="medium">
                              RM {(parseFloat(payment.amount) || 0).toLocaleString()}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  </>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowDetailDialog(false)}>Close</Button>
              {getNextAction(selectedBooking).action && (
                <Button
                  variant="contained"
                  onClick={getNextAction(selectedBooking).action}
                  startIcon={selectedBooking.status.includes('payment') ? <PaymentIcon /> : <Star />}
                >
                  {getNextAction(selectedBooking).label}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

    </Box>
  );
};

export default MyBookings;

