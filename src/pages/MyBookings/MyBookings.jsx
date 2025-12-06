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
  Rating,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
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
  Search,
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
  cancelled_by_couple: {
    label: 'Cancelled by You',
    color: 'default',
    icon: Cancel,
    description: 'This booking has been cancelled by you',
  },
  cancelled_by_vendor: {
    label: 'Cancelled by Vendor',
    color: 'error',
    icon: Cancel,
    description: 'This booking has been cancelled by the vendor',
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
    description: 'Booking completed',
  },
};

const MyBookings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewData, setReviewData] = useState({
    serviceListingId: '',
    rating: 5,
    comment: '',
  });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationFeePreview, setCancellationFeePreview] = useState(null);
  const [loadingFeePreview, setLoadingFeePreview] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [selectedReasonPreset, setSelectedReasonPreset] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingSort, setBookingSort] = useState('date_desc');

  useEffect(() => {
    if (projectId) {
    fetchBookings();
    } else {
      setError('Project ID is required');
      setLoading(false);
    }
  }, [projectId]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!projectId) {
        setError('Project ID is required');
        setLoading(false);
        return;
      }
      const data = await apiFetch(`/bookings?projectId=${projectId}`);
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
    setSelectedBooking(booking);
    // Find the first unreviewed service, or empty string if all are reviewed
    const reviewedServiceIds = booking.reviews?.map((review) => review.serviceListingId) || [];
    const firstUnreviewedService = booking.selectedServices?.find(
      (service) => !reviewedServiceIds.includes(service.serviceListingId)
    );
    const defaultServiceId = firstUnreviewedService?.serviceListingId || '';
    
    setReviewData({
      serviceListingId: defaultServiceId,
      rating: 5,
      comment: '',
    });
    setShowReviewDialog(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewData.serviceListingId) {
      setError('Please select a service to review');
      return;
    }

    if (!reviewData.rating || reviewData.rating < 1 || reviewData.rating > 5) {
      setError('Please provide a valid rating (1-5 stars)');
      return;
    }

    try {
      setError(null);
      setSubmittingReview(true);
      await apiFetch(`/bookings/${selectedBooking.id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          serviceListingId: reviewData.serviceListingId,
          rating: reviewData.rating,
          comment: reviewData.comment || null,
        }),
      });
      setShowReviewDialog(false);
      // Refresh the selected booking to show the new review
      const updatedBooking = await apiFetch(`/bookings/${selectedBooking.id}`);
      setSelectedBooking(updatedBooking);
      await fetchBookings();
    } catch (err) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
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

  const normalizeFeePreview = (preview) => ({
    ...preview,
    feeAmount: Number(preview?.feeAmount) || 0,
    amountPaid: Number(preview?.amountPaid) || 0,
    feeDifference: Number(preview?.feeDifference) || 0,
  });

  const handleCancelBooking = async (booking) => {
    if (!booking) return;

    setSelectedBooking(booking);
    setShowCancelDialog(true);
    setError(null);
    setCancellationFeePreview(null);
    setLoadingFeePreview(true);
    setCancellationReason('');
    setSelectedReasonPreset('');

    try {
      const preview = await apiFetch(`/bookings/${booking.id}/cancellation-fee`);
      setCancellationFeePreview(normalizeFeePreview(preview));
    } catch (err) {
      setError(err.message || 'Failed to load cancellation fee information');
      setShowCancelDialog(false);
    } finally {
      setLoadingFeePreview(false);
    }
  };

  const handleConfirmCancellation = async () => {
    if (!selectedBooking) return;

    try {
      setCancelling(true);
      setError(null);

      const trimmedReason = (cancellationReason || '').trim();
      if (!trimmedReason) {
        setError('Please provide a reason for cancellation.');
        setCancelling(false);
        return;
      }

      if (cancellationFeePreview?.requiresPayment && cancellationFeePreview.feeDifference > 0) {
        setShowCancelDialog(false);
        navigate(
          `/payment?bookingId=${selectedBooking.id}&type=cancellation_fee&reason=${encodeURIComponent(
            trimmedReason
          )}`
        );
        return;
      } else {
        await apiFetch(`/bookings/${selectedBooking.id}/cancel`, {
          method: 'POST',
          body: JSON.stringify({ reason: trimmedReason }),
        });
      }

      setShowCancelDialog(false);
      setCancellationFeePreview(null);
      const updatedBooking = await apiFetch(`/bookings/${selectedBooking.id}`);
      setSelectedBooking(updatedBooking);
      await fetchBookings();
    } catch (err) {
      setError(err.message || 'Failed to cancel booking');
    } finally {
      setCancelling(false);
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
        // Check if there are any services without reviews
        const hasUnreviewedServices = booking.selectedServices && booking.selectedServices.some(
          (service) => !booking.reviews?.some((review) => review.serviceListingId === service.serviceListingId)
        );
        if (hasUnreviewedServices) {
          return { label: 'Leave Review', action: () => handleLeaveReview(booking) };
        }
        return { label: null, action: null };
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
    if (selectedTab === 5) return ['cancelled_by_couple', 'cancelled_by_vendor'].includes(booking.status);
    return true;
  });

  const searchValue = bookingSearch.trim().toLowerCase();
  const searchedBookings = filteredBookings.filter((booking) => {
    if (!searchValue) return true;
    const vendorName = booking.vendor?.user?.name?.toLowerCase() || '';
    const serviceNames = (booking.selectedServices || [])
      .map((service) => service.serviceListing?.name?.toLowerCase() || '')
      .join(' ');
    const bookingId = booking.id?.toLowerCase() || '';
    return (
      vendorName.includes(searchValue) ||
      serviceNames.includes(searchValue) ||
      bookingId.includes(searchValue)
    );
  });

  const sortByOption = (list) => {
    return [...list].sort((a, b) => {
      const dateA = a.reservedDate ? new Date(a.reservedDate).getTime() : 0;
      const dateB = b.reservedDate ? new Date(b.reservedDate).getTime() : 0;
      const totalA = calculateTotal(a);
      const totalB = calculateTotal(b);

      switch (bookingSort) {
        case 'date_asc':
          return dateA - dateB;
        case 'date_desc':
          return dateB - dateA;
        case 'amount_high':
          return totalB - totalA;
        case 'amount_low':
          return totalA - totalB;
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        default:
          return dateB - dateA;
      }
    });
  };

  const displayBookings = sortByOption(searchedBookings);

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

        <Paper elevation={2} sx={{ mb: 3, overflow: 'hidden' }}>
          <Tabs
            value={selectedTab}
            onChange={(e, newValue) => setSelectedTab(newValue)}
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
              },
            }}
          >
            <Tab label="All Bookings" />
            <Tab label="Pending" />
            <Tab label="Payment Due" />
            <Tab label="Confirmed" />
            <Tab label="Completed" />
            <Tab label="Cancelled" />
          </Tabs>
        </Paper>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            mb: 3,
          }}
        >
          <TextField
            fullWidth
            placeholder="Search by vendor, service, or booking ID"
            value={bookingSearch}
            onChange={(e) => setBookingSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <FormControl sx={{ minWidth: { xs: '100%', md: 220 } }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              label="Sort By"
              value={bookingSort}
              onChange={(e) => setBookingSort(e.target.value)}
            >
              <MenuItem value="date_desc">Wedding date (newest)</MenuItem>
              <MenuItem value="date_asc">Wedding date (oldest)</MenuItem>
              <MenuItem value="amount_high">Amount (high to low)</MenuItem>
              <MenuItem value="amount_low">Amount (low to high)</MenuItem>
              <MenuItem value="status">Status A-Z</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {displayBookings.length === 0 ? (
          <Paper elevation={2} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No bookings found
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {displayBookings.map((booking) => {
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
                        {booking.project?.eventStartTime && (
                          <Typography variant="caption" color="text.secondary">
                            Time: {new Date(booking.project.eventStartTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        )}
                      </Box>
                      {booking.project?.venueServiceListing && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Venue
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {booking.project.venueServiceListing.name || 'Venue'}
                          </Typography>
                        </Box>
                      )}
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

                    {/* Services List */}
                    {booking.selectedServices && booking.selectedServices.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                          Services ({booking.selectedServices.length})
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {booking.selectedServices.map((service, index) => (
                            <Chip
                              key={index}
                              label={`${service.serviceListing?.name || 'Service'} (${service.quantity || 1})`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          ))}
                        </Box>
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
                    {selectedBooking.depositDueDate && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Deposit Due Date:</Typography>
                        <Typography variant="body2" fontWeight="medium" color="error">
                          {formatDate(selectedBooking.depositDueDate)}
                        </Typography>
                      </Box>
                    )}
                    {selectedBooking.finalDueDate && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Final Payment Due Date:</Typography>
                        <Typography variant="body2" fontWeight="medium" color="error">
                          {formatDate(selectedBooking.finalDueDate)}
                        </Typography>
                      </Box>
                    )}
                    {/* Show when payments were actually made (if any) */}
                    {selectedBooking.payments && selectedBooking.payments.some((p) => p.paymentType === 'deposit') && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Deposit Paid On:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {formatDate(
                            selectedBooking.payments.find((p) => p.paymentType === 'deposit')?.paymentDate
                          )}
                        </Typography>
                      </Box>
                    )}
                    {selectedBooking.payments && selectedBooking.payments.some((p) => p.paymentType === 'final') && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Final Payment Paid On:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {formatDate(
                            selectedBooking.payments.find((p) => p.paymentType === 'final')?.paymentDate
                          )}
                        </Typography>
                      </Box>
                    )}
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
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {service.serviceListing.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                Quantity: {quantity}
                              </Typography>
                            </Box>
                            <Typography variant="body2" fontWeight="medium" color="primary.main">
                              RM {totalPrice.toLocaleString()}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {breakdownText}
                          </Typography>
                          <Chip
                            label={pricingPolicy.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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

                {selectedBooking.reviews && selectedBooking.reviews.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Your Reviews
                      </Typography>
                      <Stack spacing={1}>
                        {selectedBooking.reviews.map((review, index) => {
                          const service = selectedBooking.selectedServices.find(
                            (s) => s.serviceListingId === review.serviceListingId
                          );
                          return (
                            <Box
                              key={review.id || index}
                              sx={{ p: 2, backgroundColor: '#f0f7ff', borderRadius: 1 }}
                            >
                              <Typography variant="body2" fontWeight="medium" gutterBottom>
                                {service?.serviceListing?.name || 'Service'}
                              </Typography>
                              <Rating value={review.rating} readOnly size="small" sx={{ mb: 1 }} />
                              {review.comment && (
                                <Typography variant="body2">{review.comment}</Typography>
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(review.reviewDate)}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  </>
                )}

                {selectedBooking.cancellation && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Cancellation Information
                      </Typography>
                      <Box sx={{ p: 2, backgroundColor: '#fff3cd', borderRadius: 1, border: '1px solid #ffc107' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">Cancelled on:</Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {formatDate(selectedBooking.cancellation.cancelledAt)}
                          </Typography>
                        </Box>
                        {selectedBooking.cancellation.cancellationReason && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="body2">Reason:</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {selectedBooking.cancellation.cancellationReason}
                            </Typography>
                          </Box>
                        )}
                        {selectedBooking.cancellation.cancellationFee !== null && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">Cancellation fee:</Typography>
                            <Typography variant="body2" fontWeight="medium">
                              RM {parseFloat(selectedBooking.cancellation.cancellationFee || 0).toLocaleString()}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowDetailDialog(false)}>Close</Button>
              {/* Show cancellation button for cancellable bookings */}
              {selectedBooking && ['pending_vendor_confirmation', 'pending_deposit_payment', 'confirmed', 'pending_final_payment'].includes(selectedBooking.status) && !selectedBooking.cancellation && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => handleCancelBooking(selectedBooking)}
                  startIcon={<Cancel />}
                >
                  Cancel Booking
                </Button>
              )}
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

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onClose={() => setShowReviewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="div">
            Leave a Review
          </Typography>
          <IconButton
            aria-label="close"
            onClick={() => setShowReviewDialog(false)}
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
            {error && (
              <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Typography variant="subtitle2" gutterBottom>
              Vendor: {selectedBooking?.vendor?.user?.name || 'Vendor'}
            </Typography>
            
            {selectedBooking?.selectedServices && selectedBooking.selectedServices.length > 1 && (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Service to Review</InputLabel>
                <Select
                  value={reviewData.serviceListingId}
                  onChange={(e) => setReviewData({ ...reviewData, serviceListingId: e.target.value })}
                  label="Service to Review"
                >
                  {selectedBooking.selectedServices.map((service) => {
                    // Check if review already exists for this service
                    const hasReview = selectedBooking.reviews?.some(
                      (review) => review.serviceListingId === service.serviceListingId
                    );
                    return (
                      <MenuItem
                        key={service.serviceListingId}
                        value={service.serviceListingId}
                        disabled={hasReview}
                      >
                        {service.serviceListing.name}
                        {hasReview && ' (Already reviewed)'}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            )}
            
            {selectedBooking?.selectedServices && selectedBooking.selectedServices.length === 1 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Service: {selectedBooking.selectedServices[0].serviceListing.name}
              </Typography>
            )}

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Rating
              </Typography>
              <Rating
                value={reviewData.rating}
                onChange={(e, newValue) => setReviewData({ ...reviewData, rating: newValue || 5 })}
                size="large"
              />
            </Box>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Comment (Optional)"
              value={reviewData.comment}
              onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
              placeholder="Share your experience..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowReviewDialog(false)} disabled={submittingReview}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitReview}
            disabled={submittingReview || !reviewData.serviceListingId}
          >
            {submittingReview ? 'Submitting...' : 'Submit Review'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancellation Dialog */}
      <Dialog open={showCancelDialog} onClose={() => setShowCancelDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="div">
            Cancel Booking
          </Typography>
          <IconButton
            aria-label="close"
            onClick={() => setShowCancelDialog(false)}
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
            {error && (
              <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {loadingFeePreview ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : cancellationFeePreview ? (
              <>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Are you sure you want to cancel this booking? This action cannot be undone.
                </Alert>

                {cancellationFeePreview.cancellationPolicy && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Cancellation Policy
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {cancellationFeePreview.cancellationPolicy}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ mb: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Cancellation Fee Calculation
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Days until wedding:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {cancellationFeePreview.daysUntilWedding !== null &&
                        cancellationFeePreview.daysUntilWedding !== undefined
                          ? cancellationFeePreview.daysUntilWedding >= 0
                            ? `${cancellationFeePreview.daysUntilWedding} days`
                            : `${Math.abs(cancellationFeePreview.daysUntilWedding)} days ago`
                          : 'N/A'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Fee percentage:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {(cancellationFeePreview.feePercentage * 100).toFixed(0)}%
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Cancellation fee:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        RM {cancellationFeePreview.feeAmount.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Amount already paid:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        RM {cancellationFeePreview.amountPaid.toLocaleString()}
                      </Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    {cancellationFeePreview.requiresPayment ? (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1" fontWeight="bold">
                          Payment required:
                        </Typography>
                        <Typography variant="body1" fontWeight="bold" color="error.main">
                          RM {cancellationFeePreview.feeDifference.toLocaleString()}
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1" fontWeight="bold" color="success.main">
                          No additional payment required
                        </Typography>
                      </Box>
                    )}
                    {cancellationFeePreview.reason && (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        {cancellationFeePreview.reason}
                      </Alert>
                    )}
                  </Box>
                </Box>

                {/* Cancellation Reason */}
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                    Reason for cancellation <span style={{ color: 'red' }}>*</span>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    Select a preset reason or provide your own explanation
                  </Typography>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'repeat(auto-fit, minmax(150px, 1fr))',
                        sm: 'repeat(auto-fit, minmax(180px, 1fr))',
                      },
                      gap: 1.5,
                      mb: 2,
                    }}
                  >
                    {[
                      'Change of wedding date',
                      'Change of venue',
                      'Found another vendor',
                      'Budget issue',
                      'Personal reasons',
                    ].map((reason) => (
                      <Chip
                        key={reason}
                        label={reason}
                        onClick={() => {
                          setSelectedReasonPreset(reason);
                          setCancellationReason(reason);
                        }}
                        color={selectedReasonPreset === reason ? 'primary' : 'default'}
                        variant={selectedReasonPreset === reason ? 'filled' : 'outlined'}
                        sx={{
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          borderRadius: '999px',
                          py: 0.5,
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 2,
                          },
                        }}
                      />
                    ))}
                  </Box>

                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="Cancellation reason"
                    value={cancellationReason}
                    onChange={(e) => {
                      setCancellationReason(e.target.value);
                      // Clear preset selection if user manually edits
                      if (selectedReasonPreset && e.target.value !== selectedReasonPreset) {
                        setSelectedReasonPreset(null);
                      }
                    }}
                    placeholder={
                      selectedReasonPreset
                        ? 'You can edit the selected reason or provide additional details'
                        : 'Please explain why you are cancelling this booking'
                    }
                    required
                    error={!cancellationReason || cancellationReason.trim().length === 0}
                    helperText={
                      !cancellationReason || cancellationReason.trim().length === 0
                        ? 'Please provide a reason for cancellation'
                        : ''
                    }
                  />
                </Box>
              </>
            ) : (
              <Alert severity="error">Failed to load cancellation fee information</Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCancelDialog(false)} disabled={cancelling}>
            Keep Booking
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmCancellation}
            disabled={
              cancelling ||
              loadingFeePreview ||
              !cancellationFeePreview ||
              !cancellationReason.trim()
            }
          >
            {cancelling ? 'Cancelling...' : cancellationFeePreview?.requiresPayment ? 'Pay Fee & Cancel' : 'Confirm Cancellation'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default MyBookings;

