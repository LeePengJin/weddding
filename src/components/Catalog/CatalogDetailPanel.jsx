import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, IconButton, Stack, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Box, Rating, Divider, Chip, RadioGroup, FormControlLabel, Radio, Card, CardContent } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import { formatImageUrl } from '../../utils/image';
import { anonymizeName } from '../../utils/anonymizeName';
import Model3DViewer from '../Model3DViewer/Model3DViewer';
import './ServiceListingDetailsModal.css';

const INITIAL_REVIEWS_TO_SHOW = 3;

const ReviewsList = ({ reviews, totalCount }) => {
  const [showAll, setShowAll] = useState(false);
  const reviewsToShow = showAll ? reviews : reviews.slice(0, INITIAL_REVIEWS_TO_SHOW);
  const hasMore = reviews.length > INITIAL_REVIEWS_TO_SHOW;

  return (
    <>
      <Stack spacing={2}>
        {reviewsToShow.map((review) => (
          <Box key={review.id} sx={{ p: 1.5, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  {anonymizeName(review.reviewer?.name)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(review.reviewDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Typography>
              </Box>
              <Rating value={review.rating} readOnly size="small" />
            </Box>
            {review.comment && (
              <Typography variant="body2" color="text.secondary">
                {review.comment}
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
      {hasMore && !showAll && (
        <Button
          variant="text"
          onClick={() => setShowAll(true)}
          sx={{ mt: 1, textTransform: 'none' }}
        >
          Load More Reviews ({reviews.length - INITIAL_REVIEWS_TO_SHOW} more)
        </Button>
      )}
      {showAll && hasMore && (
        <Button
          variant="text"
          onClick={() => setShowAll(false)}
          sx={{ mt: 1, textTransform: 'none' }}
        >
          Show Less
        </Button>
      )}
    </>
  );
};

ReviewsList.propTypes = {
  reviews: PropTypes.array.isRequired,
  totalCount: PropTypes.number,
};

const CatalogDetailPanel = ({ item, onBack, onAdd, onMessageVendor, onShow3D }) => {
  const imageSources = useMemo(() => {
    if (!item || !Array.isArray(item.images)) return [];
    return item.images.filter(Boolean).map((src) => formatImageUrl(src));
  }, [item]);

  const modelSources = useMemo(() => {
    if (!item) return [];
    const list = [];
    const primary = item.designElement?.modelFile || item.modelFile;
    if (primary) {
      list.push({ 
        src: primary, 
        label: item.designElement?.name || item.name || '3D Model',
        dimensions: item.designElement?.dimensions || item.dimensions,
      });
    }
    if (Array.isArray(item.components)) {
      item.components.forEach((component, index) => {
        const file = component?.designElement?.modelFile;
        if (file) {
          list.push({
            src: file,
            label: component?.designElement?.name || component?.name || `Component ${index + 1}`,
            dimensions: component?.designElement?.dimensions,
          });
        }
      });
    }
    return list;
  }, [item]);

  const hasImages = imageSources.length > 0;
  const hasModels = modelSources.length > 0;

  const [viewMode, setViewMode] = useState(hasImages ? 'images' : (hasModels ? 'models' : 'images'));
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const [imageLightbox, setImageLightbox] = useState(null);

  useEffect(() => {
    if (hasImages) {
      setViewMode('images');
    } else if (hasModels) {
      setViewMode('models');
    }
    setActiveImageIndex(0);
    setActiveModelIndex(0);
    setImageLightbox(null);
  }, [item, hasImages, hasModels, imageSources.length, modelSources.length]);

  if (!item) return null;

  const activeImage = imageSources[activeImageIndex] || null;
  const activeModel = modelSources[activeModelIndex] || null;

  // Mark listing as unavailable when catalog availability flag says so
  const isUnavailable = item.availability && item.availability.available === false;

  const handlePrevImage = () => {
    if (imageSources.length <= 1) return;
    setActiveImageIndex((prev) => (prev - 1 + imageSources.length) % imageSources.length);
  };

  const handleNextImage = () => {
    if (imageSources.length <= 1) return;
    setActiveImageIndex((prev) => (prev + 1) % imageSources.length);
  };

  const handlePrevModel = () => {
    if (modelSources.length <= 1) return;
    setActiveModelIndex((prev) => (prev - 1 + modelSources.length) % modelSources.length);
  };

  const handleNextModel = () => {
    if (modelSources.length <= 1) return;
    setActiveModelIndex((prev) => (prev + 1) % modelSources.length);
  };

  const handleMessage = () => {
    if (onMessageVendor) {
      onMessageVendor(item);
    } else {
      window.location.href = '/messages';
    }
  };

  const handleOpen3D = () => {
    const targetModel = activeModel?.src || modelSources[0]?.src || null;
    if (targetModel && onShow3D) {
      onShow3D(item, targetModel);
    }
  };

  const handleAddClick = () => {
    // Add directly
    onAdd?.(item);
  };


  return (
    <div className="catalog-detail-panel">
      <div className="detail-header">
        <IconButton size="small" onClick={onBack} aria-label="Back to catalog">
          <ArrowBackIosNewIcon fontSize="inherit" />
        </IconButton>
        <Typography variant="subtitle1">Product Details</Typography>
      </div>

      <div className="detail-scroll">
        <Stack direction="row" spacing={1} className="media-toggle">
          {hasImages && (
            <Button
              size="small"
              variant={viewMode === 'images' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('images')}
              fullWidth
            >
              Photos ({imageSources.length})
            </Button>
          )}
          {hasModels && (
            <Button
              size="small"
              variant={viewMode === 'models' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('models')}
              fullWidth
            >
              3D View ({modelSources.length})
            </Button>
          )}
        </Stack>

        <div className="media-preview">
          {viewMode === 'images' && activeImage ? (
            <>
              <img
                src={activeImage}
                alt={item.name}
                onClick={() => setImageLightbox(activeImage)}
                style={{ cursor: 'zoom-in' }}
                onError={(e) => {
                  if (e.target.src !== '/images/default-listing.jpg') {
                    e.target.src = '/images/default-listing.jpg';
                  }
                }}
              />
              {imageSources.length > 1 && (
                <>
                  <IconButton className="carousel-btn left" onClick={handlePrevImage} aria-label="Previous image">
                    <ChevronLeftIcon />
                  </IconButton>
                  <IconButton className="carousel-btn right" onClick={handleNextImage} aria-label="Next image">
                    <ChevronRightIcon />
                  </IconButton>
                </>
              )}
            </>
          ) : viewMode === 'models' && activeModel ? (
            <>
              <Model3DViewer 
                key={`${activeModel.src}-${JSON.stringify(activeModel.dimensions)}`}
                modelUrl={activeModel.src} 
                height="100%" 
                width="100%" 
                borderless 
                targetDimensions={activeModel.dimensions}
              />
              {modelSources.length > 1 && (
                <>
                  <IconButton className="carousel-btn left" onClick={handlePrevModel} aria-label="Previous model">
                    <ChevronLeftIcon />
                  </IconButton>
                  <IconButton className="carousel-btn right" onClick={handleNextModel} aria-label="Next model">
                    <ChevronRightIcon />
                  </IconButton>
                </>
              )}
              <Typography variant="caption" className="media-label">
                {activeModel.label}
              </Typography>
            </>
          ) : (
            <div className="media-preview empty">
              <img
                src="/images/default-listing.jpg"
                alt="Default listing"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}
          {viewMode === 'images' && activeImage && (
            <IconButton className="fullscreen-btn" aria-label="Fullscreen image" onClick={() => setImageLightbox(activeImage)}>
              <FullscreenIcon fontSize="small" />
            </IconButton>
          )}
          {viewMode === 'models' && (
            <IconButton className="fullscreen-btn" aria-label="View fullscreen 3D" onClick={handleOpen3D}>
              <FullscreenIcon fontSize="small" />
            </IconButton>
          )}
        </div>

        <div className="detail-info">
          <Typography variant="h6">{item.name}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              {item.pricingPolicy === 'time_based' ? (
                <>RM {Number(item.hourlyRate || 0).toLocaleString()}/hr</>
              ) : (
                <>RM {Number(item.price || 0).toLocaleString()}</>
              )}
            </Typography>
            {item.averageRating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <StarIcon sx={{ fontSize: '1rem', color: '#ffc107' }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {parseFloat(item.averageRating).toFixed(1)}
                </Typography>
                {item.reviewCount > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    ({item.reviewCount} {item.reviewCount === 1 ? 'review' : 'reviews'})
                  </Typography>
                )}
              </Box>
            )}
          </Box>
          {item.pricingPolicy && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              <strong>Pricing:</strong> {
                item.pricingPolicy === 'fixed_package' ? 'Fixed Package' :
                item.pricingPolicy === 'per_table' ? 'Per Table' :
                item.pricingPolicy === 'per_unit' ? 'Per Unit' :
                item.pricingPolicy === 'time_based' ? `Time Based (RM${Number(item.hourlyRate || 0).toLocaleString()}/hr)` :
                item.pricingPolicy
              }
            </Typography>
          )}
          {item.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {item.description}
            </Typography>
          )}
        </div>


        <div className="vendor-info">
          <Typography variant="subtitle2">Vendor Information</Typography>
          <Typography variant="body2">
            <strong>Vendor:</strong> {item.vendor?.name || 'Vendor'}
          </Typography>
          <Typography variant="body2">
            <strong>Category:</strong> {item.category?.replace('_', ' ') || 'Uncategorised'}
          </Typography>
          {item.vendor?.phoneNumber && (
            <Typography variant="body2">
              <strong>Phone:</strong> {item.vendor.phoneNumber}
            </Typography>
          )}
          {item.vendor?.email && (
            <Typography variant="body2">
              <strong>Email:</strong> {item.vendor.email}
            </Typography>
          )}
        </div>

        {item.cancellationPolicy && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
              Cancellation Policy
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
              {item.cancellationPolicy}
            </Typography>
            {item.cancellationFeeTiers && (
              <Box sx={{ mt: 1.5, p: 1.5, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="caption" fontWeight="medium" sx={{ display: 'block', mb: 1 }}>
                  Cancellation Fee Schedule:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {(() => {
                    try {
                      const tiers = typeof item.cancellationFeeTiers === 'string' 
                        ? JSON.parse(item.cancellationFeeTiers) 
                        : item.cancellationFeeTiers;
                      return Object.entries(tiers).map(([period, percentage]) => (
                        <Box key={period} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            {period === '>90' ? 'More than 90 days' :
                             period === '30-90' ? '30-90 days' :
                             period === '7-30' ? '7-30 days' :
                             period === '<7' ? 'Less than 7 days' :
                             period} before wedding:
                          </Typography>
                          <Typography variant="caption" fontWeight="medium">
                            {(percentage * 100).toFixed(0)}%
                          </Typography>
                        </Box>
                      ));
                    } catch (e) {
                      return null;
                    }
                  })()}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {item.reviews && item.reviews.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
              Reviews ({item.reviewCount || item.reviews.length})
            </Typography>
            <ReviewsList reviews={item.reviews} totalCount={item.reviewCount || item.reviews.length} />
          </Box>
        )}
      </div>

      <Stack spacing={1} className="detail-actions">
        <Button
          variant="contained"
          fullWidth
          startIcon={<AddIcon />}
          onClick={handleAddClick}
          disabled={isUnavailable}
        >
          Add to Design
        </Button>
        {onMessageVendor && (
          <Button variant="outlined" fullWidth startIcon={<ChatBubbleOutlineIcon />} onClick={handleMessage}>
            Message Vendor
          </Button>
        )}
        {hasModels && (
          <Button variant="text" fullWidth onClick={handleOpen3D}>
            See this item in 3D
          </Button>
        )}
      </Stack>

      <Dialog
        open={Boolean(imageLightbox)}
        onClose={() => setImageLightbox(null)}
        fullScreen
        PaperProps={{ sx: { backgroundColor: 'rgba(0,0,0,0.92)' } }}
      >
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <IconButton
            onClick={() => setImageLightbox(null)}
            aria-label="Close fullscreen"
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: 'white',
              backgroundColor: 'rgba(0,0,0,0.4)',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.6)' },
              zIndex: 1,
            }}
          >
            <CloseIcon />
          </IconButton>
          <Box
            component="img"
            src={imageLightbox || ''}
            alt="Fullscreen preview"
            sx={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'white',
              backgroundColor: 'rgba(0,0,0,0.6)',
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
            }}
          >
            Press Esc or click the X to close
          </Typography>
        </Box>
      </Dialog>

    </div>
  );
};

CatalogDetailPanel.propTypes = {
  item: PropTypes.object,
  onBack: PropTypes.func,
  onAdd: PropTypes.func,
  onMessageVendor: PropTypes.func,
  onShow3D: PropTypes.func,
};

export default CatalogDetailPanel;

