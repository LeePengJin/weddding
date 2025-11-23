import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Rating,
  TextField,
  IconButton,
} from '@mui/material';
import {
  ArrowBack,
  Message,
  Star,
  Phone,
  Email,
  LocationOn,
  CheckCircle,
  Close,
} from '@mui/icons-material';
import { apiFetch } from '../../lib/api';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import './BookedSuppliers.styles.css';

const BookedSuppliers = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewData, setReviewData] = useState({
    rating: 5,
    comment: '',
  });

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch('/bookings');
      // Only show confirmed, pending_final_payment, and completed bookings
      const confirmedBookings = data.filter(
        (booking) =>
          booking.status === 'confirmed' ||
          booking.status === 'pending_final_payment' ||
          booking.status === 'completed'
      );
      setBookings(confirmedBookings || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch bookings');
    } finally {
      setLoading(false);
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

  const handleLeaveReview = (booking) => {
    setSelectedBooking(booking);
    setReviewData({
      rating: 5,
      comment: '',
    });
    setShowReviewDialog(true);
  };

  const handleSubmitReview = async () => {
    try {
      setError(null);
      // TODO: Implement review API endpoint
      // await apiFetch(`/bookings/${selectedBooking.id}/reviews`, {
      //   method: 'POST',
      //   body: JSON.stringify({
      //     serviceListingId: selectedBooking.selectedServices[0].serviceListingId,
      //     rating: reviewData.rating,
      //     comment: reviewData.comment,
      //   }),
      // });
      setShowReviewDialog(false);
      setSelectedBooking(null);
      // await fetchBookings();
      alert('Review functionality will be implemented soon');
    } catch (err) {
      setError(err.message || 'Failed to submit review');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const calculateTotal = (booking) => {
    return booking.selectedServices.reduce((sum, service) => {
      return sum + parseFloat(service.totalPrice);
    }, 0);
  };

  if (loading && bookings.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="booked-suppliers" sx={{ minHeight: '100vh', backgroundColor: '#f5f6fa', pb: 6 }}>
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
            Booked Suppliers
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View your confirmed vendors and suppliers
          </Typography>
        </Box>
      </Box>

      <Box sx={{ maxWidth: '1200px', margin: '0 auto', px: 3 }}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {bookings.length === 0 ? (
          <Paper elevation={2} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No confirmed bookings yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Your confirmed vendors will appear here
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={3}>
            {bookings.map((booking) => {
              const total = calculateTotal(booking);
              const hasReview = booking.reviews && booking.reviews.length > 0;

              return (
                <Card key={booking.id} elevation={2}>
                  <CardContent>
                    <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                      <UserAvatar
                        user={booking.vendor?.user || { name: 'Vendor' }}
                        size={64}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="h5" component="h3">
                            {booking.vendor?.user?.name || 'Vendor'}
                          </Typography>
                          <Chip
                            icon={<CheckCircle />}
                            label={booking.status === 'completed' ? 'Completed' : 'Confirmed'}
                            color="success"
                            size="small"
                          />
                        </Box>
                        {booking.vendor?.user?.email && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            <Email sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                            {booking.vendor.user.email}
                          </Typography>
                        )}
                        {booking.vendor?.user?.contactNumber && (
                          <Typography variant="body2" color="text.secondary">
                            <Phone sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                            {booking.vendor.user.contactNumber}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Services Booked
                      </Typography>
                      <Stack spacing={1}>
                        {booking.selectedServices.map((service, index) => (
                          <Box
                            key={index}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              p: 1.5,
                              backgroundColor: '#f5f5f5',
                              borderRadius: 1,
                            }}
                          >
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {service.serviceListing.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Quantity: {service.quantity} × RM{' '}
                                {parseFloat(service.serviceListing.price).toLocaleString()}
                              </Typography>
                            </Box>
                            <Typography variant="body2" fontWeight="medium">
                              RM {parseFloat(service.totalPrice).toLocaleString()}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, pt: 2, borderTop: 1 }}>
                        <Typography variant="h6">Total:</Typography>
                        <Typography variant="h6">RM {total.toLocaleString()}</Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Reserved Date
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {formatDate(booking.reservedDate)}
                        </Typography>
                      </Box>
                      {booking.project && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Project
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {booking.project.projectName}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {hasReview && (
                      <Box sx={{ mt: 2, p: 2, backgroundColor: '#f0f7ff', borderRadius: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Your Review
                        </Typography>
                        <Rating value={booking.reviews[0].rating} readOnly size="small" sx={{ mb: 1 }} />
                        {booking.reviews[0].comment && (
                          <Typography variant="body2">{booking.reviews[0].comment}</Typography>
                        )}
                      </Box>
                    )}
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<Message />}
                      onClick={() => handleMessageVendor(booking)}
                    >
                      Message Vendor
                    </Button>
                    {booking.status === 'completed' && !hasReview && (
                      <Button
                        variant="contained"
                        startIcon={<Star />}
                        onClick={() => handleLeaveReview(booking)}
                      >
                        Leave Review
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      onClick={() => navigate(`/my-bookings?bookingId=${booking.id}`)}
                    >
                      View Details
                    </Button>
                  </CardActions>
                </Card>
              );
            })}
          </Stack>
        )}
      </Box>

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
            <Typography variant="subtitle2" gutterBottom>
              Vendor: {selectedBooking?.vendor?.user?.name || 'Vendor'}
            </Typography>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Rating
              </Typography>
              <Rating
                value={reviewData.rating}
                onChange={(e, newValue) => setReviewData({ ...reviewData, rating: newValue })}
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
          <Button onClick={() => setShowReviewDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmitReview}>
            Submit Review
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BookedSuppliers;

