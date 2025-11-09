import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickersDay } from '@mui/x-date-pickers/PickersDay';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { apiFetch } from '../../lib/api';
import './AvailabilityManagement.css';

// Custom Day component to show unavailable dates
const CustomDay = (props) => {
  const { day, unavailableDates, bookedDates, onDateClick, ...other } = props;
  // Handle dayjs date object
  const dateObj = day.toDate ? day.toDate() : day;
  const dateStr = dateObj.toISOString().split('T')[0];
  
  // Check if date is booked first (booked takes priority)
  const isBooked = bookedDates.has(dateStr);
  // Only show as unavailable if it's in unavailableDates AND not booked
  const isUnavailable = !isBooked && unavailableDates.has(dateStr);

  return (
    <PickersDay
      {...other}
      day={day}
      className={`${isUnavailable ? 'unavailable' : ''} ${isBooked ? 'booked' : ''}`}
      onClick={() => {
        if (onDateClick) {
          onDateClick(day);
        }
        // Also call the default onClick if it exists
        if (other.onClick) {
          other.onClick();
        }
      }}
      sx={{
        ...(isBooked && {
          backgroundColor: '#ffebee',
          '&:hover': {
            backgroundColor: '#ffcdd2',
          },
        }),
        ...(isUnavailable && !isBooked && {
          backgroundColor: '#fff3e0',
          '&:hover': {
            backgroundColor: '#ffe0b2',
          },
        }),
        cursor: isBooked ? 'not-allowed' : 'pointer',
        opacity: isBooked ? 0.7 : 1,
      }}
    />
  );
};

const AvailabilityManagement = () => {
  const [timeSlots, setTimeSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [unavailableDates, setUnavailableDates] = useState(new Set());
  const [bookedDates, setBookedDates] = useState(new Set());
  const [pendingChanges, setPendingChanges] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTimeSlots();
    fetchBookings();
  }, []);

  useEffect(() => {
    // Update unavailable dates set when timeSlots change
    const dates = new Set();
    timeSlots.forEach((slot) => {
      const dateStr = new Date(slot.date).toISOString().split('T')[0];
      dates.add(dateStr);
    });
    setUnavailableDates(dates);
  }, [timeSlots]);

  useEffect(() => {
    // Extract booked dates from bookings
    const booked = new Set();
    bookings.forEach((booking) => {
      // Only consider confirmed bookings or bookings that are not cancelled/rejected
      if (
        booking.status !== 'cancelled' &&
        booking.status !== 'rejected' &&
        booking.reservedDate
      ) {
        const dateStr = new Date(booking.reservedDate).toISOString().split('T')[0];
        booked.add(dateStr);
      }
    });
    setBookedDates(booked);

    // Automatically mark booked dates as unavailable (only add to unavailableDates if not already there)
    const newUnavailable = new Set(unavailableDates);
    let hasChanges = false;

    booked.forEach((dateStr) => {
      if (!unavailableDates.has(dateStr)) {
        const existingSlot = timeSlots.find(
          (slot) => new Date(slot.date).toISOString().split('T')[0] === dateStr
        );
        if (!existingSlot) {
          // Add to pending changes to mark as booked
          setPendingChanges((prev) => {
            const newSet = new Set(prev);
            newSet.add(`booked-${dateStr}`);
            return newSet;
          });
          newUnavailable.add(dateStr);
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      setUnavailableDates(newUnavailable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  const fetchTimeSlots = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get a wide range to show all unavailable dates
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

  const fetchBookings = async () => {
    try {
      const data = await apiFetch('/bookings');
      setBookings(data);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    }
  };

  const handleDateClick = (date) => {
    if (!date) return;

    // Handle dayjs date object
    const dateObj = date.toDate ? date.toDate() : date;
    const dateStr = dateObj.toISOString().split('T')[0];

    // Don't allow toggling booked dates
    if (bookedDates.has(dateStr)) {
      return;
    }

    const newPendingChanges = new Set(pendingChanges);
    const newUnavailable = new Set(unavailableDates);

    // Toggle availability: if unavailable, make available; if available, make unavailable
    if (unavailableDates.has(dateStr)) {
      // Make available (remove from unavailable)
      const existingSlot = timeSlots.find(
        (slot) => new Date(slot.date).toISOString().split('T')[0] === dateStr
      );
      if (existingSlot) {
        // Mark for removal
        newPendingChanges.add(`remove-${existingSlot.id}`);
        // Remove any pending add for this date
        newPendingChanges.delete(dateStr);
      } else {
        // It was a pending add, just remove it from pending
        newPendingChanges.delete(dateStr);
        // Also remove any remove- entries for this date (in case it was toggled multiple times)
        Array.from(newPendingChanges).forEach((change) => {
          if (change.startsWith('remove-')) {
            const slotId = change.replace('remove-', '');
            const slot = timeSlots.find((s) => s.id === slotId);
            if (slot && new Date(slot.date).toISOString().split('T')[0] === dateStr) {
              newPendingChanges.delete(change);
            }
          }
        });
      }
      newUnavailable.delete(dateStr);
    } else {
      // Make unavailable (add to unavailable)
      // First, remove any pending removal for this date
      Array.from(newPendingChanges).forEach((change) => {
        if (change.startsWith('remove-')) {
          const slotId = change.replace('remove-', '');
          const slot = timeSlots.find((s) => s.id === slotId);
          if (slot && new Date(slot.date).toISOString().split('T')[0] === dateStr) {
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
        } else if (change.startsWith('booked-')) {
          // Extract date from booked change
          const dateStr = change.replace('booked-', '');
          datesToAdd.push({ date: dateStr, status: 'booked' });
        } else {
          // It's a date string to add
          datesToAdd.push({ date: change, status: 'personal_time_off' });
        }
      });

      // Also check for dates that were removed from unavailableDates
      const currentDateSet = new Set();
      timeSlots.forEach((slot) => {
        const dateStr = new Date(slot.date).toISOString().split('T')[0];
        currentDateSet.add(dateStr);
      });

      // Find dates that need to be removed (in currentDateSet but not in unavailableDates)
      currentDateSet.forEach((dateStr) => {
        if (!unavailableDates.has(dateStr)) {
          const slot = timeSlots.find(
            (s) => new Date(s.date).toISOString().split('T')[0] === dateStr
          );
          if (slot && !datesToRemove.includes(slot.id)) {
            datesToRemove.push(slot.id);
          }
        }
      });

      // Find dates that need to be added (in unavailableDates but not in currentDateSet)
      unavailableDates.forEach((dateStr) => {
        if (!currentDateSet.has(dateStr) && !datesToAdd.find((d) => d.date === dateStr)) {
          // Check if it's a booked date
          const isBooked = bookedDates.has(dateStr);
          datesToAdd.push({
            date: dateStr,
            status: isBooked ? 'booked' : 'personal_time_off',
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
        await apiFetch('/time-slots', {
          method: 'POST',
          body: JSON.stringify({
            date: dateData.date,
            status: dateData.status,
          }),
        });
      }

      setSuccess('Availability updated successfully');
      setPendingChanges(new Set());
      await fetchTimeSlots();
      await fetchBookings();
    } catch (err) {
      setError(err.message || 'Failed to save availability changes');
    } finally {
      setSaving(false);
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
              Manage Availability
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Select dates on the calendar to mark them as unavailable. All other dates are
              considered available by default.
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

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
                sx={{
                  '& .MuiPickersDay-root.unavailable:not(.booked)': {
                    backgroundColor: '#fff3e0 !important',
                    color: '#000',
                    '&:hover': {
                      backgroundColor: '#ffe0b2 !important',
                    },
                  },
                  '& .MuiPickersDay-root.booked': {
                    backgroundColor: '#ffebee !important',
                    color: '#000',
                    '&:hover': {
                      backgroundColor: '#ffcdd2 !important',
                    },
                  },
                }}
                slots={{
                  day: CustomDay,
                }}
                slotProps={{
                  day: {
                    unavailableDates,
                    bookedDates,
                    onDateClick: handleDateClick,
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
                  backgroundColor: '#ffebee',
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                }}
              />
              <Typography variant="caption">Booked (Auto Unavailable)</Typography>
            </Box>
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
              <Typography variant="caption">Day Off</Typography>
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
      </Box>
    </LocalizationProvider>
  );
};

export default AvailabilityManagement;
