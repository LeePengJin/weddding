import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  Link,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { createBooking, getCheckoutSummary } from '../../lib/api';

const CheckoutModal = ({ open, onClose, projectId, weddingDate, venueDesignId, eventStartTime, eventEndTime, onSuccess, onShowToast }) => {
  // Backend-driven checkout data
  const [checkoutData, setCheckoutData] = useState(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  
  // Track expanded vendors
  const [expandedVendors, setExpandedVendors] = useState(new Set());
  // Track selected listings by their key (item.key)
  const [selectedListings, setSelectedListings] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [contractAcknowledged, setContractAcknowledged] = useState(false);
  const [showContractDialog, setShowContractDialog] = useState(false);
  const hasInitialized = React.useRef(false);

  // Fetch checkout summary from backend when modal opens
  useEffect(() => {
    if (open && projectId) {
      setLoadingCheckout(true);
      getCheckoutSummary(projectId)
        .then((data) => {
          setCheckoutData(data);
          // Initialize selection/expansion based on venue-first rule
          if (data.groupedByVendor && data.groupedByVendor.length > 0 && !hasInitialized.current) {
            hasInitialized.current = true;
            const allListingKeys = new Set();
            const venueListingKeys = new Set();
            data.groupedByVendor.forEach((vendor) => {
              vendor.items.forEach((item) => {
                if (item.serviceListingId) {
                  allListingKeys.add(item.key);
                  if (item?.serviceListing?.category === 'Venue') {
                    venueListingKeys.add(item.key);
                  }
                }
              });
            });

            const hasVenueSelected = Boolean(data?.hasVenueSelected);
            const venueBooking = data?.venue?.booking || null;
            const venueRequested = Boolean(venueBooking?.isRequested);
            const venueAccepted = Boolean(venueBooking?.isAccepted);

            // Expand vendors based on step
            if (!hasVenueSelected) {
              setExpandedVendors(new Set());
              setSelectedListings(new Set());
              return;
            }

            if (!venueRequested) {
              // Step 1: venue booking request should be the only selectable thing initially
              setExpandedVendors(new Set(data.groupedByVendor.map((v) => v.vendorId || v.vendorName)));
              setSelectedListings(new Set(venueListingKeys));
              return;
            }

            if (venueRequested && !venueAccepted) {
              // Venue request exists but vendor hasn't accepted yet -> nothing else can be booked
              setExpandedVendors(new Set());
              setSelectedListings(new Set());
              return;
            }

            // Venue accepted -> allow normal checkout
            setExpandedVendors(new Set(data.groupedByVendor.map((v) => v.vendorId || v.vendorName)));
            setSelectedListings(allListingKeys);
          }
        })
        .catch((err) => {
          console.error('[CheckoutModal] Failed to fetch checkout summary:', err);
          if (onShowToast) {
            onShowToast({ open: true, message: err.message || 'Failed to load checkout data', severity: 'error' });
          }
        })
        .finally(() => {
          setLoadingCheckout(false);
        });
    }
  }, [open, projectId, onShowToast]);

  // Use backend-provided groupedByVendor
  const groupedByVendor = checkoutData?.groupedByVendor || [];
  const hasVenueSelected = Boolean(checkoutData?.hasVenueSelected);
  const venueBooking = checkoutData?.venue?.booking || null;
  const venueRequested = Boolean(venueBooking?.isRequested);
  const venueAccepted = Boolean(venueBooking?.isAccepted);

  const venueFirstBlockingReason = useMemo(() => {
    if (!hasVenueSelected) {
      return 'Please select a venue for this project first. You must book your venue before booking other services.';
    }
    if (venueRequested && !venueAccepted) {
      return 'Your venue booking request has been sent. Please wait for the venue vendor to accept (deposit stage) before booking other services.';
    }
    if (!venueRequested) {
      return 'Step 1: Book your venue first. After the venue vendor accepts, you can proceed to book other services.';
    }
    return null;
  }, [hasVenueSelected, venueRequested, venueAccepted]);

  const isVenueFirstBlocked = !hasVenueSelected || (venueRequested && !venueAccepted);

  const orderedVendors = useMemo(() => {
    const venueVendors = [];
    const otherVendors = [];
    groupedByVendor.forEach((vendor) => {
      const hasVenueItem = vendor.items?.some((it) => it?.serviceListing?.category === 'Venue');
      if (hasVenueItem) venueVendors.push(vendor);
      else otherVendors.push(vendor);
    });
    return [...venueVendors, ...otherVendors];
  }, [groupedByVendor]);

  const handleToggleVendor = (vendorId) => {
    const newExpanded = new Set(expandedVendors);
    if (newExpanded.has(vendorId)) {
      newExpanded.delete(vendorId);
    } else {
      newExpanded.add(vendorId);
    }
    setExpandedVendors(newExpanded);
  };

  const isVenueItem = (item) => item?.serviceListing?.category === 'Venue';
  const isItemSelectable = (item) => {
    if (!item?.serviceListingId) return false;
    // If no venue selected -> nothing can be booked from checkout yet
    if (!hasVenueSelected) return false;
    // If venue request exists but not accepted -> nothing can be booked from checkout yet
    if (venueRequested && !venueAccepted) return false;
    // If venue not requested yet -> only venue can be booked
    if (!venueRequested) return isVenueItem(item);
    // Venue accepted -> can book other services
    return true;
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
    const vendorItems = vendor.items.filter((item) => isItemSelectable(item));
    if (vendorItems.length === 0) return;
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
    orderedVendors.forEach((vendor) => {
      vendor.items.forEach((item) => {
        if (isItemSelectable(item)) {
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

  // Get selected listings grouped by vendor (prices already calculated by backend)
  const selectedVendorData = useMemo(() => {
    return orderedVendors
      .map((vendor) => {
        const selectedItems = vendor.items.filter((item) => selectedListings.has(item.key) && item.serviceListingId);
        if (selectedItems.length === 0) return null;

        return {
          ...vendor,
          items: selectedItems,
          total: selectedItems.reduce((sum, item) => sum + (item.price || 0), 0),
        };
      })
      .filter(Boolean);
  }, [orderedVendors, selectedListings]);

  const vendorsToSubmitPreview = useMemo(() => {
    if (!venueRequested) {
      return selectedVendorData.filter((v) => v.items.some((it) => isVenueItem(it)));
    }
    return selectedVendorData;
  }, [selectedVendorData, venueRequested]);

  const grandTotal = useMemo(() => {
    return vendorsToSubmitPreview.reduce((sum, vendor) => sum + vendor.total, 0);
  }, [vendorsToSubmitPreview]);

  // Check if all items in a vendor are selected
  const isVendorFullySelected = (vendor) => {
    const vendorItems = vendor.items.filter((item) => isItemSelectable(item));
    if (vendorItems.length === 0) return false;
    return vendorItems.every((item) => selectedListings.has(item.key));
  };

  // Check if some (but not all) items in a vendor are selected
  const isVendorPartiallySelected = (vendor) => {
    const vendorItems = vendor.items.filter((item) => isItemSelectable(item));
    if (vendorItems.length === 0) return false;
    const selectedCount = vendorItems.filter((item) => selectedListings.has(item.key)).length;
    return selectedCount > 0 && selectedCount < vendorItems.length;
  };

  const handleSubmit = async () => {
    if (!hasVenueSelected) {
      onShowToast?.({ open: true, message: 'Please select and book your venue first before booking other services.', severity: 'error' });
      return;
    }
    if (venueRequested && !venueAccepted) {
      onShowToast?.({ open: true, message: 'Please wait for your venue booking to be accepted before booking other services.', severity: 'error' });
      return;
    }

    if (selectedListings.size === 0) {
      if (onShowToast) {
        onShowToast({ open: true, message: 'Please select at least one listing to proceed', severity: 'error' });
      }
      return;
    }

    if (!contractAcknowledged) {
      if (onShowToast) {
        onShowToast({ open: true, message: 'Please acknowledge the contract terms before proceeding', severity: 'error' });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      // If venue is not requested yet, only allow submitting venue booking request(s).
      const vendorsToSubmit =
        !venueRequested
          ? selectedVendorData.filter((v) => v.items.some((it) => it?.serviceListing?.category === 'Venue'))
          : selectedVendorData;

      // Create booking requests for each selected vendor
      const bookingPromises = vendorsToSubmit.map((vendor) => {
        const selectedServices = vendor.items
          .filter((item) => {
            if (!item.serviceListingId || item.quantity <= 0) {
              return false;
            }
            // Backend already calculated the price, use it directly
            return (item.price || 0) > 0;
          })
          .map((item) => {
            return {
              serviceListingId: item.serviceListingId,
              quantity: item.quantity,
              totalPrice: item.price || 0,
            };
          });

        if (selectedServices.length === 0) {
          // Skip vendors with no valid services (e.g., per_table services with 0 tables tagged)
          return Promise.resolve(null);
        }

        if (!vendor.vendorId) {
          throw new Error(`Vendor "${vendor.vendorName}" is missing vendor ID`);
        }

        return createBooking({
          projectId: projectId || null,
          vendorId: vendor.vendorId,
          reservedDate: weddingDate ? new Date(weddingDate).toISOString() : new Date().toISOString(),
          selectedServices,
        });
      });

      // Filter out null results (vendors with no valid services)
      const validPromises = bookingPromises.filter(p => p !== null);
      
      if (validPromises.length === 0) {
        if (onShowToast) {
          onShowToast({ open: true, message: 'No services with valid pricing to book. Please ensure services are properly tagged or configured.', severity: 'error' });
        }
        setIsSubmitting(false);
        return;
      }

      await Promise.all(validPromises);

      setIsSubmitting(false);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Error creating booking requests:', error);
      if (onShowToast) {
        onShowToast({ open: true, message: error.message || 'Failed to create booking requests. Please try again.', severity: 'error' });
      }
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    if (isSubmitted && onSuccess) {
      onSuccess();
    }
    // Reset state when closing
    setSelectedListings(new Set());
    setExpandedVendors(new Set());
    setIsSubmitted(false);
    setContractAcknowledged(false);
    setShowContractDialog(false);
    setCheckoutData(null);
    onClose();
  };

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      hasInitialized.current = false; 
      setSelectedListings(new Set());
      setExpandedVendors(new Set());
      setIsSubmitted(false);
      setIsSubmitting(false); 
      setContractAcknowledged(false); 
      setShowContractDialog(false);
      setCheckoutData(null); 
    }
  }, [open]);

  if (!open) return null;

  if (loadingCheckout) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogContent sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            Loading checkout summary...
          </Typography>
        </DialogContent>
      </Dialog>
    );
  }

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
                orderedVendors.reduce((sum, v) => sum + v.items.filter((i) => isItemSelectable(i)).length, 0)
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </Box>

            {venueFirstBlockingReason && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 2,
                  borderRadius: 2,
                  bgcolor: '#FEF3C7', 
                  border: '1px solid #F59E0B',
                }}
              >
                <Typography variant="body2" sx={{ color: '#7C2D12', fontWeight: 700, mb: 0.5 }}>
                  Venue-first booking rule
                </Typography>
                <Typography variant="body2" sx={{ color: '#7C2D12' }}>
                  {venueFirstBlockingReason}
                </Typography>
              </Paper>
            )}

            <Stack spacing={2}>
              {orderedVendors.map((vendor) => {
                const vendorKey = vendor.vendorId || vendor.vendorName;
                const isExpanded = expandedVendors.has(vendorKey);
                const isVendorSelected = isVendorFullySelected(vendor);
                const isVendorIndeterminate = isVendorPartiallySelected(vendor);
                const vendorItems = vendor.items.filter((item) => item.serviceListingId);
                const vendorSelectableItems = vendorItems.filter((item) => isItemSelectable(item));
                const vendorCheckboxDisabled = vendorSelectableItems.length === 0;

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
                        disabled={vendorCheckboxDisabled}
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
                          const disabled = !isItemSelectable(item);
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
                                disabled={disabled}
                                onChange={(e) => {
                                  if (disabled) return;
                                  handleToggleListing(item.key, e);
                                }}
                              />
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {item.displayName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {item.serviceListing?.category === 'Venue'
                                    ? 'Venue (must be booked first)'
                                    : (item.isBundle ? 'Bundle' : 'Individual Item')}
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
                    {orderedVendors.reduce((sum, v) => sum + v.items.filter((i) => isItemSelectable(i)).length, 0)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Selected Vendors
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {vendorsToSubmitPreview.length} / {orderedVendors.length}
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

            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: '#DBEAFE', 
                borderRadius: 2,
                border: '1px solid #2563EB',
              }}
            >
              <Typography variant="body2" sx={{ color: '#0B2A6F', fontWeight: 600 }}>
                Submitting this request will notify all selected vendors. Prices and availability will be confirmed by
                vendors.
              </Typography>
            </Paper>

            {/* Contract Acknowledgment */}
            <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'grey.50' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={contractAcknowledged}
                    onChange={(e) => setContractAcknowledged(e.target.checked)}
                    required
                    sx={{ 
                      margin: 0,
                      padding: '4px',
                      '& .MuiSvgIcon-root': { 
                        fontSize: 24,
                        color: contractAcknowledged ? 'primary.main' : 'action.disabled'
                      } 
                    }}
                  />
                }
                label={
                  <Box sx={{ ml: 0.5 }}>
                    <Typography variant="body2" sx={{ lineHeight: 1.6, color: 'text.primary' }}>
                      <Typography component="span" sx={{ color: 'error.main', mr: 0.5 }}>*</Typography>
                      I have read and agree to the{' '}
                      <Link
                        component="button"
                        variant="body2"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowContractDialog(true);
                        }}
                        sx={{ 
                          textDecoration: 'underline', 
                          cursor: 'pointer',
                          color: 'primary.main',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          '&:hover': {
                            color: 'primary.dark',
                          }
                        }}
                      >
                        contract terms
                      </Link>
                      <span style={{ whiteSpace: 'nowrap' }}>, </span>
                      <Link
                        component="button"
                        variant="body2"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowContractDialog(true);
                        }}
                        sx={{ 
                          textDecoration: 'underline', 
                          cursor: 'pointer',
                          color: 'primary.main',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          '&:hover': {
                            color: 'primary.dark',
                          }
                        }}
                      >
                        payment schedule
                      </Link>
                      <span style={{ whiteSpace: 'nowrap' }}>, and </span>
                      <Link
                        component="button"
                        variant="body2"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowContractDialog(true);
                        }}
                        sx={{ 
                          textDecoration: 'underline', 
                          cursor: 'pointer',
                          color: 'primary.main',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          '&:hover': {
                            color: 'primary.dark',
                          }
                        }}
                      >
                        liability terms
                      </Link>
                      {' '}for all vendors listed above.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', m: 0, '& .MuiFormControlLabel-asterisk': { display: 'none' } }}
              />
            </Box>

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleSubmit}
              disabled={isSubmitting || vendorsToSubmitPreview.length === 0 || !contractAcknowledged || isVenueFirstBlocked}
              sx={{
                bgcolor: 'primary.main',
                '&:hover': { bgcolor: 'primary.dark' },
                py: 1.5,
                fontWeight: 600,
                mt: 2,
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

      {/* Contract Terms Dialog */}
      <Dialog open={showContractDialog} onClose={() => setShowContractDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h5" component="h2" sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>
            Contract Terms & Conditions
          </Typography>
          <IconButton onClick={() => setShowContractDialog(false)} size="small" aria-label="Close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={3}>
            {vendorsToSubmitPreview.map((vendor) => {
              const firstService = vendor.items[0];
              const cancellationPolicy = firstService?.serviceListing?.cancellationPolicy;
              const cancellationFeeTiers = firstService?.serviceListing?.cancellationFeeTiers;

              return (
                <Paper key={vendor.vendorId || vendor.vendorName} elevation={1} sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    {vendor.vendorName}
                  </Typography>
                  <Box sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'primary.main' }}>
                    <Stack spacing={2}>
                      {/* Services */}
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Services
                        </Typography>
                        <Stack spacing={0.5}>
                          {vendor.items.map((item, idx) => (
                            <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2">
                                {item.displayName || item.name || item.serviceListing?.name || 'Service'}
                              </Typography>
                              <Typography variant="body2" fontWeight="medium">
                                RM {item.price.toLocaleString()}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Box>

                      <Divider />

                      {/* Payment Schedule */}
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Payment Schedule
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>Deposit:</strong> 10% of total (RM {(vendor.total * 0.1).toLocaleString()}) due within 7 days of vendor acceptance
                        </Typography>
                        <Typography variant="body2">
                          <strong>Final Payment:</strong> Remaining 90% (RM {(vendor.total * 0.9).toLocaleString()}) due 1 week before wedding date
                        </Typography>
                      </Box>

                      <Divider />

                      {/* Cancellation Policy */}
                      {cancellationPolicy && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Cancellation Policy
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>
                            {cancellationPolicy}
                          </Typography>
                          {cancellationFeeTiers && (
                            <Box sx={{ mt: 1, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                Cancellation Fee Schedule:
                              </Typography>
                              <Stack spacing={0.5}>
                                {cancellationFeeTiers['>90'] !== undefined && (
                                  <Typography variant="caption">
                                    More than 90 days before: {(cancellationFeeTiers['>90'] * 100).toFixed(0)}%
                                  </Typography>
                                )}
                                {cancellationFeeTiers['30-90'] !== undefined && (
                                  <Typography variant="caption">
                                    30-90 days before: {(cancellationFeeTiers['30-90'] * 100).toFixed(0)}%
                                  </Typography>
                                )}
                                {cancellationFeeTiers['7-30'] !== undefined && (
                                  <Typography variant="caption">
                                    7-30 days before: {(cancellationFeeTiers['7-30'] * 100).toFixed(0)}%
                                  </Typography>
                                )}
                                {cancellationFeeTiers['<7'] !== undefined && (
                                  <Typography variant="caption">
                                    Less than 7 days before: {(cancellationFeeTiers['<7'] * 100).toFixed(0)}%
                                  </Typography>
                                )}
                              </Stack>
                            </Box>
                          )}
                        </Box>
                      )}

                      <Divider />

                      {/* Liability Terms */}
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Liability Terms
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {vendor.vendorName} is responsible for delivering the services as described. Any issues with service delivery should be resolved directly with the vendor. The platform acts as an intermediary and is not liable for vendor performance or service quality issues.
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                </Paper>
              );
            })}
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowContractDialog(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

CheckoutModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  projectId: PropTypes.string.isRequired,
  weddingDate: PropTypes.string,
  venueDesignId: PropTypes.string,
  eventStartTime: PropTypes.string,
  eventEndTime: PropTypes.string,
  onSuccess: PropTypes.func,
  onShowToast: PropTypes.func,
};

export default CheckoutModal;

