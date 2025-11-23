import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  InputAdornment,
  TableSortLabel,
  TablePagination,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Search as SearchIcon,
  Payment as PaymentIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Send as SendIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { apiFetch } from '../../lib/api';
import ConfirmationDialog from '../../components/ConfirmationDialog/ConfirmationDialog';
import { Snackbar, Alert, IconButton, Divider } from '@mui/material';

export default function VendorPayment() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);

  useEffect(() => {
    document.title = 'Weddding Admin — Vendor Payment';
    // Ensure admin session
    apiFetch('/admin/auth/me')
      .then(() => fetchPayments())
      .catch(() => {
        // Will be handled by AdminLayout or redirect
      });
  }, [statusFilter]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const data = await apiFetch(`/admin/vendor-payments${params}`);
      setPayments(data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  const handleReleasePayment = async () => {
    if (!selectedPayment) return;
    
    try {
      await apiFetch(`/admin/vendor-payments/${selectedPayment.id}/release`, {
        method: 'POST',
      });
      setSuccess(`Payment of RM ${formatCurrency(selectedPayment.amount)} has been released to ${selectedPayment.vendor.name}.`);
      setReleaseDialogOpen(false);
      await fetchPayments();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to release payment');
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(0);
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
    setPage(0);
  };

  // Filter and sort payments
  const filteredPayments = payments.filter((payment) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      payment.vendor?.name?.toLowerCase().includes(query) ||
      payment.vendor?.email?.toLowerCase().includes(query) ||
      payment.id?.toLowerCase().includes(query) ||
      payment.couple?.name?.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' 
      ? true 
      : statusFilter === 'pending' 
        ? !payment.releasedToVendor 
        : payment.releasedToVendor;
    return matchesSearch && matchesStatus;
  });

  const sortedPayments = [...filteredPayments].sort((a, b) => {
    let aValue, bValue;

    switch (sortBy) {
      case 'vendor':
        aValue = a.vendorName || '';
        bValue = b.vendorName || '';
        break;
      case 'amount':
        aValue = parseFloat(a.amount || 0);
        bValue = parseFloat(b.amount || 0);
        break;
      case 'date':
        aValue = new Date(a.paymentDate || 0).getTime();
        bValue = new Date(b.paymentDate || 0).getTime();
        break;
      case 'status':
        aValue = a.status || '';
        bValue = b.status || '';
        break;
      default:
        return 0;
    }

    if (typeof aValue === 'string') {
      return sortOrder === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    } else {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }
  });

  const paginatedPayments = sortedPayments.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const getStatusColor = (released) => {
    return released ? 'success' : 'warning';
  };

  const getStatusLabel = (released) => {
    return released ? 'Released' : 'Pending Release';
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleViewDetails = (payment) => {
    setSelectedPayment(payment);
    setDialogOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Vendor Payment
        </Typography>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={() => {
            // TODO: Implement export functionality
            console.log('Export payments');
          }}
        >
          Export
        </Button>
      </Box>

      {error && (
        <Card sx={{ mb: 3, bgcolor: 'error.light' }}>
          <CardContent>
            <Typography color="error">{error}</Typography>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
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
              <Tab label="All Payments" value="all" />
              <Tab label="Pending Release" value="pending" />
              <Tab label="Released" value="released" />
            </Tabs>
          </Paper>
          <TextField
            fullWidth
            placeholder="Search by vendor name, email, or payment ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'vendor'}
                    direction={sortBy === 'vendor' ? sortOrder : 'asc'}
                    onClick={() => handleSort('vendor')}
                  >
                    Vendor
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'amount'}
                    direction={sortBy === 'amount' ? sortOrder : 'asc'}
                    onClick={() => handleSort('amount')}
                  >
                    Amount
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'date'}
                    direction={sortBy === 'date' ? sortOrder : 'asc'}
                    onClick={() => handleSort('date')}
                  >
                    Payment Date
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
                <TableCell align="center" sx={{ fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : paginatedPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No payments found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPayments.map((payment) => (
                  <TableRow key={payment.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {payment.vendor?.name || 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {payment.vendor?.email || 'N/A'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        RM {formatCurrency(payment.amount)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {payment.paymentType === 'deposit' ? 'Deposit' : 'Final Payment'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDate(payment.paymentDate)}</Typography>
                      {payment.releasedAt && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Released: {formatDate(payment.releasedAt)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(payment.releasedToVendor)}
                        size="small"
                        color={getStatusColor(payment.releasedToVendor)}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(payment)}
                          color="primary"
                          title="View Details"
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        {!payment.releasedToVendor && (
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setReleaseDialogOpen(true);
                            }}
                            color="success"
                            title="Release Payment"
                          >
                            <SendIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={sortedPayments.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </TableContainer>
      </Card>

      {/* Payment Details Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="div">
            Payment Details
          </Typography>
          <IconButton
            aria-label="close"
            onClick={() => setDialogOpen(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedPayment && (
            <Box sx={{ pt: 2 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Payment Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Payment ID:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {selectedPayment.id}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Amount:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      RM {formatCurrency(selectedPayment.amount)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Payment Type:</Typography>
                    <Chip
                      label={selectedPayment.paymentType === 'deposit' ? 'Deposit' : 'Final Payment'}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Payment Method:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {selectedPayment.paymentMethod === 'credit_card' ? 'Credit Card' :
                       selectedPayment.paymentMethod === 'bank_transfer' ? 'Bank Transfer' :
                       selectedPayment.paymentMethod === 'touch_n_go' ? 'Touch \'n Go' : selectedPayment.paymentMethod}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Payment Date:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {formatDate(selectedPayment.paymentDate)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Status:</Typography>
                    <Chip
                      label={getStatusLabel(selectedPayment.releasedToVendor)}
                      size="small"
                      color={getStatusColor(selectedPayment.releasedToVendor)}
                    />
                  </Box>
                  {selectedPayment.releasedAt && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Released At:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {formatDate(selectedPayment.releasedAt)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Vendor Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Vendor Name:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {selectedPayment.vendor?.name || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Vendor Email:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {selectedPayment.vendor?.email || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Category:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {selectedPayment.vendor?.category || 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Couple Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Couple Name:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {selectedPayment.couple?.name || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Reserved Date:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {formatDate(selectedPayment.booking?.reservedDate)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {selectedPayment.booking?.selectedServices && selectedPayment.booking.selectedServices.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Services
                    </Typography>
                    {selectedPayment.booking.selectedServices.map((service, idx) => (
                      <Box key={idx} sx={{ mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {service.serviceName} (x{service.quantity})
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          RM {formatCurrency(service.totalPrice)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Release Payment Confirmation Dialog */}
      <ConfirmationDialog
        open={releaseDialogOpen}
        onClose={() => setReleaseDialogOpen(false)}
        onConfirm={handleReleasePayment}
        title="Release Payment to Vendor"
        message={
          selectedPayment
            ? `Are you sure you want to release payment of RM ${formatCurrency(selectedPayment.amount)} to ${selectedPayment.vendor?.name || 'the vendor'}? This action will notify the vendor via email.`
            : ''
        }
        confirmText="Release Payment"
        confirmColor="success"
      />

      {/* Success Notification */}
      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSuccess('')} severity="success" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>

      {/* Error Notification */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setError('')} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}

