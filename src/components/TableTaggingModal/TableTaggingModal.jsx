import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import { apiFetch } from '../../lib/api';

const TableTaggingModal = ({ open, onClose, placement, venueDesignId, projectId, onTagUpdate }) => {
  const [availableServices, setAvailableServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [currentTags, setCurrentTags] = useState([]);

  // Load available services with per_table pricing
  useEffect(() => {
    if (!open || !projectId) return;

    const loadServices = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch catalog items and filter for per_table pricing
        const response = await apiFetch(`/venue-designs/${projectId}/catalog`);
        const services = (response.listings || []).filter(
          (service) => service.pricingPolicy === 'per_table' && service.isActive
        );
        setAvailableServices(services);

        // Load current tags from placement
        const tags = placement?.serviceListingIds || [];
        setCurrentTags(tags);
        setSelectedServiceIds(tags);
      } catch (err) {
        setError(err.message || 'Failed to load services');
      } finally {
        setLoading(false);
      }
    };

    loadServices();
  }, [open, projectId, placement]);

  const handleServiceToggle = (serviceId) => {
    setSelectedServiceIds((prev) => {
      if (prev.includes(serviceId)) {
        return prev.filter((id) => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  const handleSave = async () => {
    if (!venueDesignId || !placement) return;

    setSaving(true);
    setError('');

    try {
      const { tagTables, untagTables } = require('../../lib/api');

      // Determine which services to add and which to remove
      const toAdd = selectedServiceIds.filter((id) => !currentTags.includes(id));
      const toRemove = currentTags.filter((id) => !selectedServiceIds.includes(id));

      // Tag new services
      if (toAdd.length > 0) {
        await tagTables(venueDesignId, [placement.id], toAdd);
      }

      // Untag removed services
      if (toRemove.length > 0) {
        await untagTables(venueDesignId, [placement.id], toRemove);
      }

      // Tags are saved on the backend
      // Call onTagUpdate to notify parent that tags were updated and reload design
      if (onTagUpdate) {
        await onTagUpdate(placement.id);
      }

      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update tags');
    } finally {
      setSaving(false);
    }
  };

  const isTable = placement?.designElement?.elementType === 'table' || 
                  placement?.elementType === 'table' ||
                  placement?.designElement?.name?.toLowerCase().includes('table');

  if (!isTable) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h6">Tag Table with Services</Typography>
          {currentTags.length > 0 && (
            <Chip label={`${currentTags.length} tagged`} size="small" color="primary" />
          )}
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select services with <strong>per_table</strong> pricing that should count this table. 
          This affects pricing calculations when booking these services.
        </Typography>

        <Divider sx={{ my: 2 }} />

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : availableServices.length === 0 ? (
          <Alert severity="info">
            No services with per_table pricing found. Add services with per_table pricing to tag tables.
          </Alert>
        ) : (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Available Services ({availableServices.length})
            </Typography>
            <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
              {availableServices.map((service) => (
                <FormControlLabel
                  key={service.id}
                  control={
                    <Checkbox
                      checked={selectedServiceIds.includes(service.id)}
                      onChange={() => handleServiceToggle(service.id)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {service.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {service.vendor?.user?.name || service.vendor?.name || 'Vendor'} • 
                        RM{parseFloat(service.price || 0).toFixed(2)} per table
                      </Typography>
                    </Box>
                  }
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'flex-start',
                    mb: 1,
                    width: '100%',
                    '& .MuiFormControlLabel-label': {
                      flex: 1,
                    },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={saving || loading}
          sx={{ 
            backgroundColor: '#e16789',
            '&:hover': { backgroundColor: '#d45678' },
          }}
        >
          {saving ? <CircularProgress size={20} /> : 'Save Tags'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TableTaggingModal;

