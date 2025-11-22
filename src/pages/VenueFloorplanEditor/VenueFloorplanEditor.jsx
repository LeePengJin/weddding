import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Alert, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import BlueprintEditor from '../../components/BlueprintEditor/BlueprintEditor';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import './VenueFloorplanEditor.css';

/**
 * Vendor page for creating/editing venue 3D models from floorplans
 * 
 * This page allows vendors to:
 * 1. Draw a 2D floorplan
 * 2. Preview the 3D extrusion
 * 3. Export as GLB and save as the venue's designElement
 */
const VenueFloorplanEditor = () => {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [floorplanData, setFloorplanData] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [exportData, setExportData] = useState(null);

  // Load existing floorplan if editing
  const [initialFloorplan, setInitialFloorplan] = useState(null);

  React.useEffect(() => {
    if (listingId) {
      loadExistingListing();
    }
  }, [listingId]);

  const loadExistingListing = async () => {
    try {
      const listing = await apiFetch(`/service-listings/${listingId}`);
      if (listing.designElement?.modelFile) {
        // If there's an existing model, we could load the floorplan metadata
        // For now, we'll start fresh - vendors can re-draw or we can add
        // a feature to import existing floorplan JSON if stored
        console.log('Existing venue model found:', listing.designElement.modelFile);
      }
    } catch (err) {
      console.error('Error loading listing:', err);
    }
  };

  const handleFloorplanChange = useCallback((data) => {
    setFloorplanData(data);
  }, []);

  const handleExport = useCallback(async (exportData) => {
    setExportData(exportData);
    setShowConfirmDialog(true);
  }, []);

  const handleConfirmSave = async () => {
    if (!exportData) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Create FormData for file upload
      const formData = new FormData();
      
      // Convert GLB blob to File if needed
      let glbFile;
      if (exportData.glbBlob instanceof Blob) {
        glbFile = new File([exportData.glbBlob], exportData.glbFileName || 'venue-model.glb', {
          type: 'model/gltf-binary'
        });
      } else {
        // If it's already a File
        glbFile = exportData.glbBlob;
      }

      formData.append('model3D', glbFile);
      formData.append('name', 'Venue Floorplan Model');
      formData.append('elementType', 'Venue');
      
      // Store floorplan metadata as JSON string in a hidden field
      // We'll need to extend the API to accept this, or store it separately
      formData.append('floorplanMetadata', JSON.stringify(exportData.floorplan));

      if (listingId) {
        // Update existing listing
        // First, check if listing has a designElement
        const listing = await apiFetch(`/service-listings/${listingId}`);
        
        if (listing.designElementId) {
          // Update existing design element
          await apiFetch(`/design-elements/${listing.designElementId}/model3d`, {
            method: 'POST',
            body: formData,
          });
        } else {
          // Create new design element and link to listing
          const newElement = await apiFetch('/design-elements', {
            method: 'POST',
            body: formData,
          });

          await apiFetch(`/service-listings/${listingId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              designElementId: newElement.id,
            }),
          });
        }

        setSuccess('Venue model updated successfully!');
      } else {
        // Create new design element
        // Note: This creates a design element but doesn't create a listing
        // The vendor would need to create the listing separately and link it
        const newElement = await apiFetch('/design-elements', {
          method: 'POST',
          body: formData,
        });

        setSuccess('Venue model created successfully!');
        // Optionally navigate to create listing page with pre-filled designElementId
        setTimeout(() => {
          navigate(`/vendor/listings?designElementId=${newElement.id}`);
        }, 2000);
      }

      setShowConfirmDialog(false);
      setExportData(null);
    } catch (err) {
      console.error('Error saving venue model:', err);
      setError(err.message || 'Failed to save venue model');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <Box className="venue-floorplan-editor-page">
      <Box className="venue-floorplan-editor-header">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleCancel}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          {listingId ? 'Edit Venue Floorplan' : 'Create Venue from Floorplan'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ m: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ m: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Box className="venue-floorplan-editor-content">
        <BlueprintEditor
          onExport={handleExport}
          onFloorplanChange={handleFloorplanChange}
          initialFloorplan={initialFloorplan}
          textureDir="/rooms/textures"
        />
      </Box>

      {/* Confirmation Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Save Venue Model?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will {listingId ? 'update' : 'create'} the 3D venue model from your floorplan.
            {listingId ? ' The existing model will be replaced.' : ''}
          </Typography>
          {exportData && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Floorplan: {Object.keys(exportData.floorplan?.corners || {}).length} corners,{' '}
                {exportData.floorplan?.walls?.length || 0} walls
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmSave}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
            sx={{
              backgroundColor: '#e16789',
              '&:hover': { backgroundColor: '#d1537a' }
            }}
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VenueFloorplanEditor;

