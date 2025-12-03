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

  // Load available services with per_table pricing (only from project)
  useEffect(() => {
    if (!open || !projectId) return;

    const loadServices = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch services already added to the project
        const designResponse = await apiFetch(`/venue-designs/${projectId}`);

        // Get services from project (from ProjectService entries)
        // Include ALL per_table services, regardless of whether they have 3D models or not
        const projectServices = [];
        if (designResponse.projectServices) {
          designResponse.projectServices.forEach((ps) => {
            if (ps.serviceListing && 
                ps.serviceListing.pricingPolicy === 'per_table' && 
                ps.serviceListing.isActive) {
              // Ensure ID is a string and valid
              const serviceId = String(ps.serviceListing.id || '').trim();
              if (serviceId) {
                projectServices.push({
                  id: serviceId,
                  name: ps.serviceListing.name,
                  price: ps.serviceListing.price,
                  pricingPolicy: ps.serviceListing.pricingPolicy,
                  isActive: ps.serviceListing.isActive,
                  vendor: ps.serviceListing.vendor,
                  isBooked: ps.isBooked || false, // Include booked status
                  has3DModel: ps.serviceListing.has3DModel || false, // Track if service has 3D model
                });
              }
            }
          });
        }

        // Also check placements for services with per_table pricing
        // Extract serviceListingIds from placements metadata
        const placementServiceIds = new Set();
        if (designResponse.design?.placedElements) {
          designResponse.design.placedElements.forEach((placement) => {
            if (placement.serviceListingId) {
              placementServiceIds.add(placement.serviceListingId);
            }
          });
        }

        // Filtering is done after loading current tags (see above)

        // Load current tags from placement
        const tags = placement?.serviceListingIds || [];
        setCurrentTags(tags);
        
        // Filter services: 
        // - Hide booked services that are NOT currently tagged (can't add new booked services)
        // - Show booked services that ARE currently tagged (but disable unchecking)
        const currentTagIds = new Set(tags.map(id => String(id).trim()));
        const filteredServices = projectServices.filter((service) => {
          const serviceId = String(service.id).trim();
          // If booked and not currently tagged, hide it
          if (service.isBooked && !currentTagIds.has(serviceId)) {
            return false;
          }
          // Otherwise, show it
          return true;
        });
        
        setAvailableServices(filteredServices);
        setSelectedServiceIds(tags);
      } catch (err) {
        setError(err.message || 'Failed to load services');
      } finally {
        setLoading(false);
      }
    };

    loadServices();
  }, [open, projectId, placement]);

  const handleServiceToggle = (serviceId, isBooked, isCurrentlyTagged) => {
    // Prevent unchecking if service is booked and currently tagged
    if (isBooked && isCurrentlyTagged) {
      // If trying to uncheck a booked service that's currently tagged, prevent it
      if (selectedServiceIds.includes(serviceId)) {
        return; // Cannot uncheck booked services that are already tagged
      }
    }
    
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

      // Validate that all selected service IDs are valid UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      // Convert all selected IDs to strings and trim, then validate
      const validatedSelectedIds = selectedServiceIds
        .map(id => String(id || '').trim())
        .filter(id => id && uuidRegex.test(id));
      
      const invalidIds = selectedServiceIds
        .map(id => String(id || '').trim())
        .filter(id => id && !uuidRegex.test(id));
      
      if (invalidIds.length > 0) {
        console.error('Invalid service IDs:', { 
          invalidIds,
          selectedServiceIds,
          availableServices: availableServices.map(s => ({ id: s.id, idType: typeof s.id, name: s.name }))
        });
        throw new Error(`Invalid service ID format: ${invalidIds.join(', ')}. Please refresh and try again.`);
      }

      // IMPORTANT: tagTables REPLACES all existing tags with the provided list
      // So we need to send ALL selected services, not just the ones to add
      // This ensures existing tags are preserved and new ones are added
      if (validatedSelectedIds.length > 0) {
        await tagTables(venueDesignId, [placement.id], validatedSelectedIds);
      } else {
        // If no services are selected, we need to clear all tags
        // Get current tags and untag them all
        if (currentTags.length > 0) {
          const validatedCurrentTags = currentTags
            .map(id => String(id || '').trim())
            .filter(id => id && uuidRegex.test(id));
          if (validatedCurrentTags.length > 0) {
            await untagTables(venueDesignId, [placement.id], validatedCurrentTags);
          }
        }
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
              {availableServices.map((service) => {
                const serviceId = String(service.id).trim();
                const isChecked = selectedServiceIds.includes(serviceId);
                const isCurrentlyTagged = currentTags.includes(serviceId);
                const isBooked = service.isBooked || false;
                const isDisabled = isBooked && isCurrentlyTagged; // Disable unchecking booked services that are tagged
                
                return (
                  <FormControlLabel
                    key={service.id}
                    control={
                      <Checkbox
                        checked={isChecked}
                        onChange={() => handleServiceToggle(serviceId, isBooked, isCurrentlyTagged)}
                        disabled={isDisabled}
                      />
                    }
                    label={
                      <Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {service.name}
                          </Typography>
                          {isBooked && isCurrentlyTagged && (
                            <Chip 
                              label="Booked" 
                              size="small" 
                              color="warning" 
                              sx={{ height: 20, fontSize: '0.65rem' }}
                            />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {service.vendor?.user?.name || service.vendor?.name || 'Vendor'} • 
                          RM{parseFloat(service.price || 0).toFixed(2)} per table
                          {isDisabled && (
                            <span style={{ display: 'block', color: '#d32f2f', marginTop: 2 }}>
                              This service is booked and cannot be untagged
                            </span>
                          )}
                        </Typography>
                      </Box>
                    }
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'flex-start',
                      mb: 1,
                      width: '100%',
                      opacity: isDisabled ? 0.7 : 1,
                      '& .MuiFormControlLabel-label': {
                        flex: 1,
                      },
                    }}
                  />
                );
              })}
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

