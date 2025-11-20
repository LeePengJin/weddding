import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, IconButton, Stack, Typography, Dialog, Box } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';
import { formatImageUrl } from '../../utils/image';
import Model3DViewer from '../Model3DViewer/Model3DViewer';
import './ServiceListingDetailsModal.css';

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
      list.push({ src: primary, label: item.designElement?.name || item.name || '3D Model' });
    }
    if (Array.isArray(item.components)) {
      item.components.forEach((component, index) => {
        const file = component?.designElement?.modelFile;
        if (file) {
          list.push({
            src: file,
            label: component?.designElement?.name || component?.name || `Component ${index + 1}`,
          });
        }
      });
    }
    return list;
  }, [item]);

  const hasImages = imageSources.length > 0;
  const hasModels = modelSources.length > 0;

  const [viewMode, setViewMode] = useState(hasImages ? 'images' : 'models');
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
              <Model3DViewer modelUrl={activeModel.src} height="100%" width="100%" borderless />
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
              <Typography variant="body2" color="text.secondary">
                No media available
              </Typography>
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
          <Typography variant="subtitle2" color="text.secondary">
            RM {Number(item.price).toLocaleString()}
          </Typography>
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
      </div>

      <Stack spacing={1} className="detail-actions">
        <Button variant="contained" fullWidth startIcon={<AddIcon />} onClick={() => onAdd?.(item)}>
          Add to Design
        </Button>
        <Button variant="outlined" fullWidth startIcon={<ChatBubbleOutlineIcon />} onClick={handleMessage}>
          Message Vendor
        </Button>
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

