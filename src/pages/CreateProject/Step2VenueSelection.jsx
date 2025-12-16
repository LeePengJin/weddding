import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiFetch } from '../../lib/api';
import Model3DViewer from '../../components/Model3DViewer/Model3DViewer';
import './CreateProject.styles.css';

const normalizeVenueImages = (venue) => {
  if (!venue) return [];

  const images = [];

  if (Array.isArray(venue.images)) {
    images.push(...venue.images);
  }

  if (Array.isArray(venue.galleryImages)) {
    images.push(...venue.galleryImages);
  }

  if (venue.imageUrl) {
    images.push(venue.imageUrl);
  }

  // Remove falsy values and duplicates
  return [...new Set(images.filter(Boolean))];
};

const Step2VenueSelection = ({ formData, updateFormData, error, setError }) => {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState({}); // venueId -> { available, checking }
  const [detailsVenue, setDetailsVenue] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isImageFullscreen, setIsImageFullscreen] = useState(false);
  const [showUnavailableVenues, setShowUnavailableVenues] = useState(false);
  const checkedVenuesRef = useRef(new Set()); // Track which venue+date combinations we've checked

  const { weddingDate } = formData;
  const venueImages = useMemo(() => normalizeVenueImages(detailsVenue), [detailsVenue]);
  const hasMultipleImages = venueImages.length > 1;

  // 3D model sources for the details modal
  const modelSources = useMemo(() => {
    if (!detailsVenue) return [];
    const list = [];

    const primary = detailsVenue.designElement?.modelFile || detailsVenue.modelFile;
    if (primary) {
      list.push({
        src: primary,
        label: detailsVenue.designElement?.name || detailsVenue.name || '3D Model',
        dimensions: detailsVenue.designElement?.dimensions || detailsVenue.dimensions || null,
      });
    }

    if (Array.isArray(detailsVenue.components)) {
      detailsVenue.components.forEach((component, index) => {
        const file = component?.designElement?.modelFile;
        if (file) {
          list.push({
            src: file,
            label: component?.designElement?.name || component?.name || `Component ${index + 1}`,
            dimensions: component?.designElement?.dimensions || null,
          });
        }
      });
    }

    return list;
  }, [detailsVenue]);

  const hasModels = modelSources.length > 0;
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const activeModel = modelSources[activeModelIndex] || null;

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    const fetchVenues = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (searchTerm.trim()) params.append('search', searchTerm.trim());
        if (weddingDate) params.append('date', weddingDate);

        const query = params.toString();
        const endpoint = query ? `/venues/search?${query}` : '/venues/search';

        const data = await apiFetch(endpoint, { signal: controller.signal });

        if (!isActive) {
          return;
        }

        if (data && Array.isArray(data.venues)) {
          setVenues(data.venues);
        } else if (Array.isArray(data)) {
          setVenues(data);
        } else {
          setVenues([]);
        }
      } catch (err) {
        if (!isActive || err.name === 'AbortError') {
          return;
        }
        setError(err.message || 'Failed to fetch venues');
        setVenues([]);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    const debounceId = setTimeout(fetchVenues, 250);

    return () => {
      isActive = false;
      controller.abort();
      clearTimeout(debounceId);
    };
  }, [searchTerm, weddingDate, setError]);

  useEffect(() => {
    setAvailabilityStatus({});
    checkedVenuesRef.current.clear(); // Clear checked venues when date changes
  }, [weddingDate]);

  useEffect(() => {
    if (!detailsVenue) {
      setIsImageFullscreen(false);
      setCurrentImageIndex(0);
      setActiveModelIndex(0);
      return;
    }

    setCurrentImageIndex(0);
    setIsImageFullscreen(false);
    setActiveModelIndex(0);
  }, [detailsVenue, modelSources.length]);

  useEffect(() => {
    if (currentImageIndex > 0 && currentImageIndex >= venueImages.length) {
      setCurrentImageIndex(0);
    }
  }, [venueImages, currentImageIndex]);

  const checkVenueAvailability = useCallback(async (venueId) => {
    if (!weddingDate) return;

    const requestedDate = weddingDate;

    setAvailabilityStatus(prev => ({
      ...prev,
      [venueId]: {
        ...(prev[venueId] || {}),
        checking: true
      }
    }));

    try {
      // API expects date in YYYY-MM-DD format, not ISO datetime
      // formData.weddingDate is already in YYYY-MM-DD format from the date picker
      const dateStr = requestedDate;
      
      console.log(`Checking availability for venue ${venueId} on date ${dateStr}`);
      const response = await apiFetch(
        `/availability/check?serviceListingId=${venueId}&date=${dateStr}`
      );

      console.log(`Availability response for venue ${venueId}:`, response);

      setAvailabilityStatus(prev => ({
        ...prev,
        [venueId]: { 
          available: response.available, 
          checking: false,
          reason: response.reason || null,
          details: response,
          lastCheckedDate: requestedDate
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
          reason: 'Error checking availability',
          lastCheckedDate: requestedDate
        }
      }));
    }
  }, [weddingDate]);

  const visibleVenues = useMemo(() => {
    if (!Array.isArray(venues)) return [];

    return venues.filter((venue) => {
      if (!weddingDate) return true;
      const status = availabilityStatus[venue.id];
      // If still checking or not yet checked, keep it visible
      if (!status || status.checking) return true;
      // If unavailable and are not showing unavailable, hide it
      if (!status.available && !showUnavailableVenues) return false;
      return true;
    });
  }, [venues, weddingDate, availabilityStatus, showUnavailableVenues]);

  useEffect(() => {
    if (!weddingDate || venues.length === 0) {
      return;
    }

    // Check availability for all venues when date or venues change
    venues.forEach((venue) => {
      const checkKey = `${venue.id}-${weddingDate}`;
      
      // Only check if we haven't checked this venue+date combination yet
      if (!checkedVenuesRef.current.has(checkKey)) {
        checkedVenuesRef.current.add(checkKey);
        checkVenueAvailability(venue.id);
      }
    });
  }, [weddingDate, venues, checkVenueAvailability]);

  const handleVenueSelect = (venue) => {
    updateFormData('venueServiceListingId', venue.id);
    updateFormData('venue', venue);
    setError(null);
    
    // Only check availability if not already checked for this date
    if (weddingDate) {
      const status = availabilityStatus[venue.id];
      if (!status || status.lastCheckedDate !== weddingDate || status.checking) {
        checkVenueAvailability(venue.id);
      }
    }
  };

  const openVenueDetails = async (venue, e) => {
    if (e) {
      e.stopPropagation();
    }

    // Show basic details immediately
    setDetailsVenue(venue);
    setCurrentImageIndex(0);
    setIsImageFullscreen(false);

    // Then load full venue details (including 3D model info) in the background
    try {
      const endpoint = weddingDate
        ? `/venues/${venue.id}?date=${encodeURIComponent(weddingDate)}`
        : `/venues/${venue.id}`;
      const fullDetails = await apiFetch(endpoint);

      // Only update if we're still viewing this venue
      setDetailsVenue((current) => {
        if (!current || current.id !== venue.id) return current;
        return { ...current, ...fullDetails };
      });
    } catch (err) {
      console.error('Failed to load venue details', err);
    }
  };

  const closeVenueDetails = () => {
    setIsImageFullscreen(false);
    setDetailsVenue(null);
  };

  useEffect(() => {
    if (!detailsVenue) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (isImageFullscreen) {
          setIsImageFullscreen(false);
          return;
        }
        setDetailsVenue(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailsVenue, isImageFullscreen]);

  const handleNextImage = (event) => {
    if (event) event.stopPropagation();
    if (!hasMultipleImages) return;
    setCurrentImageIndex((prev) => (prev + 1) % venueImages.length);
  };

  const handlePrevImage = (event) => {
    if (event) event.stopPropagation();
    if (!hasMultipleImages) return;
    setCurrentImageIndex((prev) => (prev - 1 + venueImages.length) % venueImages.length);
  };

  const handleThumbnailSelect = (index, event) => {
    if (event) event.stopPropagation();
    if (index < 0 || index >= venueImages.length) return;
    setCurrentImageIndex(index);
    setIsImageFullscreen(false);
  };

  const openImageFullscreen = (event) => {
    if (event) event.stopPropagation();
    if (!venueImages.length) return;
    setIsImageFullscreen(true);
  };

  const closeImageFullscreen = (event) => {
    if (event) event.stopPropagation();
    setIsImageFullscreen(false);
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
    if (!url) return '/images/default-listing.jpg';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/uploads')) {
      return `http://localhost:4000${url}`;
    }
    return url;
  };

  const activeImage = venueImages[currentImageIndex] || detailsVenue?.imageUrl || null;

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

      <div className="venue-search-section">
        <form className="venue-search-form" onSubmit={(e) => e.preventDefault()}>
          <div className="search-input-wrapper">
            <i className="fas fa-search search-icon"></i>
            <input
              type="text"
              className="venue-search-input"
              placeholder="Search Venue"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </form>
        {weddingDate && (
          <div className="venue-filter-controls">
            <label className="venue-filter-toggle">
              <input
                type="checkbox"
                checked={showUnavailableVenues}
                onChange={(e) => setShowUnavailableVenues(e.target.checked)}
              />
              <span>Show unavailable venues</span>
            </label>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-venues">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading venues...</p>
        </div>
      ) : !Array.isArray(venues) || venues.length === 0 ? (
        <div className="no-venues">
          <i className="fas fa-inbox"></i>
          <p>
            {weddingDate
              ? `No venues are available on ${weddingDate}. Try selecting a different date.`
              : 'No venues found. Try a different search term.'}
          </p>
        </div>
      ) : weddingDate && visibleVenues.length === 0 ? (
        <div className="no-venues">
          <i className="fas fa-calendar-times"></i>
          <p>No available venues on {weddingDate}.</p>
          <p style={{ marginTop: 6, fontSize: '0.9em' }}>
            Try selecting a different date, or enable <strong>Show unavailable venues</strong> to view all venues.
          </p>
        </div>
      ) : (
        <div className="venues-grid">
            {visibleVenues.map((venue) => {
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
                  <button
                    type="button"
                    className="venue-info-button"
                    onClick={(e) => openVenueDetails(venue, e)}
                    aria-label={`View details for ${venue.name}`}
                    title="View details"
                  >
                    <i className="fas fa-info"></i>
                  </button>
                  <img
                    src={getImageUrl(venue.images?.[0] || venue.imageUrl)}
                    alt={venue.name}
                    onError={(e) => {
                      if (e.target.src !== '/images/default-listing.jpg') {
                        e.target.src = '/images/default-listing.jpg';
                      }
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

      {detailsVenue && (
        <>
          <div
            className="venue-details-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`Venue details for ${detailsVenue.name}`}
            onClick={closeVenueDetails}
          >
            <div
              className="venue-details-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="venue-details-close"
                onClick={closeVenueDetails}
                aria-label="Close venue details"
              >
                <i className="fas fa-times"></i>
              </button>

              <div className="venue-details-hero">
                {hasMultipleImages && (
                  <>
                    <button
                      type="button"
                      className="venue-hero-control prev"
                      onClick={handlePrevImage}
                      aria-label="Previous image"
                    >
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <button
                      type="button"
                      className="venue-hero-control next"
                      onClick={handleNextImage}
                      aria-label="Next image"
                    >
                      <i className="fas fa-chevron-right"></i>
                    </button>
                    <div className="venue-hero-counter">
                      {currentImageIndex + 1} / {venueImages.length}
                    </div>
                  </>
                )}
                <img
                  src={getImageUrl(activeImage || '/images/default-listing.jpg')}
                  alt={detailsVenue.name}
                  onClick={openImageFullscreen}
                  role={venueImages.length ? 'button' : undefined}
                  tabIndex={venueImages.length ? 0 : -1}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      openImageFullscreen(event);
                    }
                  }}
                  onError={(e) => {
                    if (e.target.src !== '/images/default-listing.jpg') {
                      e.target.src = '/images/default-listing.jpg';
                    }
                  }}
                />
              </div>

              {hasMultipleImages && (
                <div className="venue-hero-thumbnails">
                  {venueImages.map((image, index) => (
                    <button
                      type="button"
                      key={`${image}-${index}`}
                      className={`venue-thumbnail ${index === currentImageIndex ? 'active' : ''}`}
                      onClick={(event) => handleThumbnailSelect(index, event)}
                      aria-label={`View image ${index + 1}`}
                    >
                      <img
                        src={getImageUrl(image)}
                        alt={`${detailsVenue.name} thumbnail ${index + 1}`}
                        onError={(e) => {
                          if (e.target.src !== '/images/default-listing.jpg') {
                            e.target.src = '/images/default-listing.jpg';
                          }
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}

              <div className="venue-details-content">
                <h3>{detailsVenue.name}</h3>

                <div className="venue-details-meta">
                  {detailsVenue.vendor?.businessName && (
                    <p>
                      <i className="fas fa-building"></i>
                      {detailsVenue.vendor.businessName}
                    </p>
                  )}
                  {detailsVenue.location && (
                    <p>
                      <i className="fas fa-map-pin"></i>
                      {detailsVenue.location}
                    </p>
                  )}
                  {detailsVenue.capacity && (
                    <p>
                      <i className="fas fa-users"></i>
                      {detailsVenue.capacity}+ guests
                    </p>
                  )}
                  {detailsVenue.price && (
                    <p>
                      <i className="fas fa-tag"></i>
                      RM {detailsVenue.price.toLocaleString()}
                    </p>
                  )}
                </div>

                {detailsVenue.description && (
                  <div className="venue-details-section">
                    <h4>About this venue</h4>
                    <p>{detailsVenue.description}</p>
                  </div>
                )}

                {Array.isArray(detailsVenue.amenities) && detailsVenue.amenities.length > 0 && (
                  <div className="venue-details-section">
                    <h4>Amenities</h4>
                    <ul className="venue-amenities-list">
                      {detailsVenue.amenities.map((amenity) => (
                        <li key={amenity}>
                          <i className="fas fa-check"></i>
                          {amenity}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {detailsVenue.extraDetails && (
                  <div className="venue-details-section">
                    <h4>Additional Details</h4>
                    <p>{detailsVenue.extraDetails}</p>
                  </div>
                )}

                {hasModels && activeModel && (
                  <div className="venue-details-section">
                    <h4>3D Preview</h4>
                    <div className="venue-3d-preview">
                      <Model3DViewer
                        key={`${activeModel.src}-${JSON.stringify(activeModel.dimensions || {})}`}
                        modelUrl={activeModel.src}
                        height="320px"
                        width="100%"
                        borderless
                        autoRotate
                        targetDimensions={activeModel.dimensions || null}
                      />
                      {modelSources.length > 1 && (
                        <div className="venue-3d-controls">
                          <button
                            type="button"
                            className="venue-3d-nav"
                            onClick={() =>
                              setActiveModelIndex((prev) =>
                                (prev - 1 + modelSources.length) % modelSources.length
                              )
                            }
                          >
                            ‹ Prev
                          </button>
                          <span className="venue-3d-label">{activeModel.label}</span>
                          <button
                            type="button"
                            className="venue-3d-nav"
                            onClick={() =>
                              setActiveModelIndex((prev) =>
                                (prev + 1) % modelSources.length
                              )
                            }
                          >
                            Next ›
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="venue-details-close-bottom"
                  onClick={closeVenueDetails}
                  aria-label="Close venue details"
                >
                  <i className="fas fa-times"></i>
                  <span>Close</span>
                </button>
              </div>
            </div>
          </div>

          {isImageFullscreen && (
            <div
              className="venue-fullscreen-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label={`Fullscreen view of ${detailsVenue.name}`}
              onClick={closeImageFullscreen}
            >
              <div
                className="venue-fullscreen-inner"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="venue-fullscreen-close"
                  onClick={closeImageFullscreen}
                  aria-label="Close image viewer"
                >
                  <i className="fas fa-times"></i>
                </button>

                <img
                  src={getImageUrl(activeImage)}
                  alt={`${detailsVenue.name} fullscreen`}
                  onError={(e) => {
                    if (e.target.src !== '/images/default-listing.jpg') {
                      e.target.src = '/images/default-listing.jpg';
                    }
                  }}
                />

                {hasMultipleImages && (
                  <>
                    <button
                      type="button"
                      className="venue-fullscreen-control prev"
                      onClick={handlePrevImage}
                      aria-label="Previous image"
                    >
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <button
                      type="button"
                      className="venue-fullscreen-control next"
                      onClick={handleNextImage}
                      aria-label="Next image"
                    >
                      <i className="fas fa-chevron-right"></i>
                    </button>
                    <div className="venue-fullscreen-counter">
                      {currentImageIndex + 1} / {venueImages.length}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
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

