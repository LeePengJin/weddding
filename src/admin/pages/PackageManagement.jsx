import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
  InputAdornment,
} from '@mui/material';
import { Add, Close, Edit, ErrorOutline, Loop, Refresh, Verified, WarningAmber, Search } from '@mui/icons-material';
import { apiFetch, getPackageDesign, getPackageVenues, setPackageVenue } from '../../lib/api';
import { formatImageUrl } from '../../utils/image';

const CATEGORY_OPTIONS = [
  { value: 'Venue', label: 'Venue' },
  { value: 'Caterer', label: 'Caterer' },
  { value: 'Photographer', label: 'Photographer' },
  { value: 'Videographer', label: 'Videographer' },
  { value: 'Florist', label: 'Florist' },
  { value: 'DJ_Music', label: 'DJ & Music' },
  { value: 'Other', label: 'Other' },
];

const STATUS_COLORS = {
  draft: 'default',
  published: 'success',
  needs_vendor_updates: 'warning',
  archived: 'default',
};

const getVendorDisplayName = (listing) =>
  listing?.vendorName || listing?.vendor?.name || listing?.vendor?.user?.name || null;

const normalizeListingSummary = (listing) => {
  if (!listing) return null;
  if (listing.vendorName) {
    return listing;
  }
  return {
    ...listing,
    vendorName: getVendorDisplayName(listing),
  };
};

const buildItemsFromPlacements = (placements = []) => {
  const itemsByService = new Map();

  placements.forEach((placement) => {
    const serviceId = placement?.metadata?.serviceListingId || placement?.serviceListing?.id;
    if (!serviceId || itemsByService.has(serviceId)) {
      return;
    }
    const summary = normalizeListingSummary(placement.serviceListing);
    itemsByService.set(serviceId, {
      localId: `design-${serviceId}`,
      id: null,
      label: summary?.name || placement.designElement?.name || 'Service',
      category: summary?.category || CATEGORY_OPTIONS[0].value,
      serviceListingId: serviceId,
      isRequired: true,
      minPrice: summary?.price || placement.metadata?.unitPrice || '',
      maxPrice: '',
      replacementTags: [],
      listingSummary: summary,
    });
  });

  return Array.from(itemsByService.values());
};

const parsePriceValue = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getPriceSuggestion = (item) => {
  const listingPrice = parsePriceValue(item.listingSummary?.price);
  return listingPrice ?? null;
};

const getReplacementTagSuggestions = (item) => {
  const suggestions = new Set();
  if (item.category) {
    suggestions.add(item.category);
  }
  if (item.listingSummary?.category) {
    suggestions.add(item.listingSummary.category);
  }
  if (item.listingSummary?.customCategory) {
    suggestions.add(item.listingSummary.customCategory);
  }
  if (item.listingSummary?.vendorName) {
    item.listingSummary.vendorName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .forEach((piece) => suggestions.add(piece));
  }
  // Provide generic fallbacks to help admins annotate intent
  suggestions.add('primary');
  suggestions.add('backup');

  return Array.from(suggestions).filter(Boolean).slice(0, 6);
};

const defaultFormState = {
  id: null,
  packageName: '',
  description: '',
  previewImage: '',
  notes: '',
  status: 'draft',
  items: [],
};

const PackageManagement = () => {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState(defaultFormState);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activePackageId, setActivePackageId] = useState(null);
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const [selectedPackageForVenue, setSelectedPackageForVenue] = useState(null);
  const [availableVenues, setAvailableVenues] = useState([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [syncingDesign, setSyncingDesign] = useState(false);
  const [packageSearch, setPackageSearch] = useState('');
  const [orderBy, setOrderBy] = useState('updatedAt');
  const [orderDirection, setOrderDirection] = useState('desc');

  const closeSnackbar = () => setSnackbar({ open: false, message: '', severity: 'success' });

  const showMessage = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/admin/packages');
      setPackages(data);
    } catch (err) {
      showMessage(err.message || 'Failed to load packages', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const openCreateDrawer = () => {
    setIsEditing(false);
    setFormState(defaultFormState);
    setDrawerOpen(true);
  };

  const mapPackageToFormState = (pkg) => ({
    id: pkg.id,
    packageName: pkg.packageName || '',
    description: pkg.description || '',
    previewImage: pkg.previewImage || '',
    notes: pkg.notes || '',
    status: pkg.status || 'draft',
    items: (pkg.items || []).map((item) => ({
      localId: item.id,
      id: item.id,
      label: item.label || '',
      category: item.category || CATEGORY_OPTIONS[0].value,
      serviceListingId: item.serviceListingId || '',
      isRequired: item.isRequired,
      minPrice: item.minPrice || '',
      maxPrice: item.maxPrice || '',
      replacementTags: Array.isArray(item.replacementTags) ? item.replacementTags : [],
      listingSummary: normalizeListingSummary(item.serviceListingSnapshot || item.serviceListing),
    })),
  });

  const openEditDrawer = (pkg) => {
    setIsEditing(true);
    setFormState(mapPackageToFormState(pkg));
    setDrawerOpen(true);
  };

  const handleItemChange = (index, field, value) => {
    setFormState((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const handleAddPlaceholderItem = () => {
    setFormState((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          localId: `temp-${Date.now()}`,
          id: null,
          label: 'New Slot',
          category: CATEGORY_OPTIONS[0].value,
          serviceListingId: '',
          isRequired: true,
          minPrice: '',
          maxPrice: '',
          replacementTags: [],
          listingSummary: null,
        },
      ],
    }));
  };

  const handleRemoveItem = (index) => {
    setFormState((prev) => {
      const items = [...prev.items];
      items.splice(index, 1);
      return { ...prev, items };
    });
  };

  const handleApplyPriceSuggestion = (index, target, value) => {
    if (!Number.isFinite(value)) return;
    setFormState((prev) => {
      const items = [...prev.items];
      const next = { ...items[index] };
      if (target === 'min' || target === 'both') {
        next.minPrice = value;
      }
      if (target === 'max' || target === 'both') {
        next.maxPrice = value;
      }
      items[index] = next;
      return { ...prev, items };
    });
  };

  const handleAddReplacementTag = (index, tag) => {
    if (!tag) return;
    setFormState((prev) => {
      const items = [...prev.items];
      const existing = new Set(items[index].replacementTags || []);
      if (existing.has(tag)) {
        return prev;
      }
      items[index] = {
        ...items[index],
        replacementTags: [...existing, tag],
      };
      return { ...prev, items };
    });
  };

  const handleSyncFromDesign = async () => {
    if (!formState.id) {
      showMessage('Save the package before syncing services from the 3D designer', 'info');
      return;
    }
    setSyncingDesign(true);
    try {
      const data = await getPackageDesign(formState.id);
      const placements = data?.design?.placedElements || [];
      const designItems = buildItemsFromPlacements(placements);

      if (designItems.length === 0) {
        showMessage('No services were detected in the template yet. Add elements in 3D first.', 'warning');
        return;
      }

      setFormState((prev) => {
        const placeholderItems = prev.items.filter((item) => !item.serviceListingId);
        return {
          ...prev,
          items: [...designItems, ...placeholderItems],
        };
      });
      showMessage('Services synced from the 3D designer');
    } catch (err) {
      showMessage(err.message || 'Failed to sync services from the 3D template', 'error');
    } finally {
      setSyncingDesign(false);
    }
  };

  const parseTags = (value) =>
    value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

  const buildPayload = () => ({
    packageName: formState.packageName.trim(),
    description: formState.description || null,
    previewImage: formState.previewImage || null,
    notes: formState.notes || null,
    status: formState.status || 'draft',
    items: formState.items.map((item) => ({
      id: item.id || undefined,
      label: item.label.trim(),
      category: item.category,
      serviceListingId: item.serviceListingId || null,
      isRequired: item.isRequired,
      minPrice: item.minPrice !== '' ? Number(item.minPrice) : null,
      maxPrice: item.maxPrice !== '' ? Number(item.maxPrice) : null,
    replacementTags: Array.isArray(item.replacementTags) ? item.replacementTags : [],
    })),
  });

  const handleSavePackage = async () => {
    if (isEditing && formState.status === 'published') {
      showMessage('Unpublish this package before editing.', 'warning');
      return;
    }
    if (!formState.packageName || formState.items.length === 0) {
      showMessage('Package name and at least one item are required', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      const url = isEditing ? `/admin/packages/${formState.id}` : '/admin/packages';
      const method = isEditing ? 'PUT' : 'POST';
      await apiFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
      showMessage(`Package ${isEditing ? 'updated' : 'created'} successfully`);
      setDrawerOpen(false);
      setFormState(defaultFormState);
      fetchPackages();
    } catch (err) {
      showMessage(err.message || 'Failed to save package', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async (pkgId) => {
    setActivePackageId(pkgId);
    try {
      await apiFetch(`/admin/packages/${pkgId}/validate`, { method: 'POST' });
      showMessage('Validation completed');
      fetchPackages();
    } catch (err) {
      showMessage(err.message || 'Failed to validate package', 'error');
    } finally {
      setActivePackageId(null);
    }
  };

  const handleStatusChange = async (pkgId, status) => {
    setActivePackageId(pkgId);
    try {
      await apiFetch(`/admin/packages/${pkgId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showMessage('Package status updated');
      fetchPackages();
    } catch (err) {
      showMessage(err.message || 'Failed to update status', 'error');
    } finally {
      setActivePackageId(null);
    }
  };

  const handleTemplateClick = async (pkg) => {
    if (pkg.status === 'published') {
      showMessage('Unpublish the package before editing the 3D template.', 'warning');
      return;
    }
    try {
      // Check if package already has a venue selected
      const designData = await apiFetch(`/admin/package-design/${pkg.id}`);
      if (designData.venue) {
        // Venue already selected, go directly to designer
        navigate(`/admin/packages/${pkg.id}/designer`);
      } else {
        // No venue selected, show selection dialog
        setSelectedPackageForVenue(pkg);
        setVenueDialogOpen(true);
        await fetchAvailableVenues(pkg.id);
      }
    } catch (err) {
      // If design doesn't exist yet or other error, show venue selection
      setSelectedPackageForVenue(pkg);
      setVenueDialogOpen(true);
      await fetchAvailableVenues(pkg.id);
    }
  };

  const fetchAvailableVenues = async (packageId) => {
    setVenuesLoading(true);
    try {
      const data = await getPackageVenues(packageId);
      setAvailableVenues(data.venues || []);
    } catch (err) {
      showMessage(err.message || 'Failed to load venues', 'error');
    } finally {
      setVenuesLoading(false);
    }
  };

  const handleVenueSelect = async (venueId) => {
    if (!selectedPackageForVenue) return;
    try {
      await setPackageVenue(selectedPackageForVenue.id, venueId);
      showMessage('Venue selected successfully');
      setVenueDialogOpen(false);
      setSelectedPackageForVenue(null);
      // Navigate to designer
      navigate(`/admin/packages/${selectedPackageForVenue.id}/designer`);
    } catch (err) {
      showMessage(err.message || 'Failed to select venue', 'error');
    }
  };

  const statusSummary = useMemo(() => {
    return packages.reduce(
      (acc, pkg) => {
        acc[pkg.status] = (acc[pkg.status] || 0) + 1;
        return acc;
      },
      { draft: 0, published: 0, needs_vendor_updates: 0, archived: 0 }
    );
  }, [packages]);

  const pillButtonSx = { textTransform: 'none', borderRadius: '999px', fontWeight: 600 };
  const searchValue = packageSearch.trim().toLowerCase();
  const visiblePackages = [...packages]
    .filter((pkg) => {
      if (!searchValue) return true;
      const name = pkg.packageName?.toLowerCase() || '';
      const description = pkg.description?.toLowerCase() || '';
      const status = pkg.status?.toLowerCase() || '';
      return name.includes(searchValue) || description.includes(searchValue) || status.includes(searchValue);
    })
    .sort((a, b) => {
      const direction = orderDirection === 'asc' ? 1 : -1;
      if (orderBy === 'packageName') {
        return ((a.packageName || '').localeCompare(b.packageName || '')) * direction;
      }
      if (orderBy === 'items') {
        const itemsA = a.healthSummary?.total || 0;
        const itemsB = b.healthSummary?.total || 0;
        return (itemsA - itemsB) * direction;
      }
      if (orderBy === 'status') {
        return (a.status || '').localeCompare(b.status || '') * direction;
      }
      // default: updatedAt
      const updatedA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const updatedB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return (updatedA - updatedB) * direction;
    });

  const handleRequestSort = (property) => {
    if (orderBy === property) {
      setOrderDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(property);
      setOrderDirection('asc');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3} spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            Wedding Packages
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage curated templates and monitor vendor health
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchPackages}
            disabled={loading}
            sx={pillButtonSx}
          >
            Refresh
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={openCreateDrawer} sx={pillButtonSx}>
            New Package
          </Button>
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={3}>
        {[
          {
            key: 'published',
            label: 'Published',
            value: statusSummary.published,
            helper: 'Live for couples to select',
          },
          {
            key: 'draft',
            label: 'Draft',
            value: statusSummary.draft,
            helper: 'Still in-progress internally',
          },
          {
            key: 'needs_vendor_updates',
            label: 'Needs vendor updates',
            value: statusSummary.needs_vendor_updates,
            helper: 'Listings flagged for attention',
            icon: <WarningAmber fontSize="small" color="warning" />,
          },
          {
            key: 'archived',
            label: 'Archived',
            value: statusSummary.archived,
            helper: 'Hidden but kept for reference',
          },
        ].map((card) => (
          <Card
            key={card.key}
            sx={{
              flex: 1,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'grey.200',
              boxShadow: 'none',
            }}
          >
            <CardContent
              sx={{
                minHeight: 140,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {card.icon}
                <Typography variant="subtitle2" color="text.secondary" textTransform="uppercase">
                  {card.label}
                </Typography>
              </Stack>
              <Typography variant="h4" fontWeight={700}>
                {card.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {card.helper}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Box
        sx={{
          mb: 2,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <TextField
          sx={{ width: { xs: '100%', sm: 320, md: 360 } }}
          placeholder="Search packages"
          value={packageSearch}
          onChange={(e) => setPackageSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Card
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'grey.100',
          boxShadow: 'none',
        }}
      >
        <CardContent>
          {loading ? (
            <Box py={6} display="flex" justifyContent="center">
              <CircularProgress />
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sortDirection={orderBy === 'packageName' ? orderDirection : false}>
                    <TableSortLabel
                      active={orderBy === 'packageName'}
                      direction={orderBy === 'packageName' ? orderDirection : 'asc'}
                      onClick={() => handleRequestSort('packageName')}
                    >
                      Package
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={orderBy === 'status' ? orderDirection : false}>
                    <TableSortLabel
                      active={orderBy === 'status'}
                      direction={orderBy === 'status' ? orderDirection : 'asc'}
                      onClick={() => handleRequestSort('status')}
                    >
                      Status
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Template</TableCell>
                  <TableCell
                    align="center"
                    sortDirection={orderBy === 'items' ? orderDirection : false}
                  >
                    <TableSortLabel
                      active={orderBy === 'items'}
                      direction={orderBy === 'items' ? orderDirection : 'asc'}
                      onClick={() => handleRequestSort('items')}
                    >
                      Items
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={orderBy === 'updatedAt' ? orderDirection : false}>
                    <TableSortLabel
                      active={orderBy === 'updatedAt'}
                      direction={orderBy === 'updatedAt' ? orderDirection : 'desc'}
                      onClick={() => handleRequestSort('updatedAt')}
                    >
                      Last Validated
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visiblePackages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Box textAlign="center" py={5}>
                        <Typography variant="body1" color="text.secondary">
                          {packages.length === 0
                            ? 'No packages yet. Create your first curated experience.'
                            : 'No packages match your filters. Try adjusting your search or sort.'}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  visiblePackages.map((pkg) => (
                  <TableRow key={pkg.id} hover>
                    <TableCell>
                      <Typography fontWeight={600}>{pkg.packageName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {pkg.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={pkg.status.replace(/_/g, ' ')}
                        size="small"
                        color={STATUS_COLORS[pkg.status] || 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {pkg.designSummary?.elementCount > 0 ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={`${pkg.designSummary.elementCount} elements`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          {pkg.designSummary.updatedAt && (
                            <Typography variant="caption" color="text.secondary">
                              Updated {new Date(pkg.designSummary.updatedAt).toLocaleDateString()}
                            </Typography>
                          )}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Not designed yet
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                        <Chip label={`${pkg.healthSummary.total} services`} size="small" />
                        {pkg.healthSummary.issues > 0 && (
                          <Tooltip title="Requires vendor updates">
                            <ErrorOutline color="warning" fontSize="small" />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {pkg.lastValidatedAt
                        ? new Date(pkg.lastValidatedAt).toLocaleString()
                        : 'Not validated yet'}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Verified />}
                          disabled={activePackageId === pkg.id}
                          onClick={() => handleValidate(pkg.id)}
                          sx={pillButtonSx}
                        >
                          Validate
                        </Button>
                        {pkg.status !== 'published' ? (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            disabled={activePackageId === pkg.id}
                            onClick={() => handleStatusChange(pkg.id, 'published')}
                            sx={pillButtonSx}
                          >
                            Publish
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            disabled={activePackageId === pkg.id}
                            onClick={() => handleStatusChange(pkg.id, 'draft')}
                            sx={pillButtonSx}
                          >
                            Unpublish
                          </Button>
                        )}
                        <Tooltip title={pkg.status === 'published' ? 'Unpublish to edit' : 'Edit package details'}>
                          <span>
                            <IconButton
                              color="primary"
                              onClick={() => openEditDrawer(pkg)}
                              disabled={pkg.status === 'published'}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        fullWidth
        maxWidth="md"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '6px',
            maxHeight: '90vh',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6" fontWeight={600}>
            Package Details
          </Typography>
          <IconButton size="small" onClick={() => setDrawerOpen(false)}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          {isEditing && formState.status === 'published' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This package is published and cannot be modified. Unpublish it from the table to make changes.
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* Left side - Preview Image */}
            <Box sx={{ width: { xs: '100%', md: '300px' }, flexShrink: 0 }}>
              {formState.previewImage ? (
                <Box
                  component="img"
                  src={formatImageUrl(formState.previewImage)}
                  alt="Package preview"
                  sx={{
                    width: '100%',
                    height: '151px',
                    objectFit: 'cover',
                    borderRadius: '6px',
                    boxShadow: '0 8px 20px rgba(15, 6, 13, 0.15)',
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    height: '151px',
                    bgcolor: 'grey.200',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Preview will appear after saving the 3D template
                  </Typography>
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                Preview images are auto-captured from the 3D designer when you save the layout.
              </Typography>
            </Box>

            {/* Right side - Form fields */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {/* Package Name */}
              <Box>
                <Typography variant="body2" fontWeight={600} mb={0.5}>
                  Package Name
                </Typography>
                <TextField
                  value={formState.packageName}
                  onChange={(e) => setFormState((prev) => ({ ...prev, packageName: e.target.value }))}
                  fullWidth
                  size="small"
                  placeholder="Enter package name"
                />
              </Box>

              {/* Status */}
              <Box>
                <Typography variant="body2" fontWeight={600} mb={0.5}>
                  Status
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  Set whether the package is active or inactive.
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={formState.status || 'draft'}
                  onChange={(e) => setFormState((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="published">Published</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </Box>

              {/* Included Services - Show after items are added */}
              {formState.items.length > 0 && (
                <Box>
                  <Typography variant="body2" fontWeight={600} mb={1}>
                    Included Services
                  </Typography>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: '6px',
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'grey.200',
                    }}
                  >
                    <List dense sx={{ py: 0 }}>
                      {formState.items.map((item, index) => (
                        <ListItem key={item.localId || item.id} sx={{ py: 0.5, px: 0 }}>
                          <ListItemText
                            primary={
                              <Typography variant="body2">
                                {item.label || item.listingSummary?.name || `Service ${index + 1}`}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                {item.category}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Box>
              )}

              {/* Package Description */}
              <Box>
                <Typography variant="body2" fontWeight={600} mb={0.5}>
                  Package Description
                </Typography>
                <TextField
                  value={formState.description}
                  onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                  multiline
                  minRows={4}
                  fullWidth
                  placeholder="Enter package description"
                  size="small"
                />
              </Box>

              {/* Internal Notes (hidden in main view, can be in a collapsible section) */}
              <TextField
                label="Internal notes (optional)"
                value={formState.notes}
                onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
                multiline
                minRows={2}
                fullWidth
                size="small"
              />
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Package Items Section */}
          <Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              spacing={1.5}
            >
              <Typography variant="h6" fontWeight={600}>
                Package items
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  size="small"
                  variant="contained"
                  color="secondary"
                  startIcon={<Loop />}
                  onClick={handleSyncFromDesign}
                  disabled={syncingDesign}
                  sx={pillButtonSx}
                >
                  {syncingDesign ? 'Syncing...' : 'Sync from 3D design'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={handleAddPlaceholderItem}
                  sx={pillButtonSx}
                >
                  Add placeholder
                </Button>
              </Stack>
            </Stack>

            <Typography variant="caption" color="text.secondary">
              Services added via the 3D designer will appear after syncing. Use placeholders for vendors without 3D models.
            </Typography>

            {formState.items.length === 0 && (
              <Card variant="outlined" sx={{ mt: 2, borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    No items yet. Sync services from the 3D template or create placeholders for requirements without 3D assets.
                  </Typography>
                </CardContent>
              </Card>
            )}

            <Stack spacing={2} mt={formState.items.length === 0 ? 0 : 2}>
              {formState.items.map((item, index) => {
                const priceSuggestion = getPriceSuggestion(item);
                const tagSuggestions = getReplacementTagSuggestions(item);
                return (
                  <Card
                    key={item.localId || item.id}
                    variant="outlined"
                    sx={{ borderRadius: 2, borderColor: 'grey.200', boxShadow: 'none' }}
                  >
                    <CardContent>
                      <Stack spacing={1.5}>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        spacing={1}
                      >
                        <Box>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {item.label || item.listingSummary?.name || `Slot ${index + 1}`}
                          </Typography>
                          {item.listingSummary?.vendorName && (
                            <Typography variant="body2" color="text.secondary">
                              {item.listingSummary.vendorName}
                            </Typography>
                          )}
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={item.serviceListingId ? 'Linked listing' : 'Placeholder'}
                            size="small"
                            color={item.serviceListingId ? 'primary' : 'default'}
                            variant={item.serviceListingId ? 'filled' : 'outlined'}
                          />
                          <Button color="error" size="small" onClick={() => handleRemoveItem(index)}>
                            Remove
                          </Button>
                        </Stack>
                      </Stack>

                      <TextField
                        label="Label"
                        value={item.label}
                        onChange={(e) => handleItemChange(index, 'label', e.target.value)}
                        fullWidth
                        size="small"
                      />

                      <Select
                        fullWidth
                        size="small"
                        value={item.category}
                        onChange={(e) => handleItemChange(index, 'category', e.target.value)}
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </Select>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                          <TextField
                            label="Min price (optional)"
                            type="number"
                            fullWidth
                            size="small"
                            value={item.minPrice}
                            onChange={(e) => handleItemChange(index, 'minPrice', e.target.value)}
                          />
                          <TextField
                            label="Max price (optional)"
                            type="number"
                            fullWidth
                            size="small"
                            value={item.maxPrice}
                            onChange={(e) => handleItemChange(index, 'maxPrice', e.target.value)}
                          />
                        </Stack>

                        {priceSuggestion && (
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              Suggested price
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleApplyPriceSuggestion(index, 'min', priceSuggestion)}
                                sx={pillButtonSx}
                              >
                                Use as min (RM {priceSuggestion.toLocaleString()})
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleApplyPriceSuggestion(index, 'both', priceSuggestion)}
                                sx={pillButtonSx}
                              >
                                Apply to both
                              </Button>
                            </Stack>
                          </Stack>
                        )}

                        <TextField
                          label="Replacement tags (comma separated)"
                          value={item.replacementTags.join(', ')}
                          onChange={(e) => handleItemChange(index, 'replacementTags', parseTags(e.target.value))}
                          fullWidth
                          size="small"
                        />

                        {tagSuggestions.length > 0 && (
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              Quick tags
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {tagSuggestions.map((tag) => (
                                <Chip
                                  key={`${item.localId || item.id}-${tag}`}
                                  label={tag}
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleAddReplacementTag(index, tag)}
                                />
                              ))}
                            </Stack>
                          </Stack>
                        )}

                        {item.listingSummary && (
                          <Box
                            sx={{
                              p: 1.5,
                              borderRadius: 1,
                              bgcolor: 'grey.50',
                              border: '1px solid',
                              borderColor: 'grey.100',
                            }}
                          >
                            <Typography variant="subtitle2">Linked listing</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {item.listingSummary.name}
                              {item.listingSummary.vendorName ? ` — ${item.listingSummary.vendorName}` : ''}
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'flex-end', gap: 1 }}>
          {isEditing && (
            <Tooltip
              title={formState.status === 'published' ? 'Unpublish to edit the template' : 'Open 3D designer'}
            >
              <span>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={async () => {
                    setDrawerOpen(false);
                    await handleTemplateClick({ id: formState.id, ...formState });
                  }}
                  disabled={!formState.id || formState.status === 'published'}
                  sx={pillButtonSx}
                >
                  Edit in 3D Space
                </Button>
              </span>
            </Tooltip>
          )}
          <Button variant="outlined" onClick={() => setDrawerOpen(false)} sx={pillButtonSx}>
            Cancel
          </Button>
          <Tooltip
            title={
              isEditing && formState.status === 'published'
                ? 'Unpublish this package before editing details'
                : 'Save package'
            }
          >
            <span>
              <Button
                variant="contained"
                onClick={handleSavePackage}
                disabled={saving || (isEditing && formState.status === 'published')}
                sx={pillButtonSx}
              >
                {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>

      <Dialog fullWidth maxWidth="md" open={venueDialogOpen} onClose={() => setVenueDialogOpen(false)}>
        <DialogTitle>Select a Venue for Package Template</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Choose a venue to use as the base for this package template. The 3D design will be created within this venue.
          </Typography>
          {venuesLoading ? (
            <Box py={4} display="flex" justifyContent="center">
              <CircularProgress size={28} />
            </Box>
          ) : (
            <List dense>
              {availableVenues.map((venue) => (
                <ListItem key={venue.id} disablePadding>
                  <ListItemButton onClick={() => handleVenueSelect(venue.id)} disabled={!venue.has3DModel}>
                    <ListItemAvatar>
                      <Box>
                        <Chip
                          label="Venue"
                          color={venue.has3DModel ? 'primary' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </ListItemAvatar>
                    <ListItemText
                      primary={venue.name}
                      secondary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" color="text.secondary">
                            {venue.vendor?.name || 'Unknown vendor'}
                          </Typography>
                          {venue.price && (
                            <>
                              <Typography variant="body2" color="text.secondary">
                                •
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                RM {Number(venue.price).toLocaleString()}
                              </Typography>
                            </>
                          )}
                          {!venue.has3DModel && (
                            <>
                              <Typography variant="body2" color="text.secondary">
                                •
                              </Typography>
                              <Typography variant="body2" color="error">
                                No 3D model
                              </Typography>
                            </>
                          )}
                        </Stack>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
              {availableVenues.length === 0 && (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
                  No venues with 3D models available
                </Typography>
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVenueDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={closeSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PackageManagement;

