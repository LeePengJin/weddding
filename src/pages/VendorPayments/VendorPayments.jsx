import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
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
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import { apiFetch } from '../../lib/api';

export default function VendorPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  useEffect(() => {
    document.title = 'Weddding Vendor — Payments';
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/bookings/vendor/payments');
      setPayments(data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch payments');
    } finally {
      setLoading(false);
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

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter payments
  const filteredPayments = payments.filter((payment) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      payment.id?.toLowerCase().includes(query) ||
      payment.couple?.name?.toLowerCase().includes(query) ||
      payment.couple?.email?.toLowerCase().includes(query) ||
      payment.booking?.selectedServices?.some((s) =>
        s.serviceName?.toLowerCase().includes(query)
      );

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'pending'
        ? !payment.releasedToVendor
        : payment.releasedToVendor;

    // Date filter
    let matchesDate = true;
    if (dateFilter.start) {
      const startDate = new Date(dateFilter.start);
      startDate.setHours(0, 0, 0, 0);
      const paymentDate = new Date(payment.paymentDate);
      if (paymentDate < startDate) matchesDate = false;
    }
    if (dateFilter.end) {
      const endDate = new Date(dateFilter.end);
      endDate.setHours(23, 59, 59, 999);
      const paymentDate = new Date(payment.paymentDate);
      if (paymentDate > endDate) matchesDate = false;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Sort payments
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    let aValue, bValue;

    switch (sortBy) {
      case 'amount':
        aValue = parseFloat(a.amount || 0);
        bValue = parseFloat(b.amount || 0);
        break;
      case 'date':
        aValue = new Date(a.paymentDate || 0).getTime();
        bValue = new Date(b.paymentDate || 0).getTime();
        break;
      case 'couple':
        aValue = a.couple?.name || '';
        bValue = b.couple?.name || '';
        break;
      case 'status':
        aValue = a.releasedToVendor ? 'released' : 'pending';
        bValue = b.releasedToVendor ? 'released' : 'pending';
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

  const handleViewDetails = (payment) => {
    setSelectedPayment(payment);
    setDialogOpen(true);
  };

  const totalPending = payments
    .filter((p) => !p.releasedToVendor)
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const totalReleased = payments
    .filter((p) => p.releasedToVendor)
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Payment Tracking
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Chip
            label={`Pending: RM ${formatCurrency(totalPending)}`}
            color="warning"
            sx={{ fontWeight: 600 }}
          />
          <Chip
            label={`Released: RM ${formatCurrency(totalReleased)}`}
            color="success"
            sx={{ fontWeight: 600 }}
          />
        </Box>
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
          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
              mb: 2,
            }}
          >
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

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2, justifyContent: 'space-between' }}>
            <Box sx={{ flex: 1, display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
              <TextField
                sx={{ width: { xs: '100%', sm: 320, md: 360 } }}
                placeholder="Search by payment ID, couple name, or service..."
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
            </Box>
            <TextField
              type="date"
              label="Start Date"
              value={dateFilter.start}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, start: e.target.value })
              }
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <TextField
              type="date"
              label="End Date"
              value={dateFilter.end}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, end: e.target.value })
              }
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            {(dateFilter.start || dateFilter.end) && (
              <Button
                variant="outlined"
                onClick={() => setDateFilter({ start: '', end: '' })}
              >
                Clear
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
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
                    active={sortBy === 'couple'}
                    direction={sortBy === 'couple' ? sortOrder : 'asc'}
                    onClick={() => handleSort('couple')}
                  >
                    Couple
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
                <TableCell sx={{ fontWeight: 600 }}>Payment Type</TableCell>
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
                  <TableCell colSpan={6} align="center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : paginatedPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No payments found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPayments.map((payment) => (
                  <TableRow key={payment.id} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(payment.paymentDate)}
                      </Typography>
                      {payment.releasedAt && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Released: {formatDate(payment.releasedAt)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {payment.couple?.name || 'N/A'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {payment.couple?.email || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        RM {formatCurrency(payment.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={payment.paymentType === 'deposit' ? 'Deposit' : 'Final Payment'}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(payment.releasedToVendor)}
                        size="small"
                        color={getStatusColor(payment.releasedToVendor)}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetails(payment)}
                        color="primary"
                        title="View Details"
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PaymentIcon color="primary" />
            <Typography variant="h6" component="div">
              Payment Details
            </Typography>
          </Box>
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
                      {selectedPayment.paymentMethod === 'credit_card'
                        ? 'Credit Card'
                        : selectedPayment.paymentMethod === 'bank_transfer'
                        ? 'Bank Transfer'
                        : selectedPayment.paymentMethod === 'touch_n_go'
                        ? "Touch 'n Go"
                        : selectedPayment.paymentMethod}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Payment Date:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {formatDateTime(selectedPayment.paymentDate)}
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
                        {formatDateTime(selectedPayment.releasedAt)}
                      </Typography>
                    </Box>
                  )}
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
                    <Typography variant="body2">Email:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {selectedPayment.couple?.email || 'N/A'}
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

              {selectedPayment.booking?.selectedServices &&
                selectedPayment.booking.selectedServices.length > 0 && (
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
    </Box>
  );
}

