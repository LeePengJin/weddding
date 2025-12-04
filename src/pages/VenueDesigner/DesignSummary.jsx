import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Paper,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import LockIcon from '@mui/icons-material/Lock';
import './DesignSummary.styles.css';
import { useVenueDesigner } from './VenueDesignerContext';
import ConfirmationDialog from '../../components/ConfirmationDialog/ConfirmationDialog';

const DesignSummary = ({ open, onClose, onProceedToCheckout, eventStartTime, eventEndTime }) => {
  const {
    placements = [],
    projectServices = [],
    availabilityMap = {},
    onRemovePlacement,
    onRemoveProjectService,
    onReloadDesign,
    projectId,
    venueInfo,
  } = useVenueDesigner();

  // Calculate event duration in hours
  const eventDuration = React.useMemo(() => {
    if (!eventStartTime || !eventEndTime) return null;
    try {
      const start = new Date(eventStartTime);
      const end = new Date(eventEndTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
      const durationMs = end - start;
      const durationHours = durationMs / (1000 * 60 * 60);
      return Math.round(durationHours * 100) / 100; // Round to 2 decimal places
    } catch (err) {
      return null;
    }
  }, [eventStartTime, eventEndTime]);
  const [expandedVendors, setExpandedVendors] = useState(new Set());
  const [confirmationDialog, setConfirmationDialog] = useState({
    open: false,
    title: '',
    description: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: null,
  });

  const openConfirmationDialog = ({ title, description, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm }) => {
    setConfirmationDialog({
      open: true,
      title,
      description,
      confirmText,
      cancelText,
      onConfirm,
    });
  };

  const handleCloseConfirmation = () => {
    setConfirmationDialog((prev) => ({ ...prev, open: false }));
  };

  const handleConfirmAction = () => {
    if (typeof confirmationDialog.onConfirm === 'function') {
      confirmationDialog.onConfirm();
    }
    handleCloseConfirmation();
  };

  const handleToggleVendor = (vendorId) => {
    const newExpanded = new Set(expandedVendors);
    if (newExpanded.has(vendorId)) {
      newExpanded.delete(vendorId);
    } else {
      newExpanded.add(vendorId);
    }
    setExpandedVendors(newExpanded);
  };
  const itemGroups = useMemo(() => {
    const groups = new Map();

    // 3D placements
    placements.forEach((placement) => {
      const bundleId = placement.metadata?.bundleId;
      const serviceListingId = placement.metadata?.serviceListingId;
      const designElementName = placement.designElement?.name || placement.serviceListing?.name || 'Service Item';
      const groupKey = bundleId
        ? `bundle_${serviceListingId}`
        : `item_${placement.designElement?.id || placement.id || serviceListingId}`;

      if (!groups.has(groupKey)) {
        const isBundle = Boolean(bundleId);
        // For non-3D items (no designElement), use service listing name
        const itemName = isBundle 
          ? placement.serviceListing?.name || 'Bundle Item' 
          : (placement.designElement ? designElementName : (placement.serviceListing?.name || 'Service Item'));

        groups.set(groupKey, {
          key: groupKey,
          isBundle,
          name: itemName,
          quantity: 0,
          price: 0,
          placementIds: [],
          bundleInstanceRefs: new Map(),
          singlePlacementQueue: [],
          serviceListingId: serviceListingId || null,
          serviceListing: placement.serviceListing || null, // Include full serviceListing data
          designElementId: placement.designElement?.id || null,
          isUnavailable: false,
          vendorId: placement.designElement?.vendorId || placement.serviceListing?.vendorId,
          vendorName:
            placement.designElement?.vendor?.name ||
            placement.designElement?.vendor?.user?.name ||
            placement.serviceListing?.vendor?.name ||
            placement.serviceListing?.vendor?.user?.name ||
            'Unknown Vendor',
        });
      }

      const group = groups.get(groupKey);
      group.placementIds.push(placement.id);

      if (bundleId) {
        if (!group.bundleInstanceRefs.has(bundleId)) {
          group.bundleInstanceRefs.set(bundleId, placement.id);
          group.quantity += 1;
          const price = placement.metadata?.unitPrice
            ? parseFloat(placement.metadata.unitPrice)
            : placement.serviceListing?.price
            ? parseFloat(placement.serviceListing.price)
            : 0;
          group.price += price;
        }
      } else {
        group.quantity += 1;
        group.singlePlacementQueue.push(placement.id);
        const price = placement.metadata?.unitPrice
          ? parseFloat(placement.metadata.unitPrice)
          : placement.serviceListing?.price
          ? parseFloat(placement.serviceListing.price)
          : 0;
        group.price += price;
      }

      if (serviceListingId && availabilityMap[serviceListingId]?.available === false) {
        group.isUnavailable = true;
      }
    });

    // Non-3D project services (no placements, grouped by service listing)
    projectServices.forEach((ps) => {
      const groupKey = `service_${ps.serviceListingId}`;
      const listing = ps.serviceListing || {};

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          isBundle: false,
          name: listing.name || 'Service Item',
          quantity: 0,
          price: 0,
          placementIds: [],
          bundleInstanceRefs: new Map(),
          singlePlacementQueue: [],
          serviceListingId: ps.serviceListingId,
          serviceListing: listing || null, // Include full serviceListing data
          designElementId: null,
          isUnavailable: false,
          vendorId: listing.vendor?.id,
          vendorName:
            listing.vendor?.name ||
            listing.vendor?.user?.name ||
            'Unknown Vendor',
          isNon3DService: true,
          isBooked: ps.isBooked,
        });
      }

      const group = groups.get(groupKey);
      
      // For per_table services, count the number of tables tagged with this service
      // For other services, use the ProjectService quantity
      const isPerTable = listing.pricingPolicy === 'per_table';
      let quantity;
      
      if (isPerTable) {
        // Count placements (tables) that have this service in their serviceListingIds
        const tableCount = placements.filter((placement) => {
          const isTable = 
            placement?.designElement?.elementType === 'table' ||
            placement?.elementType === 'table' ||
            placement?.designElement?.name?.toLowerCase().includes('table');
          
          if (!isTable) return false;
          
          const serviceListingIds = placement.serviceListingIds || [];
          return serviceListingIds.includes(ps.serviceListingId);
        }).length;
        
        quantity = tableCount; // Use table count (will be 0 if no tables tagged)
        group.isPerTableService = true; // Mark as per_table service
      } else {
        // For non-per_table services, use the ProjectService quantity
        quantity = ps.quantity || 1;
      }
      
      group.quantity = quantity; // Set quantity (don't add, replace)
      
      // Calculate price based on pricing policy
      if (listing.pricingPolicy === 'time_based' && listing.hourlyRate && eventDuration !== null) {
        // For time-based, price = hourlyRate * eventDuration (not multiplied by quantity)
        const hourlyRate = parseFloat(listing.hourlyRate);
        const totalPrice = hourlyRate * eventDuration;
        group.price = totalPrice; // For time-based, price is already total (not per unit)
        group.eventDuration = eventDuration; // Store duration for display
        group.hourlyRate = hourlyRate; // Store hourly rate for display
        group.isTimeBased = true; // Mark as time-based for display
      } else {
        // For other pricing policies, use base price * quantity
        const price = listing.price ? parseFloat(listing.price) : 0;
        group.price = price * quantity;
      }

      if (ps.serviceListingId && availabilityMap[ps.serviceListingId]?.available === false) {
        group.isUnavailable = true;
      }
    });

    // Add venue as a separate item if it exists
    // Handle both id and listingId for backward compatibility
    const venueId = venueInfo?.id || venueInfo?.listingId;
    if (venueInfo && venueId) {
      const venueKey = `venue_${venueId}`;
      if (!groups.has(venueKey)) {
        groups.set(venueKey, {
          key: venueKey,
          isBundle: false,
          name: venueInfo.name || 'Venue',
          quantity: 1, // Venue is always quantity 1
          price: venueInfo.price ? parseFloat(venueInfo.price) : 0,
          placementIds: [],
          bundleInstanceRefs: new Map(),
          singlePlacementQueue: [],
          serviceListingId: venueId,
          serviceListing: {
            ...venueInfo,
            id: venueId, // Ensure id is set
          }, // Include full venue serviceListing data
          designElementId: venueInfo.designElement?.id || null,
          isUnavailable: false,
          vendorId: venueInfo.vendor?.userId || venueInfo.vendor?.id || venueInfo.vendorId,
          vendorName:
            venueInfo.vendor?.name ||
            venueInfo.vendor?.user?.name ||
            'Unknown Vendor',
          isNon3DService: false,
          isVenue: true, // Mark as venue
          isBooked: false, // Venue booking status would need to be checked separately
        });
      }
    }

    return Array.from(groups.values()).map((group) => ({
      ...group,
      bundleInstances: Array.from(group.bundleInstanceRefs.entries()).map(([bundleId, placementId]) => ({
        bundleId,
        placementId,
      })),
    }));
  }, [placements, projectServices, availabilityMap, venueInfo]);

  // Group items by vendor
  const groupedByVendor = useMemo(() => {
    const vendorGroups = {};

    itemGroups.forEach((item) => {
      const vendorKey = item.vendorId || item.vendorName;

      if (!vendorGroups[vendorKey]) {
        vendorGroups[vendorKey] = {
          vendorId: item.vendorId,
          vendorName: item.vendorName,
          items: [],
          total: 0,
        };
      }

      // Format display name with quantity
      const displayName = item.quantity > 1 
        ? `${item.name} x ${item.quantity}`
        : item.name;

      vendorGroups[vendorKey].items.push({
        ...item,
        displayName,
      });

      vendorGroups[vendorKey].total += item.price;
    });

    return Object.values(vendorGroups);
  }, [itemGroups]);

  const grandTotal = useMemo(() => {
    return groupedByVendor.reduce((sum, vendor) => sum + vendor.total, 0);
  }, [groupedByVendor]);

  const totalItems = itemGroups.reduce((sum, item) => sum + item.quantity, 0);
  const totalVendors = groupedByVendor.length;

  const handleRemove = async (item) => {
    // Prevent removal of venue
    if (item.isVenue) {
      window.alert('The venue cannot be removed from the design summary. To change the venue, please update your project settings.');
      return;
    }
    
    // Handle non-3D services (ProjectService entries)
    if (item.isNon3DService) {
      // For per_table services, warn that tables need to be untagged first
      if (item.isPerTableService && item.quantity > 0) {
        window.alert(
          'This service uses per-table pricing and has tables tagged.\n\n' +
          'Please untag all tables first by clicking on each table in the 3D design and unchecking this service.\n\n' +
          'Once all tables are untagged, you can remove the service from the project.'
        );
        return;
      }
      
      if (!onRemoveProjectService || !projectId || !item.serviceListingId) {
        window.alert('Unable to remove this service. Please try again.');
        return;
      }
      
      if (item.isBooked) {
        window.alert('This service is linked to a booking and cannot be removed.');
        return;
      }

      openConfirmationDialog({
        title: 'Remove Service from Project?',
        description: `Remove "${item.name}" from your project? This will remove it from the design summary.`,
        confirmText: 'Remove Service',
        onConfirm: async () => {
          try {
            await onRemoveProjectService(item.serviceListingId);
          } catch (err) {
            window.alert(err.message || 'Failed to remove service from project');
          }
        },
      });
      return;
    }
    
    // Handle 3D placements
    if (!onRemovePlacement) return;

    openConfirmationDialog({
      title: 'Remove Service from Design?',
      description: 'Remove this service from your 3D design?',
      confirmText: 'Remove Service',
      onConfirm: () => {
        if (item.isBundle && item.bundleInstances?.length > 0) {
          item.bundleInstances.forEach((instance) => {
            if (instance?.placementId) {
              onRemovePlacement(instance.placementId, 'bundle');
            }
          });
        } else if (!item.isBundle && item.placementIds.length > 0) {
          item.placementIds.forEach((placementId) => {
            onRemovePlacement(placementId, 'single');
          });
        }
      },
    });
  };

  const handleDecreaseQuantity = async (item) => {
    // Handle non-3D services (ProjectService entries)
    if (item.isNon3DService) {
      // For per_table services, quantity is controlled by table tagging
      // Users cannot manually change the quantity
      if (item.isPerTableService) {
        window.alert(
          'This service uses per-table pricing. Quantity is automatically calculated from the number of tagged tables.\n\n' +
          'To change the quantity, tag or untag tables in the 3D design by clicking on a table and selecting "Tag Services".'
        );
        return;
      }
      
      if (!projectId || !item.serviceListingId) {
        window.alert('Unable to modify this service. Please try again.');
        return;
      }
      
      if (item.isBooked) {
        window.alert('This service is linked to a booking and cannot be modified.');
        return;
      }
      
      const isFinalUnit = item.quantity <= 1;

      // If reducing will NOT remove the service entirely, do it directly without confirmation
      if (!isFinalUnit) {
        try {
          const { updateProjectServiceQuantity } = await import('../../lib/api');
          await updateProjectServiceQuantity(projectId, item.serviceListingId, item.quantity - 1);
          if (onReloadDesign) {
            await onReloadDesign();
          }
        } catch (err) {
          window.alert(err.message || 'Failed to update service quantity');
        }
        return;
      }

      // Final unit: confirm because this will remove the service from the project
      openConfirmationDialog({
        title: 'Remove Service from Project?',
        description: 'Reducing this item will remove it entirely from your project.',
        confirmText: 'Remove Service',
        onConfirm: async () => {
          try {
            const { deleteProjectService } = await import('../../lib/api');
            await deleteProjectService(projectId, item.serviceListingId);
            if (onReloadDesign) {
              await onReloadDesign();
            }
          } catch (err) {
            window.alert(err.message || 'Failed to update service quantity');
          }
        },
      });
      return;
    }
    
    // Handle 3D placements
    if (!onRemovePlacement || item.quantity <= 0) return;

    const isFinalUnit3D = item.quantity <= 1;

    // If reducing will NOT remove the service entirely from the design, do it directly
    if (!isFinalUnit3D) {
      if (item.isBundle) {
        const targetInstance = item.bundleInstances?.[0];
        if (targetInstance?.placementId) {
          onRemovePlacement(targetInstance.placementId, 'bundle');
        }
      } else {
        const targetPlacementId = item.singlePlacementQueue?.[0] || item.placementIds?.[0];
        if (targetPlacementId) {
          onRemovePlacement(targetPlacementId, 'single');
        }
      }
      return;
    }

    // Final unit: confirm because this will remove the service from the design
    openConfirmationDialog({
      title: 'Remove From Design?',
      description: 'Reducing this item will remove it entirely from your design.',
      confirmText: 'Remove From Design',
      onConfirm: () => {
        if (item.isBundle) {
          const targetInstance = item.bundleInstances?.[0];
          if (targetInstance?.placementId) {
            onRemovePlacement(targetInstance.placementId, 'bundle');
          }
        } else {
          const targetPlacementId = item.singlePlacementQueue?.[0] || item.placementIds?.[0];
          if (targetPlacementId) {
            onRemovePlacement(targetPlacementId, 'single');
          }
        }
      },
    });
  };

  const handleProceed = () => {
    if (onProceedToCheckout) {
      onProceedToCheckout();
    }
  };

  if (!open) return null;

  return (
    <>
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth 
      PaperProps={{ 
        sx: { 
          borderRadius: 2,
          maxHeight: '90vh',
          height: 'auto',
        } 
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h5" component="h2" sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>
          Design Summary
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, flex: 1, minHeight: 500, maxHeight: 'calc(90vh - 80px)' }}>
          {/* Items List */}
          <Box 
            sx={{ 
              flex: { xs: '1 1 auto', md: '1 1 60%' }, 
              overflowY: 'auto',
              overflowX: 'hidden',
              maxHeight: { xs: '50vh', md: 'calc(90vh - 80px)' },
              minHeight: { xs: '300px', md: '500px' },
            }}
          >
            {groupedByVendor.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body1">No items in your design yet</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Add items from the catalog to see them here
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {groupedByVendor.map((vendor, vendorIndex) => {
                  const isExpanded = expandedVendors.has(vendor.vendorId || vendor.vendorName);
                  return (
                    <React.Fragment key={vendor.vendorId || vendor.vendorName}>
                      <ListItem
                        sx={{
                          bgcolor: 'grey.50',
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          py: 1.5,
                          px: 2,
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: 'grey.100',
                          },
                        }}
                        onClick={() => handleToggleVendor(vendor.vendorId || vendor.vendorName)}
                      >
                        <IconButton
                          size="small"
                          sx={{ mr: 1 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleVendor(vendor.vendorId || vendor.vendorName);
                          }}
                        >
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {vendor.vendorName}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              {vendor.items.length} {vendor.items.length === 1 ? 'item' : 'items'}
                            </Typography>
                          }
                        />
                        <Chip
                          label={`RM ${vendor.total.toLocaleString()}`}
                          size="small"
                          color="primary"
                          sx={{ fontWeight: 600 }}
                        />
                      </ListItem>

                      {isExpanded &&
                        vendor.items.map((item, itemIndex) => (
                          <ListItem
                            key={item.key}
                            sx={{
                              borderBottom: itemIndex < vendor.items.length - 1 ? '1px solid' : 'none',
                              borderColor: 'divider',
                              py: 1.5,
                              px: 2,
                              pl: 6, // Indent items under vendor
                            }}
                          >
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                  <Typography variant="body2">{item.displayName}</Typography>
                                  {item.isUnavailable && (
                                    <Chip label="Unavailable" size="small" color="warning" variant="outlined" />
                                  )}
                                  {item.isVenue && (
                                    <Chip label="Venue" size="small" color="primary" variant="outlined" />
                                  )}
                                  {item.isNon3DService && (
                                    <Chip label="No 3D model" size="small" color="default" variant="outlined" />
                                  )}
                                  {item.isPerTableService && item.quantity === 0 && (
                                    <Tooltip title="No tables tagged yet. Click on tables in the 3D design and select 'Tag Services' to tag this service.">
                                      <Chip 
                                        label="No tables tagged" 
                                        size="small" 
                                        color="warning" 
                                        variant="outlined"
                                        sx={{ borderStyle: 'dashed' }}
                                      />
                                    </Tooltip>
                                  )}
                                  {item.isBooked && (
                                    <Tooltip title="This item is linked to a booking and cannot be removed">
                                      <LockIcon
                                        fontSize="small"
                                        sx={{ color: 'success.main' }}
                                      />
                                    </Tooltip>
                                  )}
                                </Box>
                              }
                              secondary={
                                <Typography variant="caption" color="text.secondary">
                                  {item.serviceListing?.pricingPolicy === 'time_based' && item.eventDuration !== undefined
                                    ? `${item.eventDuration} hours × RM${item.hourlyRate?.toLocaleString()}/hr`
                                    : item.isVenue ? 'Venue' : item.isBundle ? 'Bundle' : 'Individual Item'}
                                </Typography>
                              }
                            />
                            <ListItemSecondaryAction
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                              }}
                            >
                              <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Tooltip 
                                  title={
                                    item.isPerTableService 
                                      ? "Quantity is automatically calculated from tagged tables. Tag or untag tables in the 3D design to change quantity."
                                      : "Reduce quantity"
                                  }
                                >
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleDecreaseQuantity(item)}
                                      disabled={
                                        item.quantity === 0 || 
                                        item.isBooked || 
                                        item.isPerTableService || // Disable for per_table services
                                        item.isVenue // Disable for venue
                                      }
                                      sx={{ color: 'text.secondary' }}
                                    >
                                      <RemoveCircleOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>
                                  {item.quantity}
                                </Typography>
                                {item.isPerTableService && (
                                  <Tooltip title="Quantity based on tagged tables">
                                    <Chip 
                                      label="per table" 
                                      size="small" 
                                      sx={{ 
                                        height: 18, 
                                        fontSize: '0.65rem',
                                        ml: 0.5 
                                      }} 
                                    />
                                  </Tooltip>
                                )}
                              </Stack>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                RM {item.price.toLocaleString()}
                              </Typography>
                              <IconButton
                                edge="end"
                                onClick={() => handleRemove(item)}
                                size="small"
                                aria-label="Remove item"
                                sx={{ color: 'error.main' }}
                                disabled={item.isBooked || item.isVenue}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </ListItemSecondaryAction>
                          </ListItem>
                        ))}

                      {vendorIndex < groupedByVendor.length - 1 && <Divider />}
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </Box>

          {/* Summary Sidebar */}
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
                    Total Items
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {totalItems}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Vendors
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {totalVendors}
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

            <Box sx={{ mt: 'auto', pt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
                <i className="fas fa-info-circle" style={{ fontSize: '0.875rem' }}></i>
                Prices and availability will be confirmed by vendors during checkout.
              </Typography>

              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handleProceed}
                disabled={totalItems === 0}
                sx={{
                  bgcolor: 'primary.main',
                  '&:hover': { bgcolor: 'primary.dark' },
                  py: 1.5,
                  fontWeight: 600,
                }}
              >
                Proceed to Checkout
              </Button>
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>

    <ConfirmationDialog
      open={confirmationDialog.open}
      onClose={handleCloseConfirmation}
      onConfirm={handleConfirmAction}
      title={confirmationDialog.title}
      description={confirmationDialog.description}
      confirmText={confirmationDialog.confirmText}
      cancelText={confirmationDialog.cancelText}
    />
    </>
  );
};

DesignSummary.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onProceedToCheckout: PropTypes.func,
};

export default DesignSummary;

