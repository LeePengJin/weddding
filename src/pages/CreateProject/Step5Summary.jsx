import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import dayjs from 'dayjs';
import './CreateProject.styles.css';

const Step5Summary = ({ formData, updateFormData, onConfirm, loading }) => {
  const [availabilityStatus, setAvailabilityStatus] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  useEffect(() => {
    // Check venue availability one final time
    if (formData.venueServiceListingId && formData.weddingDate) {
      checkFinalAvailability();
    }
  }, []);

  const checkFinalAvailability = async () => {
    if (!formData.venueServiceListingId || !formData.weddingDate) return;

    setCheckingAvailability(true);
    try {
      const dateTime = new Date(`${formData.weddingDate}T${formData.weddingTime || '12:00'}:00`);
      const response = await apiFetch(
        `/availability/check?serviceListingId=${formData.venueServiceListingId}&date=${dateTime.toISOString()}`
      );
      setAvailabilityStatus(response.available);
      if (!response.available) {
        setSummaryError('The selected venue is no longer available for this date. Please go back and select a different venue or date.');
      }
    } catch (err) {
      setSummaryError('Unable to verify venue availability. Please try again.');
    } finally {
      setCheckingAvailability(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not selected';
    return dayjs(dateStr).format('MMMM DD, YYYY');
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return 'Not selected';
    return dayjs(`2000-01-01 ${timeStr}`).format('h:mm A');
  };

  const getWeddingTypeLabel = () => {
    if (formData.weddingType === 'self_organized') return 'Self-Organized';
    if (formData.weddingType === 'prepackaged') return 'Pre-packaged';
    return 'Not selected';
  };


  return (
    <div className="step-content step5-content">
      <div className="step-header">
        <div className="step-icon">
          <i className="fas fa-clipboard-check"></i>
        </div>
        <h2 className="step-title">Summary</h2>
      </div>

      <div className="step-description">
        <p>Review your project details before creating</p>
      </div>

      {checkingAvailability && (
        <div className="availability-checking">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Verifying venue availability...</span>
        </div>
      )}

      {availabilityStatus === false && (
        <div className="availability-warning">
          <i className="fas fa-exclamation-triangle"></i>
          <div>
            <p className="warning-title">Venue Unavailable</p>
            <p className="warning-message">
              The selected venue is no longer available for this date. Please go back and select a different venue or date.
            </p>
          </div>
        </div>
      )}

      <div className="summary-sections">
        <div className="summary-section">
          <div className="summary-section-header">
            <i className="fas fa-calendar-alt"></i>
            <h3>Wedding Details</h3>
          </div>
          <div className="summary-section-content">
            <div className="summary-item">
              <span className="summary-label">Date:</span>
              <span className="summary-value">{formatDate(formData.weddingDate)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Time:</span>
              <span className="summary-value">{formatTime(formData.weddingTime)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Venue:</span>
              <span className="summary-value">{formData.venue?.name || 'Not selected'}</span>
            </div>
            {formData.venue?.location && (
              <div className="summary-item">
                <span className="summary-label">Location:</span>
                <span className="summary-value">{formData.venue.location}</span>
              </div>
            )}
          </div>
        </div>

        <div className="summary-section">
          <div className="summary-section-header">
            <i className="fas fa-gift"></i>
            <h3>Preparation Type</h3>
          </div>
          <div className="summary-section-content">
            <div className="summary-item">
              <span className="summary-label">Type:</span>
              <span className="summary-value">{getWeddingTypeLabel()}</span>
            </div>
            {formData.weddingType === 'prepackaged' && formData.basePackageId && (
              <div className="summary-item">
                <span className="summary-label">Package Selected:</span>
                <span className="summary-value">Package ID: {formData.basePackageId}</span>
              </div>
            )}
          </div>
        </div>

        <div className="summary-section">
          <div className="summary-section-header">
            <i className="fas fa-edit"></i>
            <h3>Project Name</h3>
          </div>
          <div className="summary-section-content">
            <div className="summary-item full-width">
              <span className="summary-value">{formData.projectName || 'Not entered'}</span>
            </div>
          </div>
        </div>

        {formData.totalBudget && (
          <div className="summary-section">
            <div className="summary-section-header">
              <i className="fas fa-wallet"></i>
              <h3>Total Budget</h3>
            </div>
            <div className="summary-section-content">
              <div className="summary-item full-width">
                <span className="summary-value">RM {parseFloat(formData.totalBudget).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="summary-actions">
        <button
          className="action-button confirm-button"
          onClick={onConfirm}
          disabled={loading || availabilityStatus === false || checkingAvailability}
        >
          {loading ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              <span>Creating...</span>
            </>
          ) : (
            <>
              <i className="fas fa-check"></i>
              <span>Confirm & Create Project</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Step5Summary;

