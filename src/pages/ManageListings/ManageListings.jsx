import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Menu,
  Pagination,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  ThreeDRotation as ThreeDIcon,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import {
  validateServiceName,
  validateServiceDescription,
  validateServicePrice,
  validateServiceImages,
} from '../../utils/validation';
import ConfirmationDialog from '../../components/ConfirmationDialog/ConfirmationDialog';
import Model3DViewer from '../../components/Model3DViewer/Model3DViewer';
import './ManageListings.css';

const VENDOR_CATEGORIES = [
  'Photographer',
  'Videographer',
  'Venue',
  'Caterer',
  'Florist',
  'DJ_Music',
  'Other',
];

const ManageListings = () => {
  const { user, loading: authLoading } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [sortBy, setSortBy] = useState('dateAdded'); // 'name', 'price', 'dateAdded', 'category'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedListing, setSelectedListing] = useState(null);

  // Modal state
  const [openModal, setOpenModal] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    isActive: true,
  });
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [model3DFile, setModel3DFile] = useState(null);
  const [model3DPreview, setModel3DPreview] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingListingId, setDeletingListingId] = useState(null);

  // Fetch listings
  useEffect(() => {
    if (user && user.role === 'vendor') {
      fetchListings();
    }
  }, [user]);

  // Update document title
  useEffect(() => {
    document.title = 'Manage Listings - Weddding';
    return () => {
      document.title = 'Weddding';
    };
  }, []);

  const fetchListings = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch('/service-listings');
      setListings(data);
    } catch (err) {
      setError(err.message || 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (listing = null) => {
    if (listing) {
      setEditingListing(listing);
      setFormData({
        name: listing.name || '',
        description: listing.description || '',
        category: listing.category || '',
        price: listing.price || '',
        isActive: listing.isActive !== undefined ? listing.isActive : true,
      });
      setImages([]);
      setImagePreviews(listing.images || []);
      setModel3DFile(null);
      setModel3DPreview(listing.has3DModel ? 'existing' : null);
    } else {
      setEditingListing(null);
      setFormData({
        name: '',
        description: '',
        category: '',
        price: '',
        isActive: true,
      });
      setImages([]);
      setImagePreviews([]);
      setModel3DFile(null);
      setModel3DPreview(null);
    }
    setFieldErrors({});
    setError('');
    setSuccess('');
    setPage(1); // Reset to first page when opening modal
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setEditingListing(null);
    setFormData({
      name: '',
      description: '',
      category: '',
      price: '',
      isActive: true,
    });
    setImages([]);
    setImagePreviews([]);
    setModel3DFile(null);
    setModel3DPreview(null);
    setFieldErrors({});
    setError('');
    setSuccess('');
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');

    // Real-time validation
    if (field === 'name') {
      const error = validateServiceName(value);
      setFieldErrors((prev) => ({ ...prev, name: error }));
    } else if (field === 'description') {
      const error = validateServiceDescription(value);
      setFieldErrors((prev) => ({ ...prev, description: error }));
    } else if (field === 'price') {
      const error = validateServicePrice(value);
      setFieldErrors((prev) => ({ ...prev, price: error }));
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const newImages = [...images, ...files];

    const imageError = validateServiceImages(newImages);
    if (imageError) {
      setError(imageError);
      return;
    }

    setImages(newImages);
    setError('');

    // Create previews for new images
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveImage = async (index) => {
    // If editing, check if this is an existing image or a new one
    // We need to check against the original listing images, not current previews
    const originalImageCount = editingListing ? editingListing.images.length : 0;
    const currentPreviewCount = imagePreviews.length;
    const newImageCount = currentPreviewCount - originalImageCount;
    
    // Determine if this is an existing image (from server) or a new one
    const isExistingImage = editingListing && index < originalImageCount;
    
    if (isExistingImage) {
      // This is an existing image - delete from server using the index
      try {
        await apiFetch(`/service-listings/${editingListing.id}/images/${index}`, {
          method: 'DELETE',
        });
        
        // Remove from previews
        const newPreviews = imagePreviews.filter((_, i) => i !== index);
        setImagePreviews(newPreviews);
        
        // Update the editing listing to reflect the deletion
        if (editingListing) {
          setEditingListing({
            ...editingListing,
            images: editingListing.images.filter((_, i) => i !== index),
          });
        }
      } catch (err) {
        console.error('Failed to delete image from server:', err);
        setError('Failed to delete image. Please try again.');
      }
    } else {
      // This is a new image - remove from both arrays
      const newImageIndex = index - originalImageCount;
      const newImages = images.filter((_, i) => i !== newImageIndex);
      setImages(newImages);
      
      const newPreviews = imagePreviews.filter((_, i) => i !== index);
      setImagePreviews(newPreviews);
      
      // Revoke object URL
      const previewUrl = imagePreviews[index];
      if (previewUrl && typeof previewUrl === 'string' && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    }
  };

  const validateAllFields = () => {
    const nameError = validateServiceName(formData.name);
    const descriptionError = validateServiceDescription(formData.description);
    const priceError = validateServicePrice(formData.price);
    const categoryError = !formData.category ? 'Category is required' : '';
    const imageError = validateServiceImages(images);

    setFieldErrors({
      name: nameError,
      description: descriptionError,
      price: priceError,
      category: categoryError,
      images: imageError,
    });

    return !nameError && !descriptionError && !priceError && !categoryError && !imageError;
  };

  const handleSave = async () => {
    if (!validateAllFields()) {
      setError('Please fix the errors before saving');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingListing) {
        // Update existing listing
        const updateData = {
          name: formData.name,
          description: formData.description || null,
          category: formData.category,
          price: parseFloat(formData.price),
          isActive: formData.isActive,
        };

        await apiFetch(`/service-listings/${editingListing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(updateData),
        });

        // Upload new images if any
        if (images.length > 0) {
          const formDataToSend = new FormData();
          images.forEach((image) => {
            formDataToSend.append('images', image);
          });

          await apiFetch(`/service-listings/${editingListing.id}/images`, {
            method: 'POST',
            body: formDataToSend,
          });
        }

        // Upload 3D model if provided
        if (model3DFile) {
          const formData3D = new FormData();
          formData3D.append('model3D', model3DFile);

          await apiFetch(`/service-listings/${editingListing.id}/model3d`, {
            method: 'POST',
            body: formData3D,
          });
        }

        setSuccess('Listing updated successfully!');
      } else {
        // Create new listing
        const createData = {
          name: formData.name,
          description: formData.description || null,
          category: formData.category,
          price: parseFloat(formData.price),
          isActive: formData.isActive,
        };

        const newListing = await apiFetch('/service-listings', {
          method: 'POST',
          body: JSON.stringify(createData),
        });

        // Upload images if any
        if (images.length > 0) {
          const formDataToSend = new FormData();
          images.forEach((image) => {
            formDataToSend.append('images', image);
          });

          await apiFetch(`/service-listings/${newListing.id}/images`, {
            method: 'POST',
            body: formDataToSend,
          });
        }

        // Upload 3D model if provided
        if (model3DFile) {
          const formData3D = new FormData();
          formData3D.append('model3D', model3DFile);

          await apiFetch(`/service-listings/${newListing.id}/model3d`, {
            method: 'POST',
            body: formData3D,
          });
        }

        setSuccess('Listing created successfully!');
      }

      // Refresh listings
      await fetchListings();
      setTimeout(() => {
        handleCloseModal();
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to save listing');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (listingId) => {
    setDeletingListingId(listingId);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingListingId) return;

    try {
      await apiFetch(`/service-listings/${deletingListingId}`, {
        method: 'DELETE',
      });
      setSuccess('Listing deleted successfully!');
      await fetchListings();
      setShowDeleteDialog(false);
      setDeletingListingId(null);
    } catch (err) {
      setError(err.message || 'Failed to delete listing');
      setShowDeleteDialog(false);
      setDeletingListingId(null);
    }
  };

  // Helper function to convert relative image URLs to full backend URLs
  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/uploads')) {
      return `http://localhost:4000${url}`;
    }
    return url;
  };

  // Filter listings based on search and active filter
  const filteredListings = listings.filter((listing) => {
    const matchesSearch =
      listing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (listing.description && listing.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      listing.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesActiveFilter = !showActiveOnly || listing.isActive;
    
    return matchesSearch && matchesActiveFilter;
  });

  // Sort listings
  const sortedListings = [...filteredListings].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'price':
        comparison = parseFloat(a.price) - parseFloat(b.price);
        break;
      case 'dateAdded':
        comparison = new Date(a.createdAt) - new Date(b.createdAt);
        break;
      case 'category':
        comparison = a.category.localeCompare(b.category);
        break;
      default:
        comparison = 0;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Pagination
  const totalPages = Math.ceil(sortedListings.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const paginatedListings = sortedListings.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (event, value) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, showActiveOnly, sortBy, sortOrder]);

  const handle3DModelChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate 3D model file type - only .glb allowed
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.glb')) {
        setError('Please select a .glb file (GLTF Binary format)');
        if (e.target) {
          e.target.value = '';
        }
        return;
      }

      // Check file size (max 50MB for 3D models)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('3D model file size must be less than 50MB');
        if (e.target) {
          e.target.value = '';
        }
        return;
      }

      setModel3DFile(file);
      setModel3DPreview(file.name);
      setError('');
    }
  };

  const handleRemove3DModel = () => {
    setModel3DFile(null);
    setModel3DPreview(null);
    // Clear file input
    const fileInput = document.getElementById('3d-model-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleMenuOpen = (event, listing) => {
    setAnchorEl(event.currentTarget);
    setSelectedListing(listing);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedListing(null);
  };

  const handleEditFromMenu = () => {
    if (selectedListing) {
      handleOpenModal(selectedListing);
      handleMenuClose();
    }
  };

  const handleDeleteFromMenu = () => {
    if (selectedListing) {
      handleDeleteClick(selectedListing.id);
      handleMenuClose();
    }
  };

  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!user || user.role !== 'vendor') {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Access denied. Vendor account required.</Typography>
      </Box>
    );
  }

  return (
    <Box className="manage-listings-page">
      <Box className="manage-listings-container">
        {/* Header */}
        <Box className="manage-listings-header">
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 1 }}>
              Manage Listings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add, edit, or remove your services and items.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Show Active Only Toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ color: '#666', fontSize: '14px' }}>
                Show Active Only
              </Typography>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showActiveOnly}
                  onChange={(e) => setShowActiveOnly(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </Box>
            <button
              className="custom-button create-button"
              onClick={() => handleOpenModal()}
              type="button"
            >
              <span>Create New Listing</span>
            </button>
          </Box>
        </Box>

        {/* Search and Sort Bar */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            fullWidth
            placeholder="Search listings by name, description, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: '#999', mr: 1 }} />,
            }}
            sx={{
              '& .MuiInputBase-input':{border: 'none'},
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: '#fff',
              },
            }}
          />
          <TextField
            select
            label="Sort by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            sx={{
              minWidth: 150,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: '#fff',
              },
            }}
          >
            <MenuItem value="dateAdded">Date Added</MenuItem>
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="price">Price</MenuItem>
            <MenuItem value="category">Category</MenuItem>
          </TextField>
          <TextField
            select
            label="Order"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            sx={{
              minWidth: 120,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: '#fff',
              },
            }}
          >
            <MenuItem value="desc">Descending</MenuItem>
            <MenuItem value="asc">Ascending</MenuItem>
          </TextField>
        </Box>

        {/* Listings Grid */}
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        ) : listings.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No listings yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create your first service listing to get started.
            </Typography>
            <button
              className="custom-button create-button"
              onClick={() => handleOpenModal()}
              type="button"
            >
              <span>Create New Listing</span>
            </button>
          </Card>
        ) : sortedListings.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No listings found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchQuery || showActiveOnly
                ? 'Try adjusting your search or filter criteria.'
                : 'Create your first service listing to get started.'}
            </Typography>
          </Card>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 3,
              justifyContent: 'space-between',
            }}
          >
            {paginatedListings.map((listing) => (
              <Card
                key={listing.id}
                className="listing-card-fixed"
                sx={{
                  height: '340px',
                  width: '340px',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 1.5,
                  border: '1px solid #e0e0e0',
                  transition: 'all 0.3s ease',
                  overflow: 'hidden',
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                {/* Image */}
                <CardMedia
                  component="img"
                  height="140"
                    image={
                      listing.images && listing.images.length > 0
                        ? getImageUrl(listing.images[0])
                        : '/images/default-product.jpg'
                    }
                    alt={listing.name}
                    sx={{ objectFit: 'cover' }}
                  />

                  <CardContent sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column' }}>
                    {/* Header with menu */}
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          color: '#1a1a1a',
                          fontSize: '1rem',
                          flex: 1,
                          mr: 1,
                          lineHeight: 1.3,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {listing.name}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, listing)}
                        sx={{ color: '#666', p: 0.5 }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    {/* Category and Status Chips */}
                    <Box display="flex" gap={1} mb={1.5} flexWrap="wrap">
                      <Chip
                        label={listing.category}
                        size="small"
                        sx={{
                          backgroundColor: '#f3f4f6',
                          color: '#666',
                          fontSize: '0.7rem',
                          height: '24px',
                        }}
                      />
                      <Chip
                        label={listing.isActive ? 'active' : 'inactive'}
                        size="small"
                        sx={{
                          backgroundColor: listing.isActive ? '#d4edda' : '#f8d7da',
                          color: listing.isActive ? '#155724' : '#721c24',
                          fontSize: '0.7rem',
                          height: '24px',
                          fontWeight: 500,
                        }}
                      />
                    </Box>

                    {/* Description */}
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 'auto',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.5,
                        fontSize: '0.875rem',
                        flexGrow: 1,
                      }}
                    >
                      {listing.description || 'No description provided'}
                    </Typography>

                    {/* Price */}
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#1a1a1a', fontSize: '1.1rem' }}>
                        RM {parseFloat(listing.price).toLocaleString()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
            ))}
          </Box>
        )}

        {/* Pagination */}
        {sortedListings.length > itemsPerPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={handlePageChange}
              color="primary"
              size="large"
              sx={{
                '& .MuiPaginationItem-root': {
                  fontSize: '1rem',
                },
                '& .MuiPaginationItem-page.Mui-selected': {
                  backgroundColor: '#e16789',
                  color: '#fff',
                  '&:hover': {
                    backgroundColor: '#d1537a',
                  },
                },
              }}
            />
          </Box>
        )}
      </Box>

      {/* Create/Edit Modal */}
      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 },
        }}
      >
        <DialogTitle sx={{ pb: 2, borderBottom: '1px solid #e0e0e0' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#1a1a1a' }}>
              {editingListing ? 'Edit Listing' : 'Create New Listing'}
            </Typography>
            <IconButton onClick={handleCloseModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {/* Error/Success Messages in Modal */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          <Stack spacing={3} sx={{ mt: 3 }}>
            {/* Name */}
            <TextField
              fullWidth
              label="Service Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              error={!!fieldErrors.name}
              helperText={fieldErrors.name || '10-100 characters, no special characters'}
              required
              sx={{ '& .MuiInputBase-input':{border: 'none'}, '& .MuiFormHelperText-root': { fontSize: '12px' } }}
            />

            {/* Category */}
            <TextField
              fullWidth
              select
              label="Category"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              error={!!fieldErrors.category}
              helperText={fieldErrors.category}
              required
              sx={{ '& .MuiFormHelperText-root': { fontSize: '12px' } }}
            >
              {VENDOR_CATEGORIES.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </TextField>

            {/* Description */}
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              error={!!fieldErrors.description}
              helperText={
                fieldErrors.description ||
                `${formData.description.length}/2000 characters (optional, min 10 if provided)`
              }
              multiline
              rows={4}
              sx={{ '& .MuiFormHelperText-root': { fontSize: '12px' } }}
            />

            {/* Price */}
            <TextField
              fullWidth
              label="Price (RM)"
              type="number"
              value={formData.price}
              onChange={(e) => handleInputChange('price', e.target.value)}
              error={!!fieldErrors.price}
              helperText={fieldErrors.price || 'Price cannot be less than 0'}
              required
              inputProps={{ min: 0, step: 0.01 }}
              sx={{ '& .MuiFormHelperText-root': { fontSize: '12px' } }}
            />

            {/* Images */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Images (Optional, max 10 images, 5MB each)
              </Typography>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                style={{ display: 'none' }}
                id="image-upload"
              />
              <label htmlFor="image-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<ImageIcon />}
                  sx={{
                    mb: 2,
                    textTransform: 'none',
                    borderColor: '#e0e0e0',
                    color: '#666',
                    '&:hover': { borderColor: '#e16789', color: '#e16789' },
                  }}
                >
                  Add Images
                </Button>
              </label>

              {fieldErrors.images && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
                  {fieldErrors.images}
                </Typography>
              )}

              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <Box display="flex" flexWrap="wrap" gap={2} mt={2}>
                  {imagePreviews.map((preview, index) => (
                    <Box
                      key={index}
                      sx={{
                        position: 'relative',
                        width: 120,
                        height: 120,
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: '1px solid #e0e0e0',
                      }}
                    >
                      <img
                        src={typeof preview === 'string' ? getImageUrl(preview) : preview}
                        alt={`Preview ${index + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveImage(index)}
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          backgroundColor: 'rgba(0, 0, 0, 0.5)',
                          color: 'white',
                          '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.7)' },
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* 3D Model Upload */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                3D Model (Optional, .glb format only, max 50MB)
              </Typography>
              <input
                type="file"
                accept=".glb"
                onChange={handle3DModelChange}
                style={{ display: 'none' }}
                id="3d-model-upload"
              />
              <label htmlFor="3d-model-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<ThreeDIcon />}
                  sx={{
                    mb: 2,
                    textTransform: 'none',
                    borderColor: '#e0e0e0',
                    color: '#666',
                    '&:hover': { borderColor: '#e16789', color: '#e16789' },
                  }}
                >
                  {model3DPreview ? 'Change 3D Model' : 'Upload 3D Model'}
                </Button>
              </label>

              {model3DPreview && (
                <>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1.5,
                      backgroundColor: '#f5f5f5',
                      borderRadius: 1,
                      mb: 2,
                    }}
                  >
                    <ThreeDIcon sx={{ color: '#666' }} />
                    <Typography variant="body2" sx={{ flex: 1, color: '#666' }}>
                      {model3DPreview === 'existing' ? '3D Model uploaded' : model3DPreview}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handleRemove3DModel}
                      sx={{ color: '#d32f2f' }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  
                  {/* 3D Model Preview */}
                  {editingListing && editingListing.has3DModel && editingListing.designElement && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                        3D Model Preview
                      </Typography>
                      <Model3DViewer
                        modelUrl={editingListing.designElement.modelFile}
                        width="100%"
                        height="400px"
                      />
                    </Box>
                  )}
                </>
              )}
            </Box>

            {/* Active Status Toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Status:
              </Typography>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                />
                <span className="slider"></span>
              </label>
              <Typography variant="body2" color="text.secondary">
                {formData.isActive ? 'Active' : 'Inactive'}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: '1px solid #e0e0e0', gap: 2 }}>
          <Button onClick={handleCloseModal} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            sx={{
              backgroundColor: '#e16789',
              color: '#ffffff',
              textTransform: 'none',
              px: 3,
              '&:hover': { backgroundColor: '#d1537a' },
            }}
          >
            {saving ? 'Saving...' : editingListing ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Options Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleEditFromMenu}>
          <EditIcon sx={{ mr: 1, fontSize: '18px' }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteFromMenu} sx={{ color: '#d32f2f' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: '18px' }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setDeletingListingId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Listing?"
        description="Are you sure you want to delete this listing? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </Box>
  );
};

export default ManageListings;

