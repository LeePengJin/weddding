import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Edit, Close, Search } from '@mui/icons-material';
import { apiFetch } from '../../lib/api';

const RefundStatus = {
  NOT_APPLICABLE: 'not_applicable',
  PENDING: 'pending',
  PROCESSED: 'processed',
};

const RefundsAndCancellations = () => {
  const [cancellations, setCancellations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCancellation, setSelectedCancellation] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    refundStatus: '',
    refundMethod: '',
    refundNotes: '',
  });
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderBy, setOrderBy] = useState('cancelledAt');
  const [orderDirection, setOrderDirection] = useState('desc');

  useEffect(() => {
    fetchCancellations();
  }, []);

  const fetchCancellations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch('/admin/cancellations');
      setCancellations(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch cancellations');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (cancellation) => {
    setSelectedCancellation(cancellation);
    setFormData({
      refundStatus: cancellation.refundStatus || RefundStatus.NOT_APPLICABLE,
      refundMethod: cancellation.refundMethod || '',
      refundNotes: cancellation.refundNotes || '',
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedCancellation) return;

    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/admin/cancellations/${selectedCancellation.id}`, {
        method: 'PATCH',
        body: JSON.stringify(formData),
      });
      setEditDialogOpen(false);
      await fetchCancellations();
    } catch (err) {
      setError(err.message || 'Failed to update refund information');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRefundStatusColor = (status) => {
    switch (status) {
      case RefundStatus.PENDING:
        return 'warning';
      case RefundStatus.PROCESSED:
        return 'success';
      default:
        return 'default';
    }
  };

  const getRefundStatusLabel = (status) => {
    switch (status) {
      case RefundStatus.PENDING:
        return 'Pending';
      case RefundStatus.PROCESSED:
        return 'Processed';
      default:
        return 'Not Applicable';
    }
  };

  const searchValue = searchTerm.trim().toLowerCase();

  const filteredCancellations = [...cancellations]
    .filter((cancellation) => {
      if (!searchValue) return true;
      const bookingId = cancellation.bookingId?.toLowerCase() || '';
      const coupleName = cancellation.booking?.couple?.user?.name?.toLowerCase() || '';
      const vendorName = cancellation.booking?.vendor?.user?.name?.toLowerCase() || '';
      const reason = cancellation.cancellationReason?.toLowerCase() || '';
      return (
        bookingId.includes(searchValue) ||
        coupleName.includes(searchValue) ||
        vendorName.includes(searchValue) ||
        reason.includes(searchValue)
      );
    })
    .sort((a, b) => {
      const direction = orderDirection === 'asc' ? 1 : -1;
      if (orderBy === 'cancelledAt') {
        const dateA = a.cancelledAt ? new Date(a.cancelledAt).getTime() : 0;
        const dateB = b.cancelledAt ? new Date(b.cancelledAt).getTime() : 0;
        return (dateA - dateB) * direction;
      }
      if (orderBy === 'refundAmount') {
        const amountA = parseFloat(a.refundAmount) || 0;
        const amountB = parseFloat(b.refundAmount) || 0;
        return (amountA - amountB) * direction;
      }
      if (orderBy === 'refundStatus') {
        const statusA = getRefundStatusLabel(a.refundStatus);
        const statusB = getRefundStatusLabel(b.refundStatus);
        return statusA.localeCompare(statusB) * direction;
      }
      // default fallback
      const dateA = a.cancelledAt ? new Date(a.cancelledAt).getTime() : 0;
      const dateB = b.cancelledAt ? new Date(b.cancelledAt).getTime() : 0;
      return (dateA - dateB) * direction;
    });

  const handleRequestSort = (property) => {
    if (orderBy === property) {
      setOrderDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(property);
      setOrderDirection('asc');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 700 }}>
        Refunds & Cancellations
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          mb: 2,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <TextField
          sx={{ width: { xs: '100%', sm: 320, md: 360 } }}
          placeholder="Search by booking, couple, vendor, or reason"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell><strong>Booking ID</strong></TableCell>
                <TableCell><strong>Couple</strong></TableCell>
                <TableCell><strong>Vendor</strong></TableCell>
                <TableCell><strong>Cancellation Reason</strong></TableCell>
                <TableCell><strong>Refund Required</strong></TableCell>
                <TableCell sortDirection={orderBy === 'refundAmount' ? orderDirection : false}>
                  <TableSortLabel
                    active={orderBy === 'refundAmount'}
                    direction={orderBy === 'refundAmount' ? orderDirection : 'asc'}
                    onClick={() => handleRequestSort('refundAmount')}
                  >
                    <strong>Refund Amount</strong>
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={orderBy === 'refundStatus' ? orderDirection : false}>
                  <TableSortLabel
                    active={orderBy === 'refundStatus'}
                    direction={orderBy === 'refundStatus' ? orderDirection : 'asc'}
                    onClick={() => handleRequestSort('refundStatus')}
                  >
                    <strong>Refund Status</strong>
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={orderBy === 'cancelledAt' ? orderDirection : false}>
                  <TableSortLabel
                    active={orderBy === 'cancelledAt'}
                    direction={orderBy === 'cancelledAt' ? orderDirection : 'desc'}
                    onClick={() => handleRequestSort('cancelledAt')}
                  >
                    <strong>Cancelled Date</strong>
                  </TableSortLabel>
                </TableCell>
                <TableCell><strong>Actions</strong></TableCell>
              </TableRow>
          </TableHead>
          <TableBody>
            {filteredCancellations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No cancellations found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredCancellations.map((cancellation) => (
                <TableRow key={cancellation.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                      {cancellation.bookingId?.substring(0, 8) || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {cancellation.booking?.couple?.user?.name || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {cancellation.booking?.vendor?.user?.name || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cancellation.cancellationReason || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={cancellation.refundRequired ? 'Yes' : 'No'}
                      color={cancellation.refundRequired ? 'warning' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {cancellation.refundAmount ? (
                      <Typography variant="body2" fontWeight="medium">
                        RM {parseFloat(cancellation.refundAmount).toLocaleString()}
                      </Typography>
                    ) : (
                      'N/A'
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getRefundStatusLabel(cancellation.refundStatus)}
                      color={getRefundStatusColor(cancellation.refundStatus)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {formatDate(cancellation.cancelledAt)}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(cancellation)}
                      color="primary"
                      aria-label="Edit refund"
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Update Refund Information</Typography>
          <IconButton onClick={() => setEditDialogOpen(false)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {selectedCancellation && (
              <>
                <Box>
                  <Typography variant="caption" color="text.secondary">Booking ID</Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {selectedCancellation.bookingId?.substring(0, 8)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Refund Required</Typography>
                  <Typography variant="body2">
                    {selectedCancellation.refundRequired ? 'Yes' : 'No'}
                  </Typography>
                </Box>
                {selectedCancellation.refundAmount && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Refund Amount</Typography>
                    <Typography variant="body2" fontWeight="medium">
                      RM {parseFloat(selectedCancellation.refundAmount).toLocaleString()}
                    </Typography>
                  </Box>
                )}
              </>
            )}

            <FormControl fullWidth>
              <InputLabel>Refund Status</InputLabel>
              <Select
                value={formData.refundStatus}
                onChange={(e) => setFormData({ ...formData, refundStatus: e.target.value })}
                label="Refund Status"
              >
                <MenuItem value={RefundStatus.NOT_APPLICABLE}>Not Applicable</MenuItem>
                <MenuItem value={RefundStatus.PENDING}>Pending</MenuItem>
                <MenuItem value={RefundStatus.PROCESSED}>Processed</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Refund Method"
              value={formData.refundMethod}
              onChange={(e) => setFormData({ ...formData, refundMethod: e.target.value })}
              placeholder="e.g., Bank transfer - Maybank xxxx"
              helperText="How the refund will be processed"
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Refund Notes"
              value={formData.refundNotes}
              onChange={(e) => setFormData({ ...formData, refundNotes: e.target.value })}
              placeholder="Internal notes about refund processing..."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RefundsAndCancellations;

