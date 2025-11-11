import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import './CreateProject.styles.css';

const Step2VenueSelection = ({ formData, updateFormData, error, setError }) => {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState({}); // venueId -> { available, checking }

  useEffect(() => {
    fetchVenues();
  }, []);

  useEffect(() => {
    // Check availability for all venues when date is available
    if (formData.weddingDate && venues.length > 0) {
      venues.forEach(venue => {
        // Only check if we haven't checked this venue for this date yet
        const statusKey = `${venue.id}-${formData.weddingDate}`;
        if (!availabilityStatus[venue.id] || 
            (availabilityStatus[venue.id].lastCheckedDate !== formData.weddingDate && !availabilityStatus[venue.id].checking)) {
          checkVenueAvailability(venue.id);
        }
      });
    }
  }, [formData.weddingDate, venues.length]); // Only depend on length, not the array itself

  const fetchVenues = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (formData.weddingDate) params.append('date', formData.weddingDate);

      const data = await apiFetch(`/venues/search?${params.toString()}`);
      // API returns { venues: [...], total: number, ... }
      // Ensure we always have an array
      if (data && Array.isArray(data.venues)) {
        setVenues(data.venues);
      } else if (Array.isArray(data)) {
        // Fallback: if API returns array directly
        setVenues(data);
      } else {
        setVenues([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch venues');
      setVenues([]); // Ensure venues is always an array
    } finally {
      setLoading(false);
    }
  };

  const checkVenueAvailability = async (venueId) => {
    if (!formData.weddingDate) return;

    setAvailabilityStatus(prev => ({ ...prev, [venueId]: { checking: true } }));

    try {
      // API expects date in YYYY-MM-DD format, not ISO datetime
      // formData.weddingDate is already in YYYY-MM-DD format from the date picker
      const dateStr = formData.weddingDate;
      
      const response = await apiFetch(
        `/availability/check?serviceListingId=${venueId}&date=${dateStr}`
      );

      // Log for debugging
      console.log('Availability check response:', response);

      setAvailabilityStatus(prev => ({
        ...prev,
        [venueId]: { 
          available: response.available, 
          checking: false,
          reason: response.reason || null,
          details: response,
          lastCheckedDate: formData.weddingDate
        }
      }));
    } catch (err) {
      console.error('Availability check error:', err);
      setAvailabilityStatus(prev => ({
        ...prev,
        [venueId]: { 
          available: false, 
          checking: false, 
          error: err.message,
          reason: 'Error checking availability'
        }
      }));
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchVenues();
  };

  const handleVenueSelect = (venue) => {
    updateFormData('venueServiceListingId', venue.id);
    updateFormData('venue', venue);
    setError(null);
    
    // Check availability immediately
    if (formData.weddingDate) {
      checkVenueAvailability(venue.id);
    }
  };

  const getAvailabilityBadge = (venueId) => {
    const status = availabilityStatus[venueId];
    if (!status || status.checking) {
      return (
        <div className="availability-badge checking">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Checking...</span>
        </div>
      );
    }
    if (status.error) {
      return (
        <div className="availability-badge error" title={status.error}>
          <i className="fas fa-exclamation-triangle"></i>
          <span>Error</span>
        </div>
      );
    }
    if (status.available) {
      return (
        <div className="availability-badge available">
          <i className="fas fa-check-circle"></i>
          <span>Available</span>
        </div>
      );
    }
    return (
      <div className="availability-badge unavailable" title={status.reason || 'Unavailable'}>
        <i className="fas fa-times-circle"></i>
        <span>Unavailable</span>
      </div>
    );
  };

  const getImageUrl = (url) => {
    if (!url) return '/placeholder-venue.jpg';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/uploads')) {
      return `http://localhost:4000${url}`;
    }
    return url;
  };

  return (
    <div className="step-content step2-content">
      <div className="step-header">
        <div className="step-icon">
          <i className="fas fa-map-marker-alt"></i>
        </div>
        <h2 className="step-title">Venue</h2>
      </div>

      <div className="step-description">
        <p>Select Your Perfect Venue</p>
      </div>

      <form className="venue-search-form" onSubmit={handleSearch}>
        <div className="search-input-wrapper">
          <i className="fas fa-search search-icon"></i>
          <input
            type="text"
            className="venue-search-input"
            placeholder="Search Venue"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch(e)}
          />
        </div>
      </form>

      {loading ? (
        <div className="loading-venues">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading venues...</p>
        </div>
      ) : !Array.isArray(venues) || venues.length === 0 ? (
        <div className="no-venues">
          <i className="fas fa-inbox"></i>
          <p>No venues found. Try a different search term.</p>
        </div>
      ) : (
        <div className="venues-grid">
          {venues.map((venue) => {
            const isSelected = formData.venueServiceListingId === venue.id;
            const status = availabilityStatus[venue.id];
            const showUnavailable = status && !status.checking && !status.available;

            return (
              <div
                key={venue.id}
                className={`venue-card ${isSelected ? 'selected' : ''} ${showUnavailable ? 'unavailable' : ''}`}
                onClick={() => !showUnavailable && handleVenueSelect(venue)}
              >
                <div className="venue-image-wrapper">
                  <img
                    src={getImageUrl(venue.images?.[0] || venue.imageUrl)}
                    alt={venue.name}
                    onError={(e) => {
                      e.target.src = '/placeholder-venue.jpg';
                    }}
                  />
                  {isSelected && (
                    <div className="venue-selected-overlay">
                      <i className="fas fa-check-circle"></i>
                    </div>
                  )}
                  {formData.weddingDate && (
                    <div className="venue-availability-overlay">
                      {getAvailabilityBadge(venue.id)}
                    </div>
                  )}
                </div>
                <div className="venue-info">
                  <h3 className="venue-name">{venue.name}</h3>
                  <div className="venue-details">
                    {venue.vendor?.businessName && (
                      <p className="venue-vendor">
                        <i className="fas fa-building"></i>
                        {venue.vendor.businessName}
                      </p>
                    )}
                    {venue.location && (
                      <p className="venue-location">
                        <i className="fas fa-map-pin"></i>
                        {venue.location}
                      </p>
                    )}
                    {venue.capacity && (
                      <p className="venue-capacity">
                        <i className="fas fa-users"></i>
                        {venue.capacity}+ guests
                      </p>
                    )}
                    {venue.price && (
                      <p className="venue-price">
                        <i className="fas fa-tag"></i>
                        RM {venue.price.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!formData.weddingDate && (
        <div className="venue-warning">
          <i className="fas fa-info-circle"></i>
          <p>Please select a wedding date first to check venue availability</p>
        </div>
      )}
    </div>
  );
};

export default Step2VenueSelection;

