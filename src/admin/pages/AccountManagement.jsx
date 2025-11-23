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
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Divider,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { apiFetch } from '../../lib/api';
import ConfirmationDialog from '../../components/ConfirmationDialog/ConfirmationDialog';

export default function AccountManagement() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [accountType, setAccountType] = useState('couple'); // 'couple' or 'vendor'
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockReasonError, setBlockReasonError] = useState('');

  useEffect(() => {
    document.title = 'Weddding Admin — Account Management';
    // Ensure admin session
    apiFetch('/admin/auth/me')
      .then(() => fetchAccounts())
      .catch(() => {
        // Will be handled by AdminLayout or redirect
      });
  }, [accountType]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/admin/accounts?role=${accountType}`);
      setAccounts(data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch accounts');
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

  // Filter and sort accounts
  const filteredAccounts = accounts.filter((account) => {
    const query = searchQuery.toLowerCase();
    return (
      account.name?.toLowerCase().includes(query) ||
      account.email?.toLowerCase().includes(query) ||
      account.role?.toLowerCase().includes(query)
    );
  });

  const sortedAccounts = [...filteredAccounts].sort((a, b) => {
    let aValue, bValue;

    switch (sortBy) {
      case 'name':
        aValue = a.name || '';
        bValue = b.name || '';
        break;
      case 'email':
        aValue = a.email || '';
        bValue = b.email || '';
        break;
      case 'role':
        aValue = a.role || '';
        bValue = b.role || '';
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

  const paginatedAccounts = sortedAccounts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const getStatusColor = (status) => {
    const colors = {
      active: 'success',
      inactive: 'default',
      blocked: 'error',
      pending_verification: 'warning',
      rejected: 'default',
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status) => {
    const labels = {
      active: 'Active',
      inactive: 'Inactive',
      blocked: 'Blocked',
      pending_verification: 'Pending Verification',
      rejected: 'Rejected',
    };
    return labels[status] || status;
  };

  const handleViewDetails = async (account) => {
    try {
      // Fetch full account details
      const fullAccount = await apiFetch(`/admin/accounts/${account.id}`);
      setSelectedAccount(fullAccount);
      setDetailsDialogOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to fetch account details');
      // Fallback to showing basic account info
      setSelectedAccount(account);
      setDetailsDialogOpen(true);
    }
  };

  const handleBlockClick = (account) => {
    setSelectedAccount(account);
    setBlockReason('');
    setBlockReasonError('');
    setBlockDialogOpen(true);
  };

  const handleUnblockClick = async (account) => {
    try {
      await apiFetch(`/admin/accounts/${account.id}/unblock`, {
        method: 'POST',
      });
      setSuccess(`Account for ${account.name || account.email} has been unblocked.`);
      await fetchAccounts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to unblock account');
    }
  };

  const handleBlockConfirm = async () => {
    if (!blockReason.trim()) {
      setBlockReasonError('Reason is required');
      return;
    }

    if (blockReason.length > 1000) {
      setBlockReasonError('Reason must be less than 1000 characters');
      return;
    }

    try {
      await apiFetch(`/admin/accounts/${selectedAccount.id}/block`, {
        method: 'POST',
        body: JSON.stringify({ reason: blockReason.trim() }),
      });
      setSuccess(`Account for ${selectedAccount.name || selectedAccount.email} has been blocked.`);
      setBlockDialogOpen(false);
      setBlockReason('');
      setBlockReasonError('');
      await fetchAccounts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to block account');
    }
  };

  const handleTabChange = (event, newValue) => {
    setAccountType(newValue);
    setPage(0);
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        Account Management
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
            <Tabs
              value={accountType}
              onChange={handleTabChange}
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
              <Tab label="Couple Accounts" value="couple" />
              <Tab label="Vendor Accounts" value="vendor" />
            </Tabs>
          </Paper>
          <TextField
            fullWidth
            placeholder={`Search ${accountType === 'couple' ? 'couple' : 'vendor'} accounts by name or email...`}
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
                    active={sortBy === 'name'}
                    direction={sortBy === 'name' ? sortOrder : 'asc'}
                    onClick={() => handleSort('name')}
                  >
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'email'}
                    direction={sortBy === 'email' ? sortOrder : 'asc'}
                    onClick={() => handleSort('email')}
                  >
                    Email
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'role'}
                    direction={sortBy === 'role' ? sortOrder : 'asc'}
                    onClick={() => handleSort('role')}
                  >
                    Role
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
              ) : paginatedAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No accounts found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAccounts.map((account) => (
                  <TableRow key={account.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {account.name || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{account.email || 'N/A'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={account.role === 'couple' ? 'Couple' : 'Vendor'}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(account.status)}
                        size="small"
                        color={getStatusColor(account.status)}
                      />
                      {account.status === 'blocked' && account.blockReason && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                          Reason: {account.blockReason}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(account)}
                          color="primary"
                          title="View Details"
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        {account.status === 'blocked' ? (
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleUnblockClick(account)}
                            title="Unblock Account"
                          >
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        ) : (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleBlockClick(account)}
                            title="Block Account"
                          >
                            <BlockIcon fontSize="small" />
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
            count={sortedAccounts.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </TableContainer>
      </Card>

      {/* Account Details Dialog */}
      <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="div">
            Account Details
          </Typography>
          <IconButton
            aria-label="close"
            onClick={() => setDetailsDialogOpen(false)}
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
          {selectedAccount && (
            <Box sx={{ pt: 2 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Basic Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Name:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {selectedAccount.name || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Email:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {selectedAccount.email || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Role:</Typography>
                    <Chip
                      label={selectedAccount.role === 'couple' ? 'Couple' : 'Vendor'}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Status:</Typography>
                    <Chip
                      label={getStatusLabel(selectedAccount.status)}
                      size="small"
                      color={getStatusColor(selectedAccount.status)}
                    />
                  </Box>
                  {selectedAccount.contactNumber && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Contact:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {selectedAccount.contactNumber}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Created:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {new Date(selectedAccount.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {selectedAccount.role === 'vendor' && selectedAccount.vendor && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Vendor Information
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Category:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {selectedAccount.vendor.category || 'N/A'}
                        </Typography>
                      </Box>
                      {selectedAccount.vendor.location && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Location:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {selectedAccount.vendor.location}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </>
              )}

              {selectedAccount.status === 'blocked' && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" color="error" gutterBottom>
                      Block Information
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {selectedAccount.blockReason && (
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Reason:
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {selectedAccount.blockReason}
                          </Typography>
                        </Box>
                      )}
                      {selectedAccount.blockedAt && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Blocked At:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {new Date(selectedAccount.blockedAt).toLocaleString()}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Block Account Dialog */}
      <Dialog open={blockDialogOpen} onClose={() => setBlockDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="div">
            Block Account
          </Typography>
          <IconButton
            aria-label="close"
            onClick={() => setBlockDialogOpen(false)}
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
          {selectedAccount && (
            <Box sx={{ pt: 2 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                You are about to block the account for <strong>{selectedAccount.name || selectedAccount.email}</strong>.
                They will not be able to log in until the account is unblocked.
              </Alert>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Reason for Blocking"
                placeholder="Please provide a reason for blocking this account. This reason will be sent to the user via email."
                value={blockReason}
                onChange={(e) => {
                  setBlockReason(e.target.value);
                  setBlockReasonError('');
                }}
                error={!!blockReasonError}
                helperText={blockReasonError || `${blockReason.length}/1000 characters`}
                required
                sx={{ mt: 1 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBlockDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleBlockConfirm}
            disabled={!blockReason.trim()}
          >
            Block Account
          </Button>
        </DialogActions>
      </Dialog>

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

