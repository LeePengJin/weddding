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
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Rating,
  TextField,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
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
  Search,
} from '@mui/icons-material';
import { apiFetch } from '../../lib/api';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import './BookedSuppliers.styles.css';

const BookedSuppliers = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewData, setReviewData] = useState({
    serviceListingId: '',
    rating: 5,
    comment: '',
  });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierSort, setSupplierSort] = useState('date_desc');

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

  const searchValue = supplierSearch.trim().toLowerCase();
  const filteredSuppliers = bookings.filter((booking) => {
    if (!searchValue) return true;
    const vendorName = booking.vendor?.user?.name?.toLowerCase() || '';
    const serviceNames =
      booking.selectedServices?.map((service) => service.serviceListing?.name?.toLowerCase() || '').join(' ') || '';
    const bookingId = booking.id?.toLowerCase() || '';
    return (
      vendorName.includes(searchValue) ||
      serviceNames.includes(searchValue) ||
      bookingId.includes(searchValue)
    );
  });

  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    const dateA = a.reservedDate ? new Date(a.reservedDate).getTime() : 0;
    const dateB = b.reservedDate ? new Date(b.reservedDate).getTime() : 0;
    const totalA = calculateTotal(a);
    const totalB = calculateTotal(b);

    switch (supplierSort) {
      case 'date_asc':
        return dateA - dateB;
      case 'amount_high':
        return totalB - totalA;
      case 'amount_low':
        return totalA - totalB;
      case 'vendor_az':
        return (a.vendor?.user?.name || '').localeCompare(b.vendor?.user?.name || '');
      case 'date_desc':
      default:
        return dateB - dateA;
    }
  });

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
            onClick={() => navigate(projectId ? `/project-dashboard?projectId=${projectId}` : '/project-dashboard')}
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
            value={supplierSearch}
            onChange={(e) => setSupplierSearch(e.target.value)}
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
              value={supplierSort}
              onChange={(e) => setSupplierSort(e.target.value)}
            >
              <MenuItem value="date_desc">Wedding date (newest)</MenuItem>
              <MenuItem value="date_asc">Wedding date (oldest)</MenuItem>
              <MenuItem value="amount_high">Amount (high to low)</MenuItem>
              <MenuItem value="amount_low">Amount (low to high)</MenuItem>
              <MenuItem value="vendor_az">Vendor A-Z</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {sortedSuppliers.length === 0 ? (
          <Paper elevation={2} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              {bookings.length === 0 ? 'No confirmed bookings yet' : 'No suppliers match your filters'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {bookings.length === 0
                ? 'Your confirmed vendors will appear here.'
                : 'Try adjusting your search keywords or sorting option.'}
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={3}>
            {sortedSuppliers.map((booking) => {
              const total = calculateTotal(booking);
              // Check if all services have been reviewed
              // For single-service bookings, check if that service has a review
              // For multi-service bookings, check if all services have reviews
              const allServicesReviewed =
                booking.selectedServices &&
                booking.selectedServices.length > 0 &&
                booking.reviews &&
                booking.selectedServices.every((service) =>
                  booking.reviews.some((review) => review.serviceListingId === service.serviceListingId)
                );
              const hasReview = booking.reviews && booking.reviews.length > 0;
              
              // Check if there are any services without reviews
              const hasUnreviewedServices = booking.selectedServices && booking.selectedServices.some(
                (service) => !booking.reviews?.some((review) => review.serviceListingId === service.serviceListingId)
              );

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
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Your Reviews
                        </Typography>
                        <Stack spacing={1}>
                          {booking.reviews.map((review, index) => {
                            const service = booking.selectedServices.find(
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
                              </Box>
                            );
                          })}
                        </Stack>
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
                    {booking.status === 'completed' && hasUnreviewedServices && (
                      <Button
                        variant="contained"
                        startIcon={<Star />}
                        onClick={() => handleLeaveReview(booking)}
                      >
                        {hasReview ? 'Add Review' : 'Leave Review'}
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      onClick={() => navigate(`/my-bookings?projectId=${projectId}&bookingId=${booking.id}`)}
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
    </Box>
  );
};

export default BookedSuppliers;

