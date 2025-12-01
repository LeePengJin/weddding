import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Checkbox,
  FormControlLabel,
  Paper,
  Divider,
  Stack,
  Alert,
  IconButton,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import PropTypes from 'prop-types';

const ContractReviewModal = ({ open, onClose, onAcknowledge, groupedByVendor, projectId, weddingDate }) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [expandedVendor, setExpandedVendor] = useState(null);

  const handleAcknowledge = () => {
    if (acknowledged && onAcknowledge) {
      onAcknowledge();
    }
  };

  const handleClose = () => {
    setAcknowledged(false);
    setExpandedVendor(null);
    if (onClose) {
      onClose();
    }
  };

  // Calculate totals
  const grandTotal = groupedByVendor.reduce((sum, vendor) => sum + vendor.total, 0);
  const totalItems = groupedByVendor.reduce((sum, vendor) => sum + vendor.items.length, 0);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography variant="h5" component="h2" sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>
          Contract Review & Acknowledgment
        </Typography>
        <IconButton onClick={handleClose} size="small" aria-label="Close">
          <Close />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ p: 3, overflowY: 'auto', maxHeight: 'calc(90vh - 200px)' }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Please review the contract terms, payment schedule, and liability information for each vendor before proceeding.
          </Alert>

          <Stack spacing={3}>
            {groupedByVendor.map((vendor, vendorIndex) => {
              const isExpanded = expandedVendor === vendor.vendorId || vendorIndex === 0;
              
              // Get cancellation policy from first service listing
              const firstService = vendor.items[0];
              const cancellationPolicy = firstService?.serviceListing?.cancellationPolicy;
              const cancellationFeeTiers = firstService?.serviceListing?.cancellationFeeTiers;

              return (
                <Paper key={vendor.vendorId || vendor.vendorName} elevation={1} sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 2,
                      cursor: 'pointer',
                    }}
                    onClick={() => setExpandedVendor(isExpanded ? null : vendor.vendorId)}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {vendor.vendorName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {isExpanded ? '▼' : '▶'} {vendor.items.length} {vendor.items.length === 1 ? 'item' : 'items'} • RM {vendor.total.toLocaleString()}
                    </Typography>
                  </Box>

                  {isExpanded && (
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
                                  {item.displayName || item.name || item.serviceListing?.name || 'Service'} × {item.quantity}
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
                  )}
                </Paper>
              );
            })}
          </Stack>

          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Summary
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Total Items:</Typography>
              <Typography variant="body2" fontWeight="medium">{totalItems}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Total Vendors:</Typography>
              <Typography variant="body2" fontWeight="medium">{groupedByVendor.length}</Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="h6" fontWeight="600">
                Total Amount:
              </Typography>
              <Typography variant="h6" fontWeight="700" color="primary.main">
                RM {grandTotal.toLocaleString()}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 3 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  required
                />
              }
              label={
                <Typography variant="body2">
                  I have read and agree to the contract terms, payment schedule, and liability terms for all vendors listed above.
                </Typography>
              }
            />
          </Box>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button onClick={handleClose} disabled={false}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleAcknowledge}
          disabled={!acknowledged}
          sx={{
            bgcolor: 'primary.main',
            '&:hover': { bgcolor: 'primary.dark' },
            fontWeight: 600,
          }}
        >
          Acknowledge & Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
};

ContractReviewModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAcknowledge: PropTypes.func.isRequired,
  groupedByVendor: PropTypes.arrayOf(
    PropTypes.shape({
      vendorId: PropTypes.string,
      vendorName: PropTypes.string.isRequired,
      items: PropTypes.array.isRequired,
      total: PropTypes.number.isRequired,
    })
  ).isRequired,
  projectId: PropTypes.string,
  weddingDate: PropTypes.string,
};

export default ContractReviewModal;