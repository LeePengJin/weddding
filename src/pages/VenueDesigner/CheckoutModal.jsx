import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Button,
  Divider,
  Checkbox,
  FormControlLabel,
  Paper,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { createBooking } from '../../lib/api';
import { usePricingCalculation } from '../../hooks/usePricingCalculation';

const CheckoutModal = ({ open, onClose, groupedByVendor = [], projectId, weddingDate, venueDesignId, eventStartTime, eventEndTime, onSuccess }) => {
  // Track expanded vendors
  const [expandedVendors, setExpandedVendors] = useState(new Set());
  // Track selected listings by their key (item.key)
  const [selectedListings, setSelectedListings] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [calculatedPrices, setCalculatedPrices] = useState(new Map());
  const [priceCalculationLoading, setPriceCalculationLoading] = useState(false);
  const hasInitialized = React.useRef(false);

  // Get all items for price calculation
  const allItems = useMemo(() => {
    return groupedByVendor.flatMap((vendor) => vendor.items.filter((item) => item.serviceListingId));
  }, [groupedByVendor]);

  // Calculate prices using the pricing engine
  const { prices: calculatedPricesFromHook, loading: pricesLoading } = usePricingCalculation(
    allItems,
    venueDesignId,
    eventStartTime ? new Date(eventStartTime) : null,
    eventEndTime ? new Date(eventEndTime) : null
  );

  // Update calculated prices when they're ready
  useEffect(() => {
    if (calculatedPricesFromHook.size > 0) {
      setCalculatedPrices(calculatedPricesFromHook);
      setPriceCalculationLoading(false);
    } else if (pricesLoading) {
      setPriceCalculationLoading(true);
    }
  }, [calculatedPricesFromHook, pricesLoading]);

  // Initialize: expand all vendors and select all listings when modal opens
  React.useEffect(() => {
    if (open && groupedByVendor.length > 0 && !hasInitialized.current) {
      // Only initialize once when modal first opens
      hasInitialized.current = true;
      // Expand all vendors
      setExpandedVendors(new Set(groupedByVendor.map((v) => v.vendorId || v.vendorName)));
      // Select all listings
      const allListingKeys = new Set();
      groupedByVendor.forEach((vendor) => {
        vendor.items.forEach((item) => {
          if (item.serviceListingId) {
            allListingKeys.add(item.key);
          }
        });
      });
      setSelectedListings(allListingKeys);
    }
  }, [open, groupedByVendor]);

  const handleToggleVendor = (vendorId) => {
    const newExpanded = new Set(expandedVendors);
    if (newExpanded.has(vendorId)) {
      newExpanded.delete(vendorId);
    } else {
      newExpanded.add(vendorId);
    }
    setExpandedVendors(newExpanded);
  };

  const handleToggleListing = (itemKey, e) => {
    e.stopPropagation(); // Prevent vendor toggle
    const newSelected = new Set(selectedListings);
    if (newSelected.has(itemKey)) {
      newSelected.delete(itemKey);
    } else {
      newSelected.add(itemKey);
    }
    setSelectedListings(newSelected);
  };

  const handleToggleVendorCheckbox = (vendor, e) => {
    e.stopPropagation(); // Prevent vendor expand/collapse
    const vendorItems = vendor.items.filter((item) => item.serviceListingId);
    const allSelected = vendorItems.every((item) => selectedListings.has(item.key));

    const newSelected = new Set(selectedListings);
    if (allSelected) {
      // Deselect all items from this vendor
      vendorItems.forEach((item) => newSelected.delete(item.key));
    } else {
      // Select all items from this vendor
      vendorItems.forEach((item) => newSelected.add(item.key));
    }
    setSelectedListings(newSelected);
  };

  const handleSelectAll = () => {
    const allListingKeys = new Set();
    groupedByVendor.forEach((vendor) => {
      vendor.items.forEach((item) => {
        if (item.serviceListingId) {
          allListingKeys.add(item.key);
        }
      });
    });

    if (selectedListings.size === allListingKeys.size) {
      setSelectedListings(new Set());
    } else {
      setSelectedListings(allListingKeys);
    }
  };

  // Get selected listings grouped by vendor with calculated prices
  const selectedVendorData = useMemo(() => {
    return groupedByVendor
      .map((vendor) => {
        const selectedItems = vendor.items
          .filter((item) => selectedListings.has(item.key) && item.serviceListingId)
          .map((item) => {
            // Use calculated price if available, otherwise fall back to item.price
            const calculatedPrice = calculatedPrices.get(item.serviceListingId);
            const price = calculatedPrice !== undefined ? calculatedPrice : item.price;
            return {
              ...item,
              price, // Override with calculated price
            };
          });
        if (selectedItems.length === 0) return null;

        return {
          ...vendor,
          items: selectedItems,
          total: selectedItems.reduce((sum, item) => sum + item.price, 0),
        };
      })
      .filter(Boolean);
  }, [groupedByVendor, selectedListings, calculatedPrices]);

  const grandTotal = useMemo(() => {
    return selectedVendorData.reduce((sum, vendor) => sum + vendor.total, 0);
  }, [selectedVendorData]);

  // Check if all items in a vendor are selected
  const isVendorFullySelected = (vendor) => {
    const vendorItems = vendor.items.filter((item) => item.serviceListingId);
    if (vendorItems.length === 0) return false;
    return vendorItems.every((item) => selectedListings.has(item.key));
  };

  // Check if some (but not all) items in a vendor are selected
  const isVendorPartiallySelected = (vendor) => {
    const vendorItems = vendor.items.filter((item) => item.serviceListingId);
    if (vendorItems.length === 0) return false;
    const selectedCount = vendorItems.filter((item) => selectedListings.has(item.key)).length;
    return selectedCount > 0 && selectedCount < vendorItems.length;
  };

  const handleSubmit = async () => {
    if (selectedListings.size === 0) {
      setSubmitError('Please select at least one listing to proceed');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Create booking requests for each selected vendor
      const bookingPromises = selectedVendorData.map((vendor) => {
        const selectedServices = vendor.items
          .filter((item) => item.serviceListingId) // Only include items with serviceListingId
          .map((item) => ({
            serviceListingId: item.serviceListingId,
            quantity: item.quantity,
            totalPrice: item.price,
          }));

        if (selectedServices.length === 0) {
          throw new Error(`No valid services found for ${vendor.vendorName}`);
        }

        return createBooking({
          projectId: projectId || null,
          vendorId: vendor.vendorId,
          reservedDate: weddingDate ? new Date(weddingDate).toISOString() : new Date().toISOString(),
          selectedServices,
        });
      });

      await Promise.all(bookingPromises);

      setIsSubmitted(true);
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        handleClose();
      }, 2000);
    } catch (error) {
      console.error('Error creating booking requests:', error);
      setSubmitError(error.message || 'Failed to create booking requests. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !isSubmitted) {
      // Reset state when closing
      setSelectedListings(new Set());
      setExpandedVendors(new Set());
      setSubmitError(null);
      setIsSubmitted(false);
      onClose();
    }
  };

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      hasInitialized.current = false; // Reset initialization flag
      setSelectedListings(new Set());
      setExpandedVendors(new Set());
      setSubmitError(null);
      setIsSubmitted(false);
    }
  }, [open]);

  if (!open) return null;

  if (isSubmitted) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogContent sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
            Booking Requests Sent!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            We've notified all selected vendors about your requests. You'll receive updates via email as vendors
            confirm your bookings.
          </Typography>
          <Box sx={{ textAlign: 'left', bgcolor: 'grey.50', p: 2, borderRadius: 1, mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Next Steps:
            </Typography>
            <Stack component="ol" spacing={1} sx={{ m: 0, pl: 2 }}>
              <Typography component="li" variant="body2">
                Vendors will review your requests
              </Typography>
              <Typography component="li" variant="body2">
                You'll receive confirmation emails
              </Typography>
              <Typography component="li" variant="body2">
                Proceed with payments once vendors confirm
              </Typography>
            </Stack>
          </Box>
          <Button variant="contained" onClick={handleClose} fullWidth>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '90vh',
          height: 'auto',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h5" component="h2" sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>
          Proceed to Checkout
        </Typography>
        <IconButton onClick={handleClose} size="small" aria-label="Close" disabled={isSubmitting}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, flex: 1, minHeight: 500 }}>
          {/* Left Column - Vendor Selection */}
          <Box
            sx={{
              flex: { xs: '1 1 auto', md: '1 1 60%' },
              overflowY: 'auto',
              overflowX: 'hidden',
              maxHeight: { xs: '50vh', md: 'calc(90vh - 200px)' },
              minHeight: { xs: '300px', md: '500px' },
              p: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Select Listings
              </Typography>
              <Button size="small" onClick={handleSelectAll}>
                {selectedListings.size ===
                groupedByVendor.reduce((sum, v) => sum + v.items.filter((i) => i.serviceListingId).length, 0)
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </Box>

            {submitError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
                {submitError}
              </Alert>
            )}

            <Stack spacing={2}>
              {groupedByVendor.map((vendor) => {
                const vendorKey = vendor.vendorId || vendor.vendorName;
                const isExpanded = expandedVendors.has(vendorKey);
                const isVendorSelected = isVendorFullySelected(vendor);
                const isVendorIndeterminate = isVendorPartiallySelected(vendor);
                const vendorItems = vendor.items.filter((item) => item.serviceListingId);

                return (
                  <Paper
                    key={vendorKey}
                    elevation={0}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Vendor Header */}
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: 'grey.50',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'grey.100',
                        },
                      }}
                      onClick={() => handleToggleVendor(vendorKey)}
                    >
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleVendor(vendorKey);
                        }}
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <Checkbox
                        checked={isVendorSelected}
                        indeterminate={isVendorIndeterminate}
                        onChange={(e) => handleToggleVendorCheckbox(vendor, e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {vendor.vendorName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {vendorItems.length} {vendorItems.length === 1 ? 'listing' : 'listings'}
                        </Typography>
                      </Box>
                      <Typography variant="h6" color="primary" sx={{ fontWeight: 600 }}>
                        RM {vendor.total.toLocaleString()}
                      </Typography>
                    </Box>

                    {/* Vendor Items (when expanded) */}
                    {isExpanded && (
                      <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                        {vendorItems.map((item, index) => {
                          const isItemSelected = selectedListings.has(item.key);
                          return (
                            <Box
                              key={item.key}
                              sx={{
                                p: 2,
                                pl: 6,
                                borderBottom: index < vendorItems.length - 1 ? '1px solid' : 'none',
                                borderColor: 'divider',
                                bgcolor: isItemSelected ? 'action.selected' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                '&:hover': {
                                  bgcolor: isItemSelected ? 'action.selected' : 'action.hover',
                                },
                              }}
                            >
                              <Checkbox
                                checked={isItemSelected}
                                onChange={(e) => handleToggleListing(item.key, e)}
                              />
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {item.displayName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {item.isBundle ? 'Bundle' : 'Individual Item'}
                                </Typography>
                              </Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                RM {item.price.toLocaleString()}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          </Box>

          {/* Right Column - Summary */}
          <Box
            sx={{
              flex: { xs: '0 0 auto', md: '0 0 40%' },
              borderLeft: { xs: 'none', md: '1px solid' },
              borderTop: { xs: '1px solid', md: 'none' },
              borderColor: 'divider',
              bgcolor: 'grey.50',
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              overflow: 'hidden',
              maxHeight: { xs: 'auto', md: 'calc(90vh - 80px)' },
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Summary
            </Typography>

            <Paper elevation={0} sx={{ p: 2, bgcolor: 'white', borderRadius: 1 }}>
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Selected Listings
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedListings.size} /{' '}
                    {groupedByVendor.reduce((sum, v) => sum + v.items.filter((i) => i.serviceListingId).length, 0)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Selected Vendors
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedVendorData.length} / {groupedByVendor.length}
                  </Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Total Amount
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    RM {grandTotal.toLocaleString()}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2" color="info.dark">
                Submitting this request will notify all selected vendors. Prices and availability will be confirmed by
                vendors.
              </Typography>
            </Paper>

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleSubmit}
              disabled={isSubmitting || selectedListings.size === 0}
              sx={{
                bgcolor: 'primary.main',
                '&:hover': { bgcolor: 'primary.dark' },
                py: 1.5,
                fontWeight: 600,
                mt: 'auto',
              }}
            >
              {isSubmitting ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                  Submitting...
                </>
              ) : (
                'Submit Booking Requests'
              )}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

CheckoutModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
          groupedByVendor: PropTypes.arrayOf(
    PropTypes.shape({
      vendorId: PropTypes.string,
      vendorName: PropTypes.string.isRequired,
      items: PropTypes.array.isRequired,
      total: PropTypes.number.isRequired,
    })
  ),
  projectId: PropTypes.string,
  weddingDate: PropTypes.string,
  venueDesignId: PropTypes.string,
  eventStartTime: PropTypes.string,
  eventEndTime: PropTypes.string,
  onSuccess: PropTypes.func,
};

export default CheckoutModal;

