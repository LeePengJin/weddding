import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  CardActions,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack,
  Payment as PaymentIcon,
  History,
  Warning,
  CheckCircle,
} from '@mui/icons-material';
import { apiFetch } from '../../lib/api';
import './PaymentCenter.styles.css';

const PaymentCenter = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    fetchBookings();
  }, [projectId]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = projectId ? `/bookings?projectId=${projectId}` : '/bookings';
      const data = await apiFetch(url);
      setBookings(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const getPaymentsDue = () => {
    return bookings.filter(
      (booking) =>
        booking.status === 'pending_deposit_payment' || booking.status === 'pending_final_payment'
    );
  };

  const getPaymentHistory = () => {
    const history = [];
    bookings.forEach((booking) => {
      if (booking.payments && booking.payments.length > 0) {
        booking.payments.forEach((payment) => {
          history.push({
            ...payment,
            bookingId: booking.id,
            vendorName: booking.vendor?.user?.name || 'Vendor',
            serviceName: booking.selectedServices[0]?.serviceListing?.name || 'Service',
            bookingStatus: booking.status,
          });
        });
      }
    });
    return history.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
  };

  const calculatePaymentAmount = (booking, paymentType) => {
    if (!booking || !booking.selectedServices || booking.selectedServices.length === 0) {
      return 0;
    }
    const total = booking.selectedServices.reduce(
      (sum, service) => sum + (parseFloat(service.totalPrice) || 0),
      0
    );
    if (paymentType === 'deposit') {
      return total * 0.3; // 30% deposit
    } else {
      const depositPaid = (booking.payments || [])
        .filter((p) => p.paymentType === 'deposit')
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      return Math.max(0, total - depositPaid);
    }
  };

  const handleMakePayment = (booking) => {
    const paymentType = booking.status === 'pending_deposit_payment' ? 'deposit' : 'final';
    navigate(`/payment?bookingId=${booking.id}&type=${paymentType}`);
  };


  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const paymentsDue = getPaymentsDue();
  const paymentHistory = getPaymentHistory();

  if (loading && bookings.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="payment-center" sx={{ minHeight: '100vh', backgroundColor: '#f5f6fa', pb: 6 }}>
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
            Payment Center
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your deposits and final payments
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
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PaymentIcon />
                  Payments Due ({paymentsDue.length})
                </Box>
              }
            />
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <History />
                  Payment History ({paymentHistory.length})
                </Box>
              }
            />
          </Tabs>
        </Paper>

        {selectedTab === 0 && (
          <>
            {paymentsDue.length === 0 ? (
              <Paper elevation={2} sx={{ p: 4, textAlign: 'center' }}>
                <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No payments due
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  All your payments are up to date!
                </Typography>
              </Paper>
            ) : (
              <Stack spacing={2}>
                {paymentsDue.map((booking) => {
                  const paymentType = booking.status === 'pending_deposit_payment' ? 'deposit' : 'final';
                  const amount = calculatePaymentAmount(booking, paymentType);
                  const dueDate =
                    paymentType === 'deposit' ? booking.depositDueDate : booking.finalDueDate;
                  const overdue = isOverdue(dueDate);

                  return (
                    <Card key={booking.id} elevation={2}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Box>
                            <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                              {booking.vendor?.user?.name || booking.vendorId || 'Vendor'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {booking.selectedServices[0]?.serviceListing?.name || 'Service'}
                            </Typography>
                          </Box>
                          {overdue && (
                            <Chip icon={<Warning />} label="Overdue" color="error" size="small" />
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', gap: 4, mb: 2, flexWrap: 'wrap' }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Payment Type
                            </Typography>
                            <Typography variant="body2" fontWeight="medium" textTransform="capitalize">
                              {paymentType} Payment
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Amount Due
                            </Typography>
                            <Typography variant="h6" color="primary" fontWeight="bold">
                              RM {(amount || 0).toLocaleString()}
                            </Typography>
                          </Box>
                          {dueDate && (
                            <Box>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Due Date
                              </Typography>
                              <Typography
                                variant="body2"
                                fontWeight="medium"
                                color={overdue ? 'error' : 'text.primary'}
                              >
                                {formatDate(dueDate)}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </CardContent>
                      <CardActions>
                        <Button
                          variant="contained"
                          startIcon={<PaymentIcon />}
                          onClick={() => handleMakePayment(booking)}
                          color={overdue ? 'error' : 'primary'}
                        >
                          Pay Now
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => navigate(`/my-bookings?bookingId=${booking.id}`)}
                        >
                          View Booking
                        </Button>
                      </CardActions>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </>
        )}

        {selectedTab === 1 && (
          <>
            {paymentHistory.length === 0 ? (
              <Paper elevation={2} sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                  No payment history
                </Typography>
              </Paper>
            ) : (
              <Stack spacing={2}>
                {paymentHistory.map((payment, index) => (
                  <Card key={index} elevation={1}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                            {payment.vendorName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {payment.serviceName}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <Chip
                              label={payment.paymentType.charAt(0).toUpperCase() + payment.paymentType.slice(1)}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                            <Chip
                              label={payment.paymentMethod.replace('_', ' ')}
                              size="small"
                              variant="outlined"
                            />
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(payment.paymentDate)}
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="h6" color="success.main" fontWeight="bold">
                          RM {(parseFloat(payment.amount) || 0).toLocaleString()}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </>
        )}
      </Box>

    </Box>
  );
};

export default PaymentCenter;

