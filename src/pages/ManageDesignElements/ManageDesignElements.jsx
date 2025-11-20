import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  Pagination,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Close as CloseIcon,
  ThreeDRotation as ThreeDIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import ConfirmationDialog from '../../components/ConfirmationDialog/ConfirmationDialog';
import Model3DViewer from '../../components/Model3DViewer/Model3DViewer';
import './ManageDesignElements.css';

const ManageDesignElements = () => {
  const { user, loading: authLoading } = useAuth();
  const [designElements, setDesignElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [editingElement, setEditingElement] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    elementType: '',
  });
  const [model3DFile, setModel3DFile] = useState(null);
  const [model3DPreview, setModel3DPreview] = useState(null);
  const [livePreviewUrl, setLivePreviewUrl] = useState(null);
  const previewBlobUrlRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingElementId, setDeletingElementId] = useState(null);
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [fullScreenViewerOpen, setFullScreenViewerOpen] = useState(false);
  const [viewingElement, setViewingElement] = useState(null);
  const [dimensions, setDimensions] = useState({ width: '', height: '', depth: '' });
  const [isStackable, setIsStackable] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name', 'elementType', 'dateAdded'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [filterElementType, setFilterElementType] = useState('');

  useEffect(() => {
    if (user && user.role === 'vendor') {
      fetchDesignElements();
    }
  }, [user]);

  useEffect(() => {
    document.title = 'Design Elements Library - Weddding';
    return () => {
      document.title = 'Weddding';
    };
  }, []);

  const fetchDesignElements = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch('/design-elements');
      setDesignElements(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load design elements');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (element = null) => {
    if (element) {
      setEditingElement(element);
      setFormData({
        name: element.name || '',
        elementType: element.elementType || '',
      });
      setModel3DFile(null);
      setModel3DPreview(element.modelFile ? 'existing' : null);
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
      setLivePreviewUrl(element.modelFile ? getModelUrl(element.modelFile) : null);
      const nextDimensions = {
        width: element.dimensions?.width ?? '',
        height: element.dimensions?.height ?? '',
        depth: element.dimensions?.depth ?? '',
      };
      setDimensions({
        width: nextDimensions.width === '' ? '' : String(nextDimensions.width),
        height: nextDimensions.height === '' ? '' : String(nextDimensions.height),
        depth: nextDimensions.depth === '' ? '' : String(nextDimensions.depth),
      });
      setIsStackable(Boolean(element.isStackable));
    } else {
      setEditingElement(null);
      setFormData({
        name: '',
        elementType: '',
      });
      setModel3DFile(null);
      setModel3DPreview(null);
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
      setLivePreviewUrl(null);
      setDimensions({ width: '', height: '', depth: '' });
      setIsStackable(false);
    }
    setError('');
    setSuccess('');
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setEditingElement(null);
    setFormData({
      name: '',
      elementType: '',
    });
    setModel3DFile(null);
    setModel3DPreview(null);
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    setLivePreviewUrl(null);
    setError('');
    setSuccess('');
    setDimensions({ width: '', height: '', depth: '' });
    setIsStackable(false);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handle3DModelChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.glb')) {
        setError('Please select a .glb file (GLTF Binary format)');
        if (e.target) {
          e.target.value = '';
        }
        return;
      }

      const maxSize = 150 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('3D model file size must be less than 150MB');
        if (e.target) {
          e.target.value = '';
        }
        return;
      }

      setModel3DFile(file);
      setModel3DPreview(file.name);
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
      const blobUrl = URL.createObjectURL(file);
      previewBlobUrlRef.current = blobUrl;
      setLivePreviewUrl(blobUrl);
      setError('');
    }
  };

  const handleRemove3DModel = () => {
    setModel3DFile(null);
    setModel3DPreview(null);
    const fileInput = document.getElementById('3d-model-upload');
    if (fileInput) {
      fileInput.value = '';
    }
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    if (editingElement && editingElement.modelFile) {
      setLivePreviewUrl(getModelUrl(editingElement.modelFile));
    } else {
      setLivePreviewUrl(null);
    }
  };

  useEffect(() => {
    return () => {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
    };
  }, []);

  const buildDimensionsPayload = () => {
    const entries = ['width', 'height', 'depth'].reduce((acc, key) => {
      const raw = dimensions[key];
      if (raw === '' || raw === null || raw === undefined) {
        return acc;
      }
      const value = Number(raw);
      if (Number.isFinite(value) && value >= 0) {
        acc[key] = value;
      }
      return acc;
    }, {});
    return Object.keys(entries).length > 0 ? entries : null;
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (!editingElement && !model3DFile) {
      setError('Please upload a 3D model file');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingElement) {
        // Update existing element
        const dimensionsPayload = buildDimensionsPayload();
        const updateData = {
          name: formData.name.trim(),
          elementType: formData.elementType.trim() || null,
          isStackable,
          dimensions: dimensionsPayload,
        };

        await apiFetch(`/design-elements/${editingElement.id}`, {
          method: 'PATCH',
          body: JSON.stringify(updateData),
        });

        // Upload new 3D model if provided
        if (model3DFile) {
          const formData3D = new FormData();
          formData3D.append('model3D', model3DFile);
          formData3D.append('isStackable', String(isStackable));
          const dimensionsPayload = buildDimensionsPayload();
          if (dimensionsPayload) {
            formData3D.append('dimensions', JSON.stringify(dimensionsPayload));
          }

          await apiFetch(`/design-elements/${editingElement.id}/model3d`, {
            method: 'POST',
            body: formData3D,
          });
        }

        setSuccess('Design element updated successfully!');
      } else {
        // Create new element
        const formData3D = new FormData();
        formData3D.append('model3D', model3DFile);
        formData3D.append('name', formData.name.trim());
        if (formData.elementType.trim()) {
          formData3D.append('elementType', formData.elementType.trim());
        }
        formData3D.append('isStackable', String(isStackable));
        const dimensionsPayload = buildDimensionsPayload();
        if (dimensionsPayload) {
          formData3D.append('dimensions', JSON.stringify(dimensionsPayload));
        }

        await apiFetch('/design-elements', {
          method: 'POST',
          body: formData3D,
        });

        setSuccess('Design element created successfully!');
      }

      await fetchDesignElements();
      setTimeout(() => {
        handleCloseModal();
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to save design element');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (elementId) => {
    setDeletingElementId(elementId);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingElementId) return;

    try {
      await apiFetch(`/design-elements/${deletingElementId}`, {
        method: 'DELETE',
      });
      setSuccess('Design element deleted successfully!');
      await fetchDesignElements();
      setShowDeleteDialog(false);
      setDeletingElementId(null);
    } catch (err) {
      setError(err.message || 'Failed to delete design element');
      setShowDeleteDialog(false);
      setDeletingElementId(null);
    }
  };

  const getModelUrl = (modelFile) => {
    if (!modelFile) return null;
    if (modelFile.startsWith('http://') || modelFile.startsWith('https://')) {
      return modelFile;
    }
    if (modelFile.startsWith('/uploads')) {
      return `http://localhost:4000${modelFile}`;
    }
    return modelFile;
  };

  // Filter and sort design elements
  const filteredAndSortedElements = useMemo(() => {
    let filtered = [...designElements];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (element) =>
          (element.name && element.name.toLowerCase().includes(query)) ||
          (element.elementType && element.elementType.toLowerCase().includes(query))
      );
    }

    // Apply element type filter
    if (filterElementType) {
      filtered = filtered.filter((element) => element.elementType === filterElementType);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal, bVal;

      if (sortBy === 'name') {
        aVal = (a.name || '').toLowerCase();
        bVal = (b.name || '').toLowerCase();
      } else if (sortBy === 'elementType') {
        aVal = (a.elementType || '').toLowerCase();
        bVal = (b.elementType || '').toLowerCase();
      } else if (sortBy === 'dateAdded') {
        // Assuming elements have createdAt field, if not, we'll use a default
        aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else {
        return 0;
      }

      if (sortBy === 'dateAdded') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (aVal === bVal) return 0;
      const comparison = aVal < bVal ? -1 : 1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [designElements, searchQuery, filterElementType, sortBy, sortOrder]);

  // Get unique element types for filter
  const uniqueElementTypes = useMemo(() => {
    const types = new Set();
    designElements.forEach((element) => {
      if (element.elementType) {
        types.add(element.elementType);
      }
    });
    return Array.from(types).sort();
  }, [designElements]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedElements.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const paginatedElements = filteredAndSortedElements.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (event, value) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterElementType, sortBy, sortOrder]);

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
    <Box className="manage-design-elements-page">
      <Box className="manage-design-elements-container">
        {/* Header */}
        <Box className="manage-design-elements-header">
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 1 }}>
              Design Elements Library
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage your 3D model library. Upload models once and reuse them across multiple service listings.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenModal()}
            sx={{
              backgroundColor: '#e16789',
              color: '#ffffff',
              textTransform: 'none',
              px: 3,
              '&:hover': { backgroundColor: '#d1537a' },
            }}
          >
            Add Design Element
          </Button>
        </Box>

        {/* Error/Success Messages */}
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

        {/* Search, Filter, and Sort Bar */}
        {designElements.length > 0 && (
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              fullWidth
              placeholder="Search by name or element type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: '#999', mr: 1 }} />,
              }}
              sx={{
                flex: '1 1 300px',
                '& .MuiInputBase-input': { border: 'none' },
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1,
                  backgroundColor: '#fff',
                },
              }}
            />
            <TextField
              select
              label="Filter by Type"
              value={filterElementType}
              onChange={(e) => setFilterElementType(e.target.value)}
              sx={{
                minWidth: 150,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1,
                  backgroundColor: '#fff',
                },
              }}
            >
              <MenuItem value="">All Types</MenuItem>
              {uniqueElementTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Sort by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              sx={{
                minWidth: 150,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1,
                  backgroundColor: '#fff',
                },
              }}
            >
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="elementType">Element Type</MenuItem>
              <MenuItem value="dateAdded">Date Added</MenuItem>
            </TextField>
            <TextField
              select
              label="Order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              sx={{
                minWidth: 120,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1,
                  backgroundColor: '#fff',
                },
              }}
            >
              <MenuItem value="asc">Ascending</MenuItem>
              <MenuItem value="desc">Descending</MenuItem>
            </TextField>
          </Box>
        )}

        {/* Design Elements Grid */}
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        ) : designElements.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No design elements yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create your first design element to get started. You can reuse it across multiple service listings.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenModal()}
              sx={{
                backgroundColor: '#e16789',
                color: '#ffffff',
                textTransform: 'none',
                '&:hover': { backgroundColor: '#d1537a' },
              }}
            >
              Add Design Element
            </Button>
          </Card>
        ) : filteredAndSortedElements.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No design elements found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try adjusting your search or filter criteria.
            </Typography>
          </Card>
        ) : (
          <>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 3,
                justifyContent: { xs: 'center', sm: 'flex-start' },
              }}
            >
              {paginatedElements.map((element) => (
                <Card
                  key={element.id}
                  sx={{
                    width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(33.333% - 16px)', lg: 'calc(25% - 18px)' },
                    minWidth: { xs: '100%', sm: '280px', md: '240px', lg: '220px' },
                    maxWidth: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(33.333% - 16px)', lg: 'calc(25% - 18px)' },
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 2,
                    border: '1px solid #e0e0e0',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                    <Box
                      onClick={() => {
                        if (element.modelFile) {
                          setViewingElement(element);
                          setFullScreenViewerOpen(true);
                        }
                      }}
                      sx={{
                        height: 200,
                        backgroundColor: '#f5f5f5',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        cursor: element.modelFile ? 'pointer' : 'default',
                        overflow: 'hidden',
                        '&:hover': element.modelFile ? {
                          backgroundColor: '#eeeeee',
                          '& .preview-overlay': {
                            opacity: 1,
                          }
                        } : {},
                      }}
                    >
                      {element.modelFile ? (
                        <>
                          <ThreeDIcon sx={{ fontSize: 64, color: '#ccc', mb: 1 }} />
                          <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem' }}>
                            3D Model Available
                          </Typography>
                          <Box
                            className="preview-overlay"
                            sx={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              backgroundColor: 'rgba(0, 0, 0, 0.7)',
                              color: 'white',
                              padding: '6px',
                              textAlign: 'center',
                              fontSize: '0.7rem',
                              opacity: 0,
                              transition: 'opacity 0.2s ease',
                            }}
                          >
                            Click to view in 3D
                          </Box>
                        </>
                      ) : (
                        <ThreeDIcon sx={{ fontSize: 48, color: '#ccc' }} />
                      )}
                    </Box>
                    <CardContent sx={{ flexGrow: 1, p: 2, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          color: '#1a1a1a',
                          fontSize: '1rem',
                          mb: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          width: '100%',
                        }}
                      >
                        {element.name || 'Unnamed Element'}
                      </Typography>
                      {element.elementType && (
                        <Chip
                          label={element.elementType}
                          size="small"
                          sx={{
                            backgroundColor: '#f3f4f6',
                            color: '#666',
                            fontSize: '0.7rem',
                            mb: 1,
                          }}
                        />
                      )}
                      <Box display="flex" gap={1} mt={2}>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenModal(element)}
                          sx={{ color: '#666' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(element.id)}
                          sx={{ color: '#d32f2f' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
              ))}
            </Box>

            {/* Pagination */}
            {designElements.length > itemsPerPage && (
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
          </>
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
              {editingElement ? 'Edit Design Element' : 'Create Design Element'}
            </Typography>
            <IconButton onClick={handleCloseModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
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

          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              helperText="Give your design element a descriptive name (e.g., 'Round Table', 'Wooden Chair')"
              required
            />

            <TextField
              fullWidth
              label="Element Type (Optional)"
              value={formData.elementType}
              onChange={(e) => handleInputChange('elementType', e.target.value)}
              helperText="Category or type (e.g., 'Furniture', 'Decoration')"
            />

            {/* 3D Model Upload */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                3D Model {editingElement ? '(Optional - leave empty to keep existing)' : '(Required, .glb format only, max 150MB)'}
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
              )}

              {livePreviewUrl && (
                <Box
                  sx={{
                    p: 2,
                    backgroundColor: '#f5f5f5',
                    borderRadius: 1,
                    mb: 2,
                  }}
                >
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Live Preview
                  </Typography>
                  <Model3DViewer
                    modelUrl={livePreviewUrl}
                    width="100%"
                    height="300px"
                    targetDimensions={dimensions}
                  />
                </Box>
              )}

              <Box
                sx={{
                  mt: 1,
                  p: 2,
                  border: '1px solid #e0e0e0',
                  borderRadius: 2,
                  backgroundColor: '#fafafa',
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Physical Properties
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Enter real-world dimensions (in meters) so the system can auto-scale this model accurately.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                  <TextField
                    label="Width (X)"
                    type="number"
                    size="small"
                    value={dimensions.width}
                    onChange={(e) => setDimensions((prev) => ({ ...prev, width: e.target.value }))}
                    InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                    inputProps={{ step: '0.01', min: '0' }}
                  />
                  <TextField
                    label="Height (Y)"
                    type="number"
                    size="small"
                    value={dimensions.height}
                    onChange={(e) => setDimensions((prev) => ({ ...prev, height: e.target.value }))}
                    InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                    inputProps={{ step: '0.01', min: '0' }}
                  />
                  <TextField
                    label="Depth (Z)"
                    type="number"
                    size="small"
                    value={dimensions.depth}
                    onChange={(e) => setDimensions((prev) => ({ ...prev, depth: e.target.value }))}
                    InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                    inputProps={{ step: '0.01', min: '0' }}
                  />
                </Stack>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isStackable}
                      onChange={(e) => setIsStackable(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Stackable item
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Allow this model to be placed on top of tables or other surfaces (e.g., centerpieces, tableware).
                      </Typography>
                    </Box>
                  }
                />
              </Box>
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
            {saving ? 'Saving...' : editingElement ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Full-Screen 3D Viewer Dialog */}
      <Dialog
        open={fullScreenViewerOpen}
        onClose={() => setFullScreenViewerOpen(false)}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: '100vw',
            height: '100vh',
            maxWidth: '100vw',
            maxHeight: '100vh',
            m: 0,
            borderRadius: 0,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#1a1a1a',
            color: 'white',
            borderBottom: '1px solid #333',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {viewingElement?.name || 'Unnamed Element'}
          </Typography>
          <IconButton
            onClick={() => setFullScreenViewerOpen(false)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            p: 0,
            backgroundColor: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 'calc(100vh - 64px)',
            overflow: 'hidden',
          }}
        >
          {viewingElement && viewingElement.modelFile && (
            <Model3DViewer
              modelUrl={getModelUrl(viewingElement.modelFile)}
              width="100%"
              height="100%"
              targetDimensions={viewingElement.dimensions}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setDeletingElementId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Design Element?"
        description="Are you sure you want to delete this design element? This action cannot be undone. Make sure it's not being used in any service listings or components."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </Box>
  );
};

export default ManageDesignElements;

