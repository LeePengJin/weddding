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
  IconButton,
  Card,
  CardContent,
  Grid,
  Snackbar,
  Tabs,
  Tab,
  TableSortLabel,
  TablePagination,
} from '@mui/material';
import { Close, Cancel } from '@mui/icons-material';
import { apiFetch } from '../../lib/api';
import ConfirmationDialog from '../../components/ConfirmationDialog/ConfirmationDialog';
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
  const [confirmationDialog, setConfirmationDialog] = useState({
    open: false,
    type: null, // 'accept' or 'reject'
    booking: null,
  });
  const [sortBy, setSortBy] = useState('bookingDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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
    setConfirmationDialog({
      open: true,
      type: 'accept',
      booking: booking,
    });
  };

  const handleReject = (booking) => {
    setConfirmationDialog({
      open: true,
      type: 'reject',
      booking: booking,
    });
  };

  const handleCancelBooking = async (booking) => {
    try {
      setUpdatingStatus(true);
      setError(null);

      await apiFetch(`/bookings/${booking.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
          reason: null,
        }),
      });

      setSuccess('Booking cancelled successfully');
      setShowDetailDialog(false);
      await fetchBookings();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to cancel booking');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleConfirmAction = () => {
    if (!confirmationDialog.booking) return;

    if (confirmationDialog.type === 'accept') {
      handleStatusUpdate(confirmationDialog.booking.id, 'pending_deposit_payment');
    } else if (confirmationDialog.type === 'reject') {
      handleStatusUpdate(confirmationDialog.booking.id, 'rejected');
    }

    setConfirmationDialog({ open: false, type: null, booking: null });
  };

  const handleCloseConfirmation = () => {
    setConfirmationDialog({ open: false, type: null, booking: null });
  };

  const getStatusColor = (status) => {
    const statusColors = {
      pending_vendor_confirmation: 'warning',
      pending_deposit_payment: 'info',
      confirmed: 'success',
      pending_final_payment: 'info',
      cancelled_by_couple: 'default',
      cancelled_by_vendor: 'error',
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
      cancelled_by_couple: 'Cancelled by Couple',
      cancelled_by_vendor: 'Cancelled by Vendor',
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

  // Sort bookings
  const sortedBookings = [...bookings].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'couple':
        aValue = a.couple.user.name || '';
        bValue = b.couple.user.name || '';
        break;
      case 'reservedDate':
        aValue = new Date(a.reservedDate).getTime();
        bValue = new Date(b.reservedDate).getTime();
        break;
      case 'totalAmount':
        aValue = calculateTotal(a);
        bValue = calculateTotal(b);
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'bookingDate':
      default:
        aValue = new Date(a.bookingDate).getTime();
        bValue = new Date(b.bookingDate).getTime();
        break;
    }

    if (typeof aValue === 'string') {
      return sortOrder === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    } else {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }
  });

  // Paginate bookings
  const paginatedBookings = sortedBookings.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(0); // Reset to first page when sorting changes
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleTabChange = (event, newValue) => {
    setStatusFilter(newValue);
    setPage(0); // Reset to first page when filter changes
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
      <Box className="page-header" sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
          Booking Requests
        </Typography>
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <Tabs
            value={statusFilter}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                minHeight: 48,
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: 'primary.main',
                  fontWeight: 600,
                },
              },
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
              },
            }}
          >
            <Tab label="All Bookings" value="all" />
            <Tab label="Pending Confirmation" value="pending_vendor_confirmation" />
            <Tab label="Pending Deposit" value="pending_deposit_payment" />
            <Tab label="Confirmed" value="confirmed" />
            <Tab label="Pending Final Payment" value="pending_final_payment" />
            <Tab label="Completed" value="completed" />
            <Tab label="Cancelled" value="cancelled" />
            <Tab label="Rejected" value="rejected" />
          </Tabs>
        </Paper>
      </Box>


      {bookings.length === 0 ? (
        <Paper elevation={2} sx={{ p: 4, textAlign: 'center', mt: 2 }}>
          <Typography variant="h6" color="text.secondary">
            No booking requests found
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'couple'}
                    direction={sortBy === 'couple' ? sortOrder : 'asc'}
                    onClick={() => handleSort('couple')}
                  >
                    Couple / Project
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'reservedDate'}
                    direction={sortBy === 'reservedDate' ? sortOrder : 'asc'}
                    onClick={() => handleSort('reservedDate')}
                  >
                    Reserved Date
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Services</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'totalAmount'}
                    direction={sortBy === 'totalAmount' ? sortOrder : 'asc'}
                    onClick={() => handleSort('totalAmount')}
                  >
                    Total Amount
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'status'}
                    direction={sortBy === 'status' ? sortOrder : 'asc'}
                    onClick={() => handleSort('status')}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedBookings.map((booking) => (
                <TableRow key={booking.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {booking.couple.user.name || 'Unknown Couple'}
                      </Typography>
                      {booking.project && (
                        <Typography variant="caption" color="text.secondary">
                          {booking.project.projectName}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontFamily: 'monospace', mt: 0.5 }}>
                        ID: {booking.id.substring(0, 8)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(booking.reservedDate)}
                    </Typography>
                    {booking.project?.eventStartTime && (
                      <Typography variant="caption" color="text.secondary">
                        {new Date(booking.project.eventStartTime).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {booking.project?.eventEndTime &&
                          ` - ${new Date(booking.project.eventEndTime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`}
                      </Typography>
                    )}
                    {booking.project?.venueServiceListing && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Venue: {booking.project.venueServiceListing.name || 'Venue'}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Booked: {formatDate(booking.bookingDate)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {booking.selectedServices.length} service{booking.selectedServices.length !== 1 ? 's' : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {booking.selectedServices.slice(0, 2).map(s => s.serviceListing.name).join(', ')}
                      {booking.selectedServices.length > 2 && '...'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      RM {calculateTotal(booking).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(booking.status)}
                      color={getStatusColor(booking.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {booking.status === 'pending_vendor_confirmation' && (
                        <>
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            onClick={() => handleAccept(booking)}
                            disabled={updatingStatus}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => handleReject(booking)}
                            disabled={updatingStatus}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleViewDetails(booking)}
                      >
                        Details
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={sortedBookings.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </TableContainer>
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
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" component="div">
                Booking Details - {selectedBooking.couple.user.name}
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
                    {selectedBooking.project?.eventStartTime && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Time:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {new Date(selectedBooking.project.eventStartTime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {selectedBooking.project?.eventEndTime &&
                            ` - ${new Date(selectedBooking.project.eventEndTime).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`}
                        </Typography>
                      </Box>
                    )}
                    {selectedBooking.project?.venueServiceListing && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Venue:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {selectedBooking.project.venueServiceListing.name || 'Venue'}
                        </Typography>
                      </Box>
                    )}
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

                {selectedBooking.cancellation && (
                  <>
                    <Box sx={{ mb: 3, p: 2, backgroundColor: '#fff3cd', borderRadius: 1, border: '1px solid #ffc107' }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Cancellation Information
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Cancelled on:</Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {formatDateTime(selectedBooking.cancellation.cancelledAt)}
                          </Typography>
                        </Box>
                        {selectedBooking.cancellation.cancellationReason && (
                          <Box>
                            <Typography variant="body2">Reason:</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {selectedBooking.cancellation.cancellationReason}
                            </Typography>
                          </Box>
                        )}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Cancelled by:</Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {selectedBooking.status === 'cancelled_by_vendor' ? 'Vendor (You)' : 'Couple'}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </>
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
              {/* Show cancellation button for cancellable bookings (vendor can cancel any active booking) */}
              {selectedBooking && ['pending_deposit_payment', 'confirmed', 'pending_final_payment'].includes(selectedBooking.status) && !selectedBooking.cancellation && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => handleCancelBooking(selectedBooking)}
                  disabled={updatingStatus}
                  startIcon={<Cancel />}
                >
                  Cancel Booking
                </Button>
              )}
              <Button onClick={() => setShowDetailDialog(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmationDialog.open}
        onClose={handleCloseConfirmation}
        onConfirm={handleConfirmAction}
        title={
          confirmationDialog.type === 'accept'
            ? 'Accept Booking Request?'
            : 'Reject Booking Request?'
        }
        description={
          confirmationDialog.booking
            ? confirmationDialog.type === 'accept'
              ? `Are you sure you want to accept the booking request from ${confirmationDialog.booking.couple.user.name}? This will move the booking to pending deposit payment status.`
              : `Are you sure you want to reject the booking request from ${confirmationDialog.booking.couple.user.name}? This action cannot be undone.`
            : ''
        }
        confirmText={confirmationDialog.type === 'accept' ? 'Accept' : 'Reject'}
        cancelText="Cancel"
      />

      {/* Success Notification */}
      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSuccess(null)} severity="success" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>

      {/* Error Notification */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BookingRequests;

