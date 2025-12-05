import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Tabs, Tab, TextField, InputAdornment, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Button, Stack, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Divider, List, ListItem, ListItemText, TableSortLabel, Snackbar, Alert, TablePagination } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { apiFetch } from '../../lib/api';

const STATUS_TABS = [
  { key: 'pending_verification', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'rejected', label: 'Rejected' },
];

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

export default function Vendors() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('pending_verification');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingUserId, setRejectingUserId] = useState(null);
  const [toastNotification, setToastNotification] = useState({ open: false, message: '', severity: 'success' });
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Set browser tab title
  useEffect(() => {
    document.title = 'Weddding Admin — Vendor Verification';
  }, []);

  // Fixed column widths for consistent spacing across tabs
  const COLS = {
    name: 220,
    email: 260,
    category: 160,
    location: 220,
    createdAt: 200,
    status: 140,
    actions: 200,
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  useEffect(() => {
    // ensure admin session
    apiFetch('/admin/auth/me')
      .then(() => {})
      .catch(() => navigate('/admin/login'));
  }, [navigate]);

  useEffect(() => {
    setLoading(true);
    setError('');
    setPage(0); // Reset to first page when tab changes
    apiFetch(`/admin/vendors?status=${encodeURIComponent(tab)}&page=1&limit=${rowsPerPage}`)
      .then((response) => {
        if (response.data) {
          setRows(response.data || []);
        } else {
          // Backward compatibility: if response is array, treat as old format
          setRows(response || []);
        }
      })
      .catch((e) => setError(e.message || 'Failed to load vendors'))
      .finally(() => setLoading(false));
  }, [tab, rowsPerPage]);

  useEffect(() => {
    if (page > 0) {
      setLoading(true);
      setError('');
      apiFetch(`/admin/vendors?status=${encodeURIComponent(tab)}&page=${page + 1}&limit=${rowsPerPage}`)
        .then((response) => {
          if (response.data) {
            setRows(response.data || []);
          } else {
            setRows(response || []);
          }
        })
      .catch((e) => setError(e.message || 'Failed to load vendors'))
      .finally(() => setLoading(false));
    }
  }, [page, tab, rowsPerPage]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQ = !q || [r.name, r.email, r.vendor?.location].some((v) => (v || '').toLowerCase().includes(q));
      const matchesCat = !category || r.vendor?.category === category;
      return matchesQ && matchesCat;
    });
  }, [rows, query, category]);

  const filtered = useMemo(() => {

    const compare = (a, b) => {
      const getValue = (row) => {
        switch (sortField) {
          case 'email':
            return row.email || '';
          case 'category':
            return row.vendor?.category || '';
          case 'location':
            return row.vendor?.location || '';
          case 'createdAt':
            return row.createdAt || '';
          case 'name':
          default:
            return row.name || '';
        }
      };

      if (sortField === 'createdAt') {
        const aTime = new Date(getValue(a)).getTime();
        const bTime = new Date(getValue(b)).getTime();
        return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
      }

      const aVal = String(getValue(a)).toLowerCase();
      const bVal = String(getValue(b)).toLowerCase();
      if (aVal === bVal) return 0;
      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    };

    return [...filteredRows].sort(compare);
  }, [filteredRows, sortField, sortDirection]);

  const paginatedRows = useMemo(() => {
    return filtered.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [filtered, page, rowsPerPage]);

  const onApprove = async (userId) => {
    try {
      await apiFetch(`/admin/vendors/${userId}/approve`, { method: 'POST' });
      const vendor = rows.find((r) => r.id === userId);
      setRows((prev) => prev.filter((r) => r.id !== userId));
      setToastNotification({
        open: true,
        message: `Vendor account "${vendor?.name || vendor?.email}" has been approved successfully.`,
        severity: 'success',
      });
    } catch (e) {
      setToastNotification({
        open: true,
        message: e.message || 'Failed to approve vendor account',
        severity: 'error',
      });
    }
  };

  const handleRejectClick = (userId) => {
    setRejectingUserId(userId);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectCancel = () => {
    setRejectDialogOpen(false);
    setRejectReason('');
    setRejectingUserId(null);
  };

  const onReject = async () => {
    if (!rejectingUserId) return;
    
    try {
      const reason = rejectReason.trim() || undefined;
      const vendor = rows.find((r) => r.id === rejectingUserId);
      await apiFetch(`/admin/vendors/${rejectingUserId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
      setRows((prev) => prev.filter((r) => r.id !== rejectingUserId));
      handleRejectCancel();
      setToastNotification({
        open: true,
        message: `Vendor account "${vendor?.name || vendor?.email}" has been rejected.`,
        severity: 'success',
      });
    } catch (e) {
      setToastNotification({
        open: true,
        message: e.message || 'Failed to reject vendor account',
        severity: 'error',
      });
    }
  };

  const onView = (userId) => {
    const vendor = rows.find((r) => r.id === userId);
    if (vendor) {
      setSelected(vendor);
      setDialogOpen(true);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelected(null);
  };

  const getDocDisplayName = (url) => {
    if (!url) return '-';
    try {
      const filename = decodeURIComponent(url.split('/').pop() || '');
      const parts = filename.split('-');
      if (parts.length <= 2) return filename;
      return parts.slice(2).join('-');
    } catch (err) {
      return url;
    }
  };

  const handleOpenDocument = (docUrl) => {
    if (!docUrl) return;
    const fullUrl = docUrl.startsWith('http') ? docUrl : `${API_BASE_URL}${docUrl}`;
    window.open(fullUrl, '_blank', 'noopener');
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Vendor Verification</Typography>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        {STATUS_TABS.map((t) => (
          <Tab key={t.key} value={t.key} label={t.label} />
        ))}
      </Tabs>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Box sx={{ flex: 1, display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
              <TextField
                sx={{ width: { xs: '100%', sm: 320, md: 360 } }}
                placeholder="Search by name, email, or location"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
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
              select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">All</MenuItem>
              {['Photographer','Videographer','Venue','Caterer','Florist','DJ_Music','Other'].map((c) => (
                <MenuItem key={c} value={c}>{c.replace('_','/')}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
      )}

      <TableContainer component={Paper}>
        <Table sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={{ width: COLS.name }}>
                <TableSortLabel
                  active={sortField === 'name'}
                  direction={sortField === 'name' ? sortDirection : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  <Box component="span" sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>Business Name</Box>
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" sx={{ width: COLS.email }}>
                <TableSortLabel
                  active={sortField === 'email'}
                  direction={sortField === 'email' ? sortDirection : 'asc'}
                  onClick={() => handleSort('email')}
                >
                  <Box component="span" sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>Email</Box>
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" sx={{ width: COLS.category }}>
                <TableSortLabel
                  active={sortField === 'category'}
                  direction={sortField === 'category' ? sortDirection : 'asc'}
                  onClick={() => handleSort('category')}
                >
                  <Box component="span" sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>Category</Box>
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" sx={{ width: COLS.location }}>
                <TableSortLabel
                  active={sortField === 'location'}
                  direction={sortField === 'location' ? sortDirection : 'asc'}
                  onClick={() => handleSort('location')}
                >
                  <Box component="span" sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>Location</Box>
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" sx={{ width: COLS.createdAt }}>
                <TableSortLabel
                  active={sortField === 'createdAt'}
                  direction={sortField === 'createdAt' ? sortDirection : 'asc'}
                  onClick={() => handleSort('createdAt')}
                >
                  <Box component="span" sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>Requested On</Box>
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" sx={{ width: COLS.status }}>Status</TableCell>
              <TableCell align="center" sx={{ width: COLS.actions }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">Loading…</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">No vendors</TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ width: COLS.name }}>
                    <Typography noWrap title={row.name || '-'}>{row.name || '-'}</Typography>
                  </TableCell>
                  <TableCell sx={{ width: COLS.email }}>
                    <Typography noWrap title={row.email}>{row.email}</Typography>
                  </TableCell>
                  <TableCell sx={{ width: COLS.category }}>
                    <Typography noWrap title={row.vendor?.category?.replace('_','/') || '-'}>
                      {row.vendor?.category?.replace('_','/') || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ width: COLS.location }}>
                    <Typography noWrap title={row.vendor?.location || '-'}>
                      {row.vendor?.location || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ width: COLS.createdAt }}>
                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell align="center" sx={{ width: COLS.status }}>
                    <Chip size="small" label={row.status.replace('_',' ')} color={row.status==='active'?'success':row.status==='rejected'?'default':'warning'} />
                  </TableCell>
                  <TableCell align="center" sx={{ width: COLS.actions }}>
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <IconButton onClick={() => onView(row.id)} title="View"><VisibilityIcon /></IconButton>
                      {tab === 'pending_verification' && (
                        <>
                          <IconButton color="success" onClick={() => onApprove(row.id)} title="Approve"><CheckIcon /></IconButton>
                          <IconButton color="error" onClick={() => handleRejectClick(row.id)} title="Reject"><CloseIcon /></IconButton>
                        </>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={filtered.length}
        page={page}
        onPageChange={(event, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(parseInt(event.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 20, 50, 100]}
      />

      <Dialog open={dialogOpen && !!selected} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Vendor Details</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{selected.name || 'Untitled Business'}</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>{selected.email}</Typography>
                  <Typography variant="caption" color="text.secondary">Category</Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>{selected.vendor?.category?.replace('_','/') || '-'}</Typography>
                  <Typography variant="caption" color="text.secondary">Location</Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>{selected.vendor?.location || '-'}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Description</Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>{selected.vendor?.description || 'No description provided.'}</Typography>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Typography variant="body1" sx={{ mb: 1, textTransform: 'capitalize' }}>{selected.status.replace('_',' ')}</Typography>
                  <Typography variant="caption" color="text.secondary">Requested On</Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '—'}</Typography>
                </Box>
              </Stack>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Verification Documents</Typography>
              {selected.vendor?.verificationDocuments?.length ? (
                <List dense>
                  {selected.vendor.verificationDocuments.map((doc, idx) => (
                    <ListItem key={idx} secondaryAction={
                      <Button size="small" onClick={() => handleOpenDocument(doc)}>
                        View
                      </Button>
                    }>
                      <ListItemText primary={getDocDisplayName(doc)} secondary={doc.startsWith('http') ? doc : `${API_BASE_URL}${doc}`} />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">No documents uploaded.</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {selected && tab === 'pending_verification' ? (
            <Stack direction="row" spacing={1} sx={{ mr: 1 }}>
              <Button variant="outlined" color="error" onClick={() => { closeDialog(); handleRejectClick(selected.id); }}>Reject</Button>
              <Button variant="contained" color="success" onClick={() => { closeDialog(); onApprove(selected.id); }}>Approve</Button>
            </Stack>
          ) : null}
          <Button onClick={closeDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Rejection Reason Dialog */}
      <Dialog open={rejectDialogOpen} onClose={handleRejectCancel} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#b91c1c' }}>
          Reject Vendor Account
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2, color: '#4b5563' }}>
            Please provide an optional reason for rejecting this vendor account. This reason will be included in the email notification sent to the vendor.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={4}
            label="Reason for rejection (optional)"
            placeholder="e.g., Missing required documentation, incomplete business information..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            inputProps={{ maxLength: 500 }}
            helperText={`${rejectReason.length}/500 characters`}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleRejectCancel} variant="outlined">
            Cancel
          </Button>
          <Button onClick={onReject} variant="contained" color="error" sx={{ ml: 1 }}>
            Confirm Rejection
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Notification */}
      <Snackbar
        open={toastNotification.open}
        autoHideDuration={6000}
        onClose={() => setToastNotification({ ...toastNotification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToastNotification({ ...toastNotification, open: false })}
          severity={toastNotification.severity}
          sx={{ width: '100%' }}
        >
          {toastNotification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}


