import React from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Model3DViewer from '../Model3DViewer/Model3DViewer';

const Listing3DDialog = ({ open, item, modelSrc, onClose, onRefreshCatalog, catalogItems }) => {
  // Use the same approach as CatalogDetailPanel: look up item from catalogItems
  // This ensures we always have the latest data with designElement and dimensions
  const currentItem = React.useMemo(() => {
    if (!item?.id) return item;
    
    // First, try to find the item in catalogItems (which has designElement)
    if (catalogItems && catalogItems.length > 0) {
      const catalogItem = catalogItems.find((catalogItem) => catalogItem.id === item.id);
      if (catalogItem) {
        return catalogItem; // Use the catalog item which has designElement
      }
    }
    
    // Fallback to the passed item
    return item;
  }, [item, catalogItems]);

  // Use the EXACT same approach as CatalogDetailPanel: create modelSources
  const modelSources = React.useMemo(() => {
    if (!currentItem) return [];
    const list = [];
    const primary = currentItem.designElement?.modelFile || currentItem.modelFile;
    if (primary) {
      list.push({ 
        src: primary, 
        label: currentItem.designElement?.name || currentItem.name || '3D Model',
        dimensions: currentItem.designElement?.dimensions || currentItem.dimensions,
      });
    }
    if (Array.isArray(currentItem.components)) {
      currentItem.components.forEach((component, index) => {
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
  }, [currentItem]);

  // Find the active model that matches modelSrc (same as CatalogDetailPanel)
  const activeModel = React.useMemo(() => {
    if (!modelSrc || !modelSources.length) return null;
    return modelSources.find((model) => model.src === modelSrc) || modelSources[0] || null;
  }, [modelSrc, modelSources]);

  // Create a stable key that changes when dimensions change (same as CatalogDetailPanel)
  const dimensionsKey = React.useMemo(() => {
    if (!activeModel) return `${modelSrc}-no-dimensions`;
    return `${activeModel.src}-${JSON.stringify(activeModel.dimensions)}`;
  }, [activeModel, modelSrc]);

  // Auto-refresh catalog if item doesn't have designElement when dialog opens
  React.useEffect(() => {
    if (open && item?.id && !currentItem?.designElement && onRefreshCatalog) {
      onRefreshCatalog().catch((err) => {
        console.error('[Listing3DDialog] Failed to refresh catalog:', err);
      });
    }
  }, [open, item?.id, currentItem?.designElement, onRefreshCatalog]);

  if (!item) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        View in 3D
        <IconButton onClick={onClose} aria-label="Close 3D view">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, minHeight: { xs: 420, md: 520 } }}
      >
        <Box sx={{ flex: { xs: '0 0 auto', md: '0 0 35%' }, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {currentItem.vendor?.name}
          </Typography>
          <Typography variant="h5">{currentItem.name}</Typography>
          <Typography variant="h6" color="primary">
            RM {Number(currentItem.price).toLocaleString()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {currentItem.description}
          </Typography>
        </Box>
        <Box sx={{ flex: { xs: '1 1 auto', md: '1 1 65%' }, height: { xs: 360, md: 520 } }}>
          <Model3DViewer 
            key={dimensionsKey}
            modelUrl={activeModel?.src || modelSrc} 
            height="100%" 
            width="100%" 
            borderless 
            autoRotate 
            targetDimensions={activeModel?.dimensions || null}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
};

Listing3DDialog.propTypes = {
  open: PropTypes.bool,
  item: PropTypes.object,
  modelSrc: PropTypes.string,
  onClose: PropTypes.func,
  onRefreshCatalog: PropTypes.func,
  catalogItems: PropTypes.array,
};

export default Listing3DDialog;

