import React, { useState, useEffect } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
} from '@mui/material';
import { apiFetch } from '../../lib/api';
import './BookingRequests.styles.css';

const BookingRequests = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const data = await apiFetch(`/bookings${params}`);
      setBookings(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch booking requests');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (booking) => {
    setSelectedBooking(booking);
    setShowDetailDialog(true);
  };

  const handleStatusUpdate = async (bookingId, newStatus, depositDueDate = null, finalDueDate = null) => {
    try {
      setUpdatingStatus(true);
      setError(null);

      const updateData = { status: newStatus };
      if (depositDueDate) {
        updateData.depositDueDate = depositDueDate;
      }
      if (finalDueDate) {
        updateData.finalDueDate = finalDueDate;
      }

      await apiFetch(`/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });

      setSuccess(`Booking ${newStatus === 'pending_deposit_payment' ? 'accepted' : newStatus === 'rejected' ? 'rejected' : 'updated'} successfully`);
      setShowDetailDialog(false);
      await fetchBookings();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update booking status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAccept = (booking) => {
    // When accepting, transition to pending_deposit_payment
    handleStatusUpdate(booking.id, 'pending_deposit_payment');
  };

  const handleReject = (booking) => {
    if (window.confirm(`Are you sure you want to reject this booking request from ${booking.couple.user.name}?`)) {
      handleStatusUpdate(booking.id, 'rejected');
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      pending_vendor_confirmation: 'warning',
      pending_deposit_payment: 'info',
      confirmed: 'success',
      pending_final_payment: 'info',
      cancelled: 'default',
      rejected: 'error',
      completed: 'success',
    };
    return statusColors[status] || 'default';
  };

  const getStatusLabel = (status) => {
    const statusLabels = {
      pending_vendor_confirmation: 'Pending Confirmation',
      pending_deposit_payment: 'Pending Deposit',
      confirmed: 'Confirmed',
      pending_final_payment: 'Pending Final Payment',
      cancelled: 'Cancelled',
      rejected: 'Rejected',
      completed: 'Completed',
    };
    return statusLabels[status] || status;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
    <Box className="booking-requests">
      <Box className="page-header">
        <Typography variant="h4" component="h1">
          Booking Requests
        </Typography>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Status</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            label="Filter by Status"
          >
            <MenuItem value="all">All Bookings</MenuItem>
            <MenuItem value="pending_vendor_confirmation">Pending Confirmation</MenuItem>
            <MenuItem value="pending_deposit_payment">Pending Deposit</MenuItem>
            <MenuItem value="confirmed">Confirmed</MenuItem>
            <MenuItem value="pending_final_payment">Pending Final Payment</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {bookings.length === 0 ? (
        <Paper elevation={2} sx={{ p: 4, textAlign: 'center', mt: 2 }}>
          <Typography variant="h6" color="text.secondary">
            No booking requests found
          </Typography>
        </Paper>
      ) : (
        <Box className="requests-list" sx={{ mt: 2 }}>
          {bookings.map((booking) => (
            <Paper key={booking.id} elevation={2} sx={{ p: 3, mb: 2 }}>
              <Box className="request-header" sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography variant="h6" component="h3">
                    {booking.couple.user.name || 'Unknown Couple'}
                  </Typography>
                  {booking.project && (
                    <Typography variant="body2" color="text.secondary">
                      Project: {booking.project.projectName}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                  <Chip
                    label={getStatusLabel(booking.status)}
                    color={getStatusColor(booking.status)}
                    size="small"
                  />
                  <Typography variant="caption" color="text.secondary">
                    Booking ID: {booking.id.substring(0, 8)}...
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 4, mb: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Reserved Date
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {formatDate(booking.reservedDate)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Booking Date
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {formatDate(booking.bookingDate)}
                  </Typography>
                </Box>
                {booking.depositDueDate && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Deposit Due
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {formatDate(booking.depositDueDate)}
                    </Typography>
                  </Box>
                )}
                {booking.finalDueDate && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Final Payment Due
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {formatDate(booking.finalDueDate)}
                    </Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Services ({booking.selectedServices.length})
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Service</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {booking.selectedServices.map((service, index) => (
                        <TableRow key={index}>
                          <TableCell>{service.serviceListing.name}</TableCell>
                          <TableCell align="right">{service.quantity}</TableCell>
                          <TableCell align="right">
                            RM {parseFloat(service.serviceListing.price).toLocaleString()}
                          </TableCell>
                          <TableCell align="right">
                            RM {parseFloat(service.totalPrice).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold' }}>
                          Total Amount
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          RM {calculateTotal(booking).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </TableContainer>
              </Box>

              {booking.status === 'pending_vendor_confirmation' && (
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => handleAccept(booking)}
                    disabled={updatingStatus}
                  >
                    Accept Request
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => handleReject(booking)}
                    disabled={updatingStatus}
                  >
                    Reject Request
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => handleViewDetails(booking)}
                  >
                    View Details
                  </Button>
                </Box>
              )}

              {booking.status !== 'pending_vendor_confirmation' && (
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Button variant="outlined" onClick={() => handleViewDetails(booking)}>
                    View Details
                  </Button>
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      )}

      {/* Booking Detail Dialog */}
      <Dialog
        open={showDetailDialog}
        onClose={() => setShowDetailDialog(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedBooking && (
          <>
            <DialogTitle>
              Booking Details - {selectedBooking.couple.user.name}
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
                        label={getStatusLabel(selectedBooking.status)}
                        color={getStatusColor(selectedBooking.status)}
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
                        {formatDateTime(selectedBooking.bookingDate)}
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

                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Couple Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Name:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {selectedBooking.couple.user.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Email:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {selectedBooking.couple.user.email}
                      </Typography>
                    </Box>
                    {selectedBooking.couple.user.contactNumber && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Contact:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {selectedBooking.couple.user.contactNumber}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Services
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Service</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell align="right">Quantity</TableCell>
                          <TableCell align="right">Unit Price</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedBooking.selectedServices.map((service, index) => (
                          <TableRow key={index}>
                            <TableCell>{service.serviceListing.name}</TableCell>
                            <TableCell>{service.serviceListing.category}</TableCell>
                            <TableCell align="right">{service.quantity}</TableCell>
                            <TableCell align="right">
                              RM {parseFloat(service.serviceListing.price).toLocaleString()}
                            </TableCell>
                            <TableCell align="right">
                              RM {parseFloat(service.totalPrice).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold' }}>
                            Total Amount
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            RM {calculateTotal(selectedBooking).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </TableContainer>
                </Box>

                {selectedBooking.payments && selectedBooking.payments.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Payments
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Type</TableCell>
                            <TableCell>Method</TableCell>
                            <TableCell align="right">Amount</TableCell>
                            <TableCell>Date</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedBooking.payments.map((payment, index) => (
                            <TableRow key={index}>
                              <TableCell>{payment.paymentType}</TableCell>
                              <TableCell>{payment.paymentMethod}</TableCell>
                              <TableCell align="right">
                                RM {parseFloat(payment.amount).toLocaleString()}
                              </TableCell>
                              <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              {selectedBooking.status === 'pending_vendor_confirmation' && (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => {
                      handleAccept(selectedBooking);
                    }}
                    disabled={updatingStatus}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => {
                      handleReject(selectedBooking);
                    }}
                    disabled={updatingStatus}
                  >
                    Reject
                  </Button>
                </>
              )}
              <Button onClick={() => setShowDetailDialog(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default BookingRequests;

