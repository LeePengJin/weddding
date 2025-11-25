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
import './DesignSummary.styles.css';
import { useVenueDesigner } from './VenueDesignerContext';

const DesignSummary = ({ open, onClose, onProceedToCheckout }) => {
  const { placements = [], availabilityMap = {}, onRemovePlacement } = useVenueDesigner();
  const [expandedVendors, setExpandedVendors] = useState(new Set());

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

    placements.forEach((placement) => {
      const bundleId = placement.metadata?.bundleId;
      const serviceListingId = placement.metadata?.serviceListingId;
      const designElementName = placement.designElement?.name || 'Design Element';
      const groupKey = bundleId
        ? `bundle_${serviceListingId}`
        : `item_${placement.designElement?.id || placement.id}`;

      if (!groups.has(groupKey)) {
        const isBundle = Boolean(bundleId);
        const itemName = isBundle ? placement.serviceListing?.name || 'Bundle Item' : designElementName;

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
          designElementId: placement.designElement?.id || null,
          isUnavailable: false,
          vendorId: placement.designElement?.vendorId,
          vendorName:
            placement.designElement?.vendor?.name ||
            placement.designElement?.vendor?.user?.name ||
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

    return Array.from(groups.values()).map((group) => ({
      ...group,
      bundleInstances: Array.from(group.bundleInstanceRefs.entries()).map(([bundleId, placementId]) => ({
        bundleId,
        placementId,
      })),
    }));
  }, [placements, availabilityMap]);

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

  const handleRemove = (item) => {
    if (!onRemovePlacement) return;
    const confirmed = window.confirm('Remove this service from your 3D design?');
    if (!confirmed) return;

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
  };

  const handleDecreaseQuantity = (item) => {
    if (!onRemovePlacement || item.quantity <= 0) return;

    const isFinalUnit = item.quantity <= 1;
    const message = isFinalUnit
      ? 'Reducing this item will remove it entirely from your design. Continue?'
      : 'Remove one unit of this service from your design?';
    if (!window.confirm(message)) return;

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
  };

  const handleProceed = () => {
    if (onProceedToCheckout) {
      onProceedToCheckout();
    }
  };

  if (!open) return null;

  return (
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
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2">{item.displayName}</Typography>
                                  {item.isUnavailable && (
                                    <Chip label="Unavailable" size="small" color="warning" variant="outlined" />
                                  )}
                                </Box>
                              }
                              secondary={
                                <Typography variant="caption" color="text.secondary">
                                  {item.isBundle ? 'Bundle' : 'Individual Item'}
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
                                <Tooltip title="Reduce quantity">
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleDecreaseQuantity(item)}
                                      disabled={item.quantity === 0}
                                      sx={{ color: 'text.secondary' }}
                                    >
                                      <RemoveCircleOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>
                                  {item.quantity}
                                </Typography>
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
  );
};

DesignSummary.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onProceedToCheckout: PropTypes.func,
};

export default DesignSummary;

