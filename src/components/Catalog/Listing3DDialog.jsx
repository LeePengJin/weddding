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

const Listing3DDialog = ({ open, item, modelSrc, onClose }) => {
  if (!item) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">View in 3D</Typography>
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
            {item.vendor?.name}
          </Typography>
          <Typography variant="h5">{item.name}</Typography>
          <Typography variant="h6" color="primary">
            RM {Number(item.price).toLocaleString()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {item.description}
          </Typography>
        </Box>
        <Box sx={{ flex: { xs: '1 1 auto', md: '1 1 65%' }, height: { xs: 360, md: 520 } }}>
          <Model3DViewer modelUrl={modelSrc} height="100%" width="100%" borderless autoRotate />
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
};

export default Listing3DDialog;

