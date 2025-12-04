import React, { useState } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { Paper } from '@mui/material';
import dayjs from 'dayjs';
import './CreateProject.styles.css';

const Step1DateSelection = ({ formData, updateFormData, error, setError }) => {
  const [dateError, setDateError] = useState('');
  const [startTimeError, setStartTimeError] = useState('');
  const [endTimeError, setEndTimeError] = useState('');

  const minDate = dayjs().add(1, 'day'); // Can't select today or past dates

  const handleDateChange = (newDate) => {
    if (!newDate) {
      updateFormData('weddingDate', null);
      setDateError('');
      return;
    }

    const dateStr = newDate.format('YYYY-MM-DD');
    updateFormData('weddingDate', dateStr);
    setDateError('');
    setError(null);
  };

  const handleStartTimeChange = (newTime) => {
    if (!newTime) {
      updateFormData('eventStartTime', '');
      setStartTimeError('');
      return;
    }

    const timeStr = newTime.format('HH:mm');
    const hour = newTime.hour();
    const minute = newTime.minute();
    
    // Validate business hours (8 AM - 11 PM)
    if (hour < 8 || (hour === 23 && minute > 0) || hour >= 23) {
      setStartTimeError('Start time must be between 8:00 AM and 11:00 PM');
      updateFormData('eventStartTime', timeStr);
      return;
    }
    
    // Validate end time is after start time if end time is already set
    if (formData.eventEndTime) {
      const endHour = parseInt(formData.eventEndTime.split(':')[0]);
      const endMinute = parseInt(formData.eventEndTime.split(':')[1]);
      const startMinutes = hour * 60 + minute;
      const endMinutes = endHour * 60 + endMinute;
      if (endMinutes <= startMinutes) {
        setStartTimeError('Start time must be before end time');
      } else {
        setStartTimeError('');
      }
    } else {
      setStartTimeError('');
    }
    
    updateFormData('eventStartTime', timeStr);
    setError(null);
  };

  const handleEndTimeChange = (newTime) => {
    if (!newTime) {
      updateFormData('eventEndTime', '');
      setEndTimeError('');
      return;
    }

    const timeStr = newTime.format('HH:mm');
    const hour = newTime.hour();
    const minute = newTime.minute();
    
    // Validate business hours (8 AM - 11 PM)
    if (hour < 8 || (hour === 23 && minute > 0) || hour >= 23) {
      setEndTimeError('End time must be between 8:00 AM and 11:00 PM');
      updateFormData('eventEndTime', timeStr);
      return;
    }
    
    // Validate end time is after start time if start time is already set
    if (formData.eventStartTime) {
      const startHour = parseInt(formData.eventStartTime.split(':')[0]);
      const startMinute = parseInt(formData.eventStartTime.split(':')[1]);
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = hour * 60 + minute;
      if (endMinutes <= startMinutes) {
        setEndTimeError('End time must be after start time');
      } else {
        setEndTimeError('');
      }
    } else {
      setEndTimeError('');
    }
    
    updateFormData('eventEndTime', timeStr);
    setError(null);
  };

  const selectedDate = formData.weddingDate ? dayjs(formData.weddingDate) : null;
  const selectedStartTime = formData.eventStartTime ? dayjs(`2000-01-01 ${formData.eventStartTime}`) : null;
  const selectedEndTime = formData.eventEndTime ? dayjs(`2000-01-01 ${formData.eventEndTime}`) : null;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <div className="step-content step1-content">
        <div className="step-header">
          <div className="step-icon">
            <i className="fas fa-calendar-alt"></i>
          </div>
          <h2 className="step-title">Date & Time</h2>
        </div>

        <div className="step-description">
          <p>Select your wedding date and event duration</p>
        </div>

        <div className="date-time-selection">
          <div className="date-time-group calendar-group">
            <label className="date-time-label">Select Your Wedding Date</label>
            <Paper 
              elevation={0}
              sx={{
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                overflow: 'visible',
                boxShadow: '0px 2px 6px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease',
                width: '100%',
                maxWidth: '100%',
                '&:hover': {
                  boxShadow: '0px 4px 12px rgba(0,0,0,0.15)',
                }
              }}
            >
              <DateCalendar
                value={selectedDate}
                onChange={handleDateChange}
                minDate={minDate}
                disableHighlightToday
                sx={{
                  width: '100%',
                  '& *::-webkit-scrollbar': {
                    display: 'none'
                  },
                  '& *': {
                    scrollbarWidth: 'none'
                  },
                  '& .MuiPickersDay-root': {
                    borderRadius: '0',
                    transition: 'all 0.2s ease',
                    fontSize: '14px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    color: '#222730',
                    backgroundColor: 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(225, 103, 137, 0.1)',
                    },
                  },
                  '& .MuiPickersDay-root.Mui-selected': {
                    backgroundColor: '#E16789 !important',
                    color: 'white !important',
                    fontWeight: 400,
                    '&:hover': {
                      backgroundColor: '#d4567a !important',
                    },
                  },
                  '& .MuiPickersDay-root.Mui-disabled': {
                    color: '#A5B3BF',
                    opacity: 1,
                    cursor: 'not-allowed',
                  },
                  '& .MuiPickersCalendarHeader-root': {
                    padding: '18px 28px 14px',
                    borderBottom: '1px solid #e0e0e0',
                  },
                  '& .MuiPickersCalendarHeader-labelContainer': {
                    fontFamily: 'Playfair Display, serif',
                    fontWeight: 600,
                    fontSize: '16px',
                  },
                  '& .MuiPickersCalendarHeader-weekDayLabelContainer': {
                    padding: '10px 28px 4px',
                  },
                  '& .MuiDayCalendar-weekDayLabel': {
                    fontSize: '14px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    color: '#222730',
                  },
                  '& .MuiPickersArrowSwitcher-root': {
                    padding: '0 4px',
                    '& button': {
                      borderRadius: '6px',
                      transition: 'all 0.2s ease',
                      padding: '6px',
                      margin: '0 2px',
                      minWidth: '32px',
                      '&:hover': {
                        backgroundColor: 'rgba(225, 103, 137, 0.12)',
                        boxShadow: '0 0 0 2px rgba(225, 103, 137, 0.08)',
                      },
                      '&:focus-visible': {
                        outline: '2px solid rgba(225, 103, 137, 0.6)',
                        outlineOffset: '2px',
                        backgroundColor: 'rgba(225, 103, 137, 0.12)',
                      },
                    },
                  },
                }}
              />
            </Paper>
          </div>

          <div className="date-time-group time-group" style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
            <div>
              <label className="date-time-label">Event Start Time</label>
              <TimePicker
                value={selectedStartTime}
                onChange={handleStartTimeChange}
                slotProps={{
                  textField: {
                    error: !!startTimeError,
                    helperText: startTimeError || 'Business hours: 8:00 AM - 11:00 PM',
                    fullWidth: true,
                    className: 'time-picker-input'
                  }
                }}
                sx={{
                  width: '100%',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    fontFamily: 'Playfair Display, serif',
                    fontSize: '16px',
                    boxShadow: '0px 2px 6px rgba(0,0,0,0.1)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: '0px 4px 12px rgba(0,0,0,0.15)',
                      borderColor: '#E16789',
                    },
                    '&.Mui-focused': {
                      boxShadow: '0px 0px 0px 3px rgba(225, 103, 137, 0.1)',
                      borderColor: '#E16789',
                    },
                    '& fieldset': {
                      borderColor: '#e0e0e0',
                      borderWidth: '1px',
                    },
                  },
                }}
              />
            </div>
            <div>
              <label className="date-time-label">Event End Time</label>
            <TimePicker
                value={selectedEndTime}
                onChange={handleEndTimeChange}
              slotProps={{
                textField: {
                    error: !!endTimeError,
                    helperText: endTimeError || 'Business hours: 8:00 AM - 11:00 PM',
                  fullWidth: true,
                  className: 'time-picker-input'
                }
              }}
              sx={{
                width: '100%',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  fontFamily: 'Playfair Display, serif',
                  fontSize: '16px',
                  boxShadow: '0px 2px 6px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0px 4px 12px rgba(0,0,0,0.15)',
                    borderColor: '#E16789',
                  },
                  '&.Mui-focused': {
                    boxShadow: '0px 0px 0px 3px rgba(225, 103, 137, 0.1)',
                    borderColor: '#E16789',
                  },
                  '& fieldset': {
                    borderColor: '#e0e0e0',
                    borderWidth: '1px',
                  },
                },
              }}
            />
            </div>
          </div>
        </div>

        {formData.weddingDate && formData.eventStartTime && formData.eventEndTime && (
          <div className="selected-date-time-preview">
            <div className="preview-card">
              <i className="fas fa-check-circle"></i>
              <div className="preview-content">
                <p className="preview-label">Selected Date & Time</p>
                <p className="preview-value">
                  {dayjs(formData.weddingDate).format('MMMM DD, YYYY')} from {dayjs(`2000-01-01 ${formData.eventStartTime}`).format('h:mm A')} to {dayjs(`2000-01-01 ${formData.eventEndTime}`).format('h:mm A')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </LocalizationProvider>
  );
};

export default Step1DateSelection;

