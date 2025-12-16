import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
} from '@mui/material';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickersDay } from '@mui/x-date-pickers/PickersDay';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { apiFetch } from '../../lib/api';
import './AvailabilityManagement.css';

const pad2 = (n) => String(n).padStart(2, '0');

const toDateKey = (value) => {
  if (!value) return '';
  if (typeof value.format === 'function') {
    return value.format('YYYY-MM-DD');
  }
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};

// Custom Day component to show unavailable dates (vendor time off only)
const CustomDay = (props) => {
  const { day, unavailableDates, onDateClick, minSelectableDate, ...other } = props;
  // Handle dayjs date object
  const dayjsDate = dayjs(day);
  const dateStr = toDateKey(day);

  // Check date status
  const isUnavailable = unavailableDates.has(dateStr);
  const isBeforeMinDate = dayjsDate.startOf('day').isBefore(minSelectableDate);
  const isDisabled = other.disabled || isBeforeMinDate;

  return (
    <PickersDay
      {...other}
      day={day}
      disabled={isDisabled}
      className={`${isUnavailable ? 'unavailable' : ''} ${
        isBeforeMinDate ? 'disabled-day' : ''
      }`}
      onClick={() => {
        if (!isDisabled && onDateClick) {
          onDateClick(day);
        }
        if (other.onClick) {
          other.onClick();
        }
      }}
      sx={{
        ...(isUnavailable && {
          backgroundColor: '#fff3e0',
          '&:hover': {
            backgroundColor: '#ffe0b2',
          },
        }),
        ...(isBeforeMinDate && {
          opacity: 0.35,
        }),
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      }}
    />
  );
};

const AvailabilityManagement = () => {
  const minSelectableDate = dayjs().startOf('day').add(1, 'day');
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentDate, setCurrentDate] = useState(minSelectableDate);
  const [unavailableDates, setUnavailableDates] = useState(new Set());
  const [pendingChanges, setPendingChanges] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictInfo, setConflictInfo] = useState(null); // { date, count, bookings: [...] }
  const [bulkCancelReason, setBulkCancelReason] = useState('');
  const [bulkCancelling, setBulkCancelling] = useState(false);

  useEffect(() => {
    fetchTimeSlots();
  }, []);

  useEffect(() => {
    const dates = new Set();
    timeSlots.forEach((slot) => {
      if (slot.status === 'personal_time_off') {
        const dateStr = toDateKey(slot.date);
        dates.add(dateStr);
      }
    });
    setUnavailableDates(dates);
  }, [timeSlots]);

  const fetchTimeSlots = async () => {
    try {
      setLoading(true);
      setError(null);

      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);

      const slots = await apiFetch(
        `/time-slots/range?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      setTimeSlots(slots);
    } catch (err) {
      setError(err.message || 'Failed to fetch availability');
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (date) => {
    if (!date) return;

    const dateStr = toDateKey(date);
    const dateDayjs = dayjs(date).startOf('day');

    // Don't allow toggling past/today dates
    if (dateDayjs.isBefore(minSelectableDate)) {
      return;
    }

    const newPendingChanges = new Set(pendingChanges);
    const newUnavailable = new Set(unavailableDates);

    if (unavailableDates.has(dateStr)) {
      const existingSlot = timeSlots.find(
        (slot) => toDateKey(slot.date) === dateStr
      );
      if (existingSlot) {
        newPendingChanges.add(`remove-${existingSlot.id}`);
        newPendingChanges.delete(dateStr);
      } else {
        newPendingChanges.delete(dateStr);
        Array.from(newPendingChanges).forEach((change) => {
          if (change.startsWith('remove-')) {
            const slotId = change.replace('remove-', '');
            const slot = timeSlots.find((s) => s.id === slotId);
            if (slot && toDateKey(slot.date) === dateStr) {
              newPendingChanges.delete(change);
            }
          }
        });
      }
      newUnavailable.delete(dateStr);
    } else {
      Array.from(newPendingChanges).forEach((change) => {
        if (change.startsWith('remove-')) {
          const slotId = change.replace('remove-', '');
          const slot = timeSlots.find((s) => s.id === slotId);
          if (slot && toDateKey(slot.date) === dateStr) {
            newPendingChanges.delete(change);
          }
        }
      });
      newPendingChanges.add(dateStr);
      newUnavailable.add(dateStr);
    }

    setPendingChanges(newPendingChanges);
    setUnavailableDates(newUnavailable);
  };

  const handleSaveChanges = async () => {
    if (pendingChanges.size === 0) {
      setSuccess('No changes to save');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const datesToRemove = [];
      const datesToAdd = [];

      // Process pending changes
      pendingChanges.forEach((change) => {
        if (change.startsWith('remove-')) {
          // Extract slot ID
          const slotId = change.replace('remove-', '');
          datesToRemove.push(slotId);
        } else {
          // It's a date string to add (always personal_time_off for vendor time off)
          datesToAdd.push({ date: change, status: 'personal_time_off' });
        }
      });

      // Also check for dates that were removed from unavailableDates
      const currentDateSet = new Set();
      timeSlots.forEach((slot) => {
        const dateStr = toDateKey(slot.date);
        currentDateSet.add(dateStr);
      });

      // Find dates that need to be removed (in currentDateSet but not in unavailableDates)
      currentDateSet.forEach((dateStr) => {
        if (!unavailableDates.has(dateStr)) {
          const slot = timeSlots.find(
            (s) => toDateKey(s.date) === dateStr
          );
          if (slot && !datesToRemove.includes(slot.id)) {
            datesToRemove.push(slot.id);
          }
        }
      });

      // Find dates that need to be added (in unavailableDates but not in currentDateSet)
      unavailableDates.forEach((dateStr) => {
        if (!currentDateSet.has(dateStr) && !datesToAdd.find((d) => d.date === dateStr)) {
          // Always add as personal_time_off (vendor time off)
          datesToAdd.push({
            date: dateStr,
            status: 'personal_time_off',
          });
        }
      });

      // Remove dates
      for (const slotId of datesToRemove) {
        await apiFetch(`/time-slots/${slotId}`, {
          method: 'DELETE',
        });
      }

      // Add dates
      for (const dateData of datesToAdd) {
        try {
          await apiFetch('/time-slots', {
            method: 'POST',
            body: JSON.stringify({
              date: dateData.date,
              status: dateData.status,
            }),
          });
        } catch (err) {
          const conflicts = err?.data?.conflicts;
          if (conflicts?.bookings?.length) {
            setConflictInfo(conflicts);
            setBulkCancelReason('');
            setConflictDialogOpen(true);
            setError('Existing bookings found for that date. Please review and cancel them before marking unavailable.');
            return;
          }
          throw err;
        }
      }

      setSuccess('Availability updated successfully');
      setPendingChanges(new Set());
      await fetchTimeSlots();
    } catch (err) {
      setError(err.message || 'Failed to save availability changes');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkCancelAndRetry = async () => {
    if (!conflictInfo?.bookings?.length) {
      setConflictDialogOpen(false);
      return;
    }
    if (!bulkCancelReason || bulkCancelReason.trim().length < 3) {
      setError('Please provide a cancellation reason (at least 3 characters).');
      return;
    }
    try {
      setBulkCancelling(true);
      setError(null);

      for (const booking of conflictInfo.bookings) {
        await apiFetch(`/bookings/${booking.id}/cancel`, {
          method: 'POST',
          body: JSON.stringify({ reason: bulkCancelReason.trim() }),
        });
      }

      await apiFetch('/time-slots', {
        method: 'POST',
        body: JSON.stringify({
          date: conflictInfo.date,
          status: 'personal_time_off',
        }),
      });

      setConflictDialogOpen(false);
      setConflictInfo(null);
      setBulkCancelReason('');
      setSuccess('Bookings cancelled and availability updated successfully');
      setPendingChanges(new Set());
      await fetchTimeSlots();
    } catch (err) {
      setError(err.message || 'Failed to cancel bookings / update availability');
    } finally {
      setBulkCancelling(false);
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
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box className="availability-management">
        <Box className="availability-header">
          <Box>
            <Typography variant="h4" component="h1" className="availability-title">
              Manage Vendor Time Off
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Mark dates when you are unavailable for all services (e.g., vacation, maintenance).
              This affects all your service listings. For individual service availability, manage
              them from your listings page.
            </Typography>
          </Box>
        </Box>


        <Paper elevation={2} sx={{ p: 3, mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant="h6" component="h2">
              My Calendar
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Click a date to toggle its availability. Click again to revert.
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Paper
              elevation={0}
              sx={{
                border: '1px solid #e0e0e0',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <DateCalendar
                value={currentDate}
                onChange={(newDate) => {
                  if (newDate) {
                    setCurrentDate(newDate);
                  }
                }}
                shouldDisableDate={(date) => date.startOf('day').isBefore(minSelectableDate)}
                disableHighlightToday
                sx={{
                  '& .MuiPickersDay-root': {
                    transition: 'all 0.15s ease-in-out',
                  },
                  '& .MuiPickersDay-root.Mui-selected': {
                    backgroundColor: 'transparent !important',
                    border: '2px solid #E16789',
                    color: '#E16789',
                    fontWeight: 600,
                    boxShadow: 'none',
                    '&:hover': {
                      backgroundColor: '#fde4eb !important',
                    },
                  },
                  '& .MuiPickersDay-root.Mui-selected.unavailable': {
                    backgroundColor: '#fff3e0 !important',
                    color: '#000',
                  },
                  '& .MuiPickersDay-root.unavailable': {
                    backgroundColor: '#fff3e0 !important',
                    color: '#000',
                    '&:hover': {
                      backgroundColor: '#ffe0b2 !important',
                    },
                  },
                  '& .MuiPickersDay-root.disabled-day': {
                    color: '#b0b0b0',
                  },
                }}
                slots={{
                  day: CustomDay,
                }}
                slotProps={{
                  day: {
                    unavailableDates,
                    onDateClick: handleDateClick,
                    minSelectableDate,
                  },
                }}
              />
            </Paper>
          </Box>

          {/* Availability Legend */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight="medium">
              Legend:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  backgroundColor: '#fff3e0',
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                }}
              />
              <Typography variant="caption">Time Off</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                }}
              />
              <Typography variant="caption">Available</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              Dates up to and including today are locked.
            </Typography>
          </Box>

          {/* Save Changes Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveChanges}
              disabled={saving || pendingChanges.size === 0}
              startIcon={saving ? <CircularProgress size={16} /> : null}
              sx={{
                backgroundColor: '#E16789',
                '&:hover': {
                  backgroundColor: '#d4567a',
                },
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Paper>


        {/* Success Snackbar */}
        <Snackbar
          open={!!success}
          autoHideDuration={6000}
          onClose={() => setSuccess(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={() => setSuccess(null)} severity="success" sx={{ width: '100%' }}>
            <Typography variant="subtitle2" fontWeight="bold">
              Availability Updated
            </Typography>
            <Typography variant="body2">
              Your availability calendar has been successfully saved.
            </Typography>
          </Alert>
        </Snackbar>

        {/* Error Snackbar */}
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
            <Typography variant="subtitle2" fontWeight="bold">
              Action required
            </Typography>
            <Typography variant="body2">{error}</Typography>
          </Alert>
        </Snackbar>

        <Dialog
          open={conflictDialogOpen}
          onClose={() => !bulkCancelling && setConflictDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Existing bookings on this date</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                You cannot mark <strong>{conflictInfo?.date}</strong> as unavailable because you have{' '}
                <strong>{conflictInfo?.count || 0}</strong> booking(s) on that date.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                You can cancel them now with one reason (refunds will be recorded automatically if payments were made).
              </Typography>

              <TextField
                label="Cancellation reason (applies to all)"
                value={bulkCancelReason}
                onChange={(e) => setBulkCancelReason(e.target.value)}
                fullWidth
                minRows={2}
                multiline
                disabled={bulkCancelling}
              />

              <Box
                sx={{
                  maxHeight: 220,
                  overflowY: 'auto',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1,
                }}
              >
                {(conflictInfo?.bookings || []).map((b) => (
                  <Box key={b.id} sx={{ py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Booking #{b.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Status: {b.status}
                      {b.projectName ? ` • Project: ${b.projectName}` : ''}
                      {b.coupleName ? ` • Couple: ${b.coupleName}` : ''}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConflictDialogOpen(false)} disabled={bulkCancelling} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleBulkCancelAndRetry}
              disabled={bulkCancelling}
              sx={{ textTransform: 'none' }}
            >
              {bulkCancelling ? 'Cancelling...' : 'Cancel bookings & mark unavailable'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default AvailabilityManagement;
