import React, { useState } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs from 'dayjs';
import './CreateProject.styles.css';

const Step1DateSelection = ({ formData, updateFormData, error, setError }) => {
  const [dateError, setDateError] = useState('');
  const [timeError, setTimeError] = useState('');

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

  const handleTimeChange = (newTime) => {
    if (!newTime) {
      updateFormData('weddingTime', '');
      setTimeError('');
      return;
    }

    const timeStr = newTime.format('HH:mm');
    updateFormData('weddingTime', timeStr);
    setTimeError('');
    setError(null);
  };

  const selectedDate = formData.weddingDate ? dayjs(formData.weddingDate) : null;
  const selectedTime = formData.weddingTime ? dayjs(`2000-01-01 ${formData.weddingTime}`) : null;

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
          <p>Select your wedding date and time</p>
        </div>

        <div className="date-time-selection">
          <div className="date-time-group">
            <label className="date-time-label">Select Your Wedding Date</label>
            <DatePicker
              value={selectedDate}
              onChange={handleDateChange}
              minDate={minDate}
              slotProps={{
                textField: {
                  error: !!dateError,
                  helperText: dateError,
                  fullWidth: true,
                  className: 'date-picker-input'
                }
              }}
              sx={{
                width: '100%',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '6px',
                  fontFamily: 'Playfair Display, serif',
                  '&:hover fieldset': {
                    borderColor: '#e16789',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#e16789',
                  },
                },
              }}
            />
          </div>

          <div className="date-time-group">
            <label className="date-time-label">Select a Time</label>
            <TimePicker
              value={selectedTime}
              onChange={handleTimeChange}
              slotProps={{
                textField: {
                  error: !!timeError,
                  helperText: timeError,
                  fullWidth: true,
                  className: 'time-picker-input'
                }
              }}
              sx={{
                width: '100%',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '6px',
                  fontFamily: 'Playfair Display, serif',
                  '&:hover fieldset': {
                    borderColor: '#e16789',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#e16789',
                  },
                },
              }}
            />
          </div>
        </div>

        {formData.weddingDate && formData.weddingTime && (
          <div className="selected-date-time-preview">
            <div className="preview-card">
              <i className="fas fa-check-circle"></i>
              <div className="preview-content">
                <p className="preview-label">Selected Date & Time</p>
                <p className="preview-value">
                  {dayjs(formData.weddingDate).format('MMMM DD, YYYY')} at {dayjs(`2000-01-01 ${formData.weddingTime}`).format('h:mm A')}
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

