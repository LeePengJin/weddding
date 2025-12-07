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
  Snackbar,
  Stack,
  Menu,
  TablePagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TableSortLabel,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormControl,
  Switch,
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
import BlueprintEditor from '../../components/BlueprintEditor/BlueprintEditor';
import ListingWizard from '../../components/ListingWizard/ListingWizard';
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

// Pricing policies matching the backend enum
const PRICING_POLICIES = {
  fixed_package: 'Fixed Package',
  per_table: 'Per Table',
  per_unit: 'Per Unit',
  time_based: 'Time Based',
};

// Filter pricing policies based on category and availability type
const getAvailablePricingPolicies = (category, availabilityType) => {
  // Venues should only have fixed_package
  if (category === 'Venue') {
    return { fixed_package: PRICING_POLICIES.fixed_package };
  }
  
  // For exclusive services, usually fixed_package or time_based
  if (availabilityType === 'exclusive') {
    return {
      fixed_package: PRICING_POLICIES.fixed_package,
      time_based: PRICING_POLICIES.time_based,
    };
  }
  
  // For reusable/quantity-based, show all options
  return PRICING_POLICIES;
};

const ManageListings = () => {
  const { user, loading: authLoading } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastNotification, setToastNotification] = useState({ open: false, message: '', severity: 'info' });
  const [searchQuery, setSearchQuery] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [sortBy, setSortBy] = useState('dateAdded'); // 'name', 'price', 'dateAdded', 'category'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedListing, setSelectedListing] = useState(null);

  // Modal state
  const [openModal, setOpenModal] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    customCategory: '',
    price: '',
    isActive: true,
    availabilityType: 'exclusive',
    maxQuantity: '',
    pricingPolicy: 'fixed_package',
    hourlyRate: '',
    cancellationPolicy: '',
    cancellationFeeTiers: {
      '>90': 0,
      '30-90': 0.10,
      '7-30': 0.25,
      '<7': 0.50,
    },
    isBundle: false,
  });
  
  const [components, setComponents] = useState([]);
  const [designElements, setDesignElements] = useState([]);
  const [loadingDesignElements, setLoadingDesignElements] = useState(false);
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [model3DFile, setModel3DFile] = useState(null);
  const [model3DPreview, setModel3DPreview] = useState(null);
  const [modelDimensions, setModelDimensions] = useState({ width: '', height: '', depth: '' });
  const [isStackable, setIsStackable] = useState(false);
  const [selectedDesignElementId, setSelectedDesignElementId] = useState(''); // For selecting existing design element (non-bundle)
  const [useExistingDesignElement, setUseExistingDesignElement] = useState(false); // Toggle: select existing vs upload new
  const [model3DSource, setModel3DSource] = useState('upload'); // 'existing', 'upload', or 'floorplan'
  const [floorplanEditorOpen, setFloorplanEditorOpen] = useState(false);
  const [floorplanData, setFloorplanData] = useState(null);
  const [model3DFiles, setModel3DFiles] = useState([]); // For bundle services - multiple files
  const [model3DPreviews, setModel3DPreviews] = useState([]); // Preview info for multiple models
  const [component3DFiles, setComponent3DFiles] = useState({}); // Component ID -> File object
  const [component3DPreviews, setComponent3DPreviews] = useState({}); // Component ID -> Preview info
  const [componentPhysicalProps, setComponentPhysicalProps] = useState({}); // Component ID -> dims + stackable
  const [model3DFileMeta, setModel3DFileMeta] = useState([]); // Multi-upload metadata
  const [previewComponentIndex, setPreviewComponentIndex] = useState(null); // Which component's 3D model to preview
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null); // Track blob URL for cleanup
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingListingId, setDeletingListingId] = useState(null);

  // Fetch listings
  useEffect(() => {
    if (user && user.role === 'vendor') {
      fetchListings();
      fetchDesignElements();
    }
  }, [user]);

  // Manage blob URL for preview when component index or files change
  useEffect(() => {
    // Store previous blob URL for cleanup
    const prevBlobUrl = previewBlobUrl;
    
    // Create new blob URL if needed
    let newBlobUrl = null;
    const selectedComponent =
      previewComponentIndex !== null ? components[previewComponentIndex] : null;
    const previewKey = selectedComponent?.id;
    if (previewKey && component3DFiles[previewKey]) {
      const file = component3DFiles[previewKey];
      newBlobUrl = URL.createObjectURL(file);
      setPreviewBlobUrl(newBlobUrl);
    } else {
      setPreviewBlobUrl(null);
    }
    
    // Cleanup previous blob URL on next render or unmount
    return () => {
      if (prevBlobUrl) {
        URL.revokeObjectURL(prevBlobUrl);
      }
      if (newBlobUrl && newBlobUrl !== prevBlobUrl) {
        // Also cleanup new blob URL if component unmounts before next render
        URL.revokeObjectURL(newBlobUrl);
      }
    };
  }, [previewComponentIndex, component3DFiles, components]);

  // Fetch design elements for component selection
  const fetchDesignElements = async () => {
    try {
      setLoadingDesignElements(true);
      const data = await apiFetch('/service-listings/design-elements');
      setDesignElements(data || []);
    } catch (err) {
      console.error('Failed to fetch design elements:', err);
      setDesignElements([]);
    } finally {
      setLoadingDesignElements(false);
    }
  };

  // Update document title
  useEffect(() => {
    document.title = 'Manage Listings - Weddding';
    return () => {
      document.title = 'Weddding';
    };
  }, []);

  // Smart defaults for stackable and availability type based on category
  useEffect(() => {
    if (!editingListing && formData.category) {
      const stackableCategories = ['Florist', 'Caterer'];
      if (stackableCategories.includes(formData.category)) {
        setIsStackable(true);
      } else {
        setIsStackable(false);
      }
      
      // Auto-set availability type to exclusive for Venue category
      if (formData.category === 'Venue') {
        setFormData((prev) => ({ ...prev, availabilityType: 'exclusive' }));
      }
    }
  }, [formData.category, editingListing]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch('/service-listings');
      setListings(data);
    } catch (err) {
      setToastNotification({ open: true, message: err.message || 'Failed to load listings', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (listing = null) => {
    // Clear all errors when opening modal - this is critical to prevent stale errors
    setFieldErrors({});
    setError('');
    
    if (listing) {
      setEditingListing(listing);
      // Ensure all values are properly formatted as strings
      const formattedPrice = listing.price 
        ? (typeof listing.price === 'string' 
            ? listing.price 
            : (listing.price.toString ? listing.price.toString() : String(listing.price)))
        : '';
      
      const newFormData = {
        name: listing.name || '',
        description: listing.description || '',
        category: listing.category || '',
        customCategory: listing.customCategory || '',
        price: formattedPrice,
        isActive: listing.isActive !== undefined ? listing.isActive : true,
        availabilityType: listing.availabilityType || 'exclusive',
        maxQuantity: listing.maxQuantity ? listing.maxQuantity.toString() : '',
        pricingPolicy: listing.pricingPolicy || 'fixed_package',
        hourlyRate: listing.hourlyRate ? parseFloat(listing.hourlyRate).toString() : '',
        cancellationPolicy: listing.cancellationPolicy || '',
        cancellationFeeTiers: listing.cancellationFeeTiers ? (
          typeof listing.cancellationFeeTiers === 'string'
            ? JSON.parse(listing.cancellationFeeTiers)
            : listing.cancellationFeeTiers
        ) : {
          '>90': 0,
          '30-90': 0.10,
          '7-30': 0.25,
          '<7': 0.50,
        },
        isBundle: (listing.components && listing.components.length > 0) || false,
      };
      setFormData(newFormData);
      // Map components to include designElementId (not just the full designElement object)
      const mappedComponents = (listing.components || []).map((comp) => ({
        id: comp.id || `existing-${comp.designElementId}`,
        designElementId: comp.designElementId || comp.designElement?.id || '',
        quantityPerUnit: comp.quantityPerUnit || 1,
        role: comp.role || '',
      }));
      setComponents(mappedComponents);
      const nextComponentProps = {};
      (listing.components || []).forEach((comp, index) => {
        nextComponentProps[index] = {
          width: comp.designElement?.dimensions?.width ?? '',
          height: comp.designElement?.dimensions?.height ?? '',
          depth: comp.designElement?.dimensions?.depth ?? '',
          isStackable: Boolean(comp.designElement?.isStackable),
        };
      });
      setComponentPhysicalProps(nextComponentProps);
      setImages([]);
      setImagePreviews(listing.images || []);
      setModel3DFile(null);
      setModel3DPreview(listing.has3DModel ? 'existing' : null);
      // Set selected design element if listing has one
      if (listing.designElementId) {
        setSelectedDesignElementId(listing.designElementId);
        setUseExistingDesignElement(true);
        // Populate dimensions and stackable from existing design element
        if (listing.designElement) {
          const dims = listing.designElement.dimensions || {};
          setModelDimensions({
            width: dims.width || '',
            height: dims.height || '',
            depth: dims.depth || '',
          });
          setIsStackable(!!listing.designElement.isStackable);
        }
      } else {
        setSelectedDesignElementId('');
        setUseExistingDesignElement(false);
        setModelDimensions({ width: '', height: '', depth: '' });
        setIsStackable(false);
      }
      setModel3DSource(listing.designElementId ? 'existing' : 'upload');
      setFloorplanData(null);
      setModel3DFiles([]);
      setModel3DPreviews([]);
      setModel3DFileMeta([]);
      setComponent3DFiles({});
      setComponent3DPreviews({});
    } else {
      setEditingListing(null);
      setFormData({
        name: '',
        description: '',
        category: '',
        customCategory: '',
        price: '',
        isActive: true,
        availabilityType: 'exclusive',
        maxQuantity: '',
        pricingPolicy: 'fixed_package',
        hourlyRate: '',
        cancellationPolicy: '',
        cancellationFeeTiers: {
          '>90': 0,
          '30-90': 0.10,
          '7-30': 0.25,
          '<7': 0.50,
        },
      });
      setComponents([]);
      setImages([]);
      setImagePreviews([]);
      setModel3DFile(null);
      setModel3DPreview(null);
      setSelectedDesignElementId('');
      setUseExistingDesignElement(false);
      setModel3DSource('upload');
      setFloorplanData(null);
      setModel3DFiles([]);
      setModel3DPreviews([]);
      setModel3DFileMeta([]);
      setComponent3DFiles({});
      setComponent3DPreviews({});
      setComponentPhysicalProps({});
    }
    setPreviewComponentIndex(null);
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setFieldErrors({});
    setError('');
    setPage(0); // Reset to first page when opening modal
    setOpenModal(true);
  };

  const handleWizardComplete = (wizardData) => {
    // Merge wizard data into formData for UI state
    setFormData(prev => ({
      ...prev,
      category: wizardData.category,
      customCategory: wizardData.customCategory || '',
      availabilityType: wizardData.availabilityType,
      maxQuantity: wizardData.maxQuantity || '',
      name: wizardData.name,
      description: wizardData.description || '',
      price: wizardData.price,
      pricingPolicy: wizardData.pricingPolicy,
      isBundle: wizardData.isBundle || false,
      cancellationPolicy: wizardData.cancellationPolicy || prev.cancellationPolicy || '',
      cancellationFeeTiers: wizardData.cancellationFeeTiers || prev.cancellationFeeTiers || null,
    }));
    
    // Update other state from wizard
    if (wizardData.model3DSource) {
      setModel3DSource(wizardData.model3DSource);
      setUseExistingDesignElement(wizardData.useExistingDesignElement || false);
      setSelectedDesignElementId(wizardData.selectedDesignElementId || '');
    }
    
    if (wizardData.modelDimensions) {
      setModelDimensions(wizardData.modelDimensions);
    }
    
    if (wizardData.isStackable !== undefined) {
      setIsStackable(wizardData.isStackable);
    }
    
    // For venues, ensure components are empty
    if (wizardData.category === 'Venue') {
      setComponents([]);
    } else if (wizardData.components) {
      setComponents(wizardData.components);
    }
    
    // Call handleSave immediately with wizard data to avoid state update timing issues
    // Pass wizardData directly so validation uses the correct data
    handleSave(wizardData);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setEditingListing(null);
    setFormData({
      name: '',
      description: '',
      category: '',
      customCategory: '',
      price: '',
      isActive: true,
      availabilityType: 'exclusive',
      maxQuantity: '',
      pricingPolicy: 'flat',
    });
    setComponents([]);
    setImages([]);
    setImagePreviews([]);
    setModel3DFile(null);
    setModel3DPreview(null);
    setModelDimensions({ width: '', height: '', depth: '' });
    setIsStackable(false);
    setModel3DFiles([]);
    setModel3DPreviews([]);
    setModel3DFileMeta([]);
    setComponent3DFiles({});
    setComponent3DPreviews({});
    setComponentPhysicalProps({});
    setFieldErrors({});
    setError('');
  };

  const handleInputChange = (field, value) => {
    // Update formData
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      
      // Reset pricing policy if availabilityType changes and current policy is not available
      if (field === 'availabilityType') {
        const availablePolicies = getAvailablePricingPolicies(updated.category, value);
        const availablePolicyKeys = Object.keys(availablePolicies);
        // If current pricing policy is not available for the new availabilityType, reset it
        if (!availablePolicyKeys.includes(updated.pricingPolicy)) {
          // Reset to the first available policy (or 'fixed_package' as default)
          updated.pricingPolicy = availablePolicyKeys[0] || 'fixed_package';
          // Clear pricing-specific fields when policy changes
          if (updated.pricingPolicy !== 'time_based') {
            updated.hourlyRate = '';
          }
        }
      }
      
      // Reset pricing policy if category changes and current policy is not available
      if (field === 'category') {
        const availablePolicies = getAvailablePricingPolicies(value, updated.availabilityType);
        const availablePolicyKeys = Object.keys(availablePolicies);
        // If current pricing policy is not available for the new category, reset it
        if (!availablePolicyKeys.includes(updated.pricingPolicy)) {
          // Reset to the first available policy (or 'fixed_package' as default)
          updated.pricingPolicy = availablePolicyKeys[0] || 'fixed_package';
          // Clear pricing-specific fields when policy changes
          if (updated.pricingPolicy !== 'time_based') {
            updated.hourlyRate = '';
          }
        }
      }
      
      return updated;
    });
    setError('');

    // Real-time validation - only validate the field being changed
    // Do NOT validate other fields when changing a field
    if (field === 'name') {
      const error = validateServiceName(value);
      setFieldErrors((prev) => ({ ...prev, name: error }));
    } else if (field === 'description') {
      const error = validateServiceDescription(value);
      setFieldErrors((prev) => ({ ...prev, description: error }));
    } else if (field === 'price') {
      const error = validateServicePrice(value);
      setFieldErrors((prev) => ({ ...prev, price: error }));
    } else if (field === 'category') {
      // When category changes, validate it and handle customCategory
      const categoryError = !value ? 'Category is required' : '';
      setFieldErrors((prev) => {
        const newErrors = { ...prev, category: categoryError };
        // Clear customCategory error if category is not "Other"
        if (value !== 'Other') {
          newErrors.customCategory = '';
        }
        return newErrors;
      });
    } else if (field === 'customCategory') {
      const customCategoryError =
        formData.category === 'Other' && (!value || String(value).trim().length < 2)
          ? 'Custom category is required (2-50 characters)'
          : '';
      setFieldErrors((fieldErrorsPrev) => ({ ...fieldErrorsPrev, customCategory: customCategoryError }));
    } else {
      // For all other fields (pricingPolicy, availabilityType, etc.)
      // Don't validate anything - just update the formData
      // This prevents false validation errors when changing unrelated fields
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
        setToastNotification({ open: true, message: 'Failed to delete image. Please try again.', severity: 'error' });
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

  const validateAllFields = (dataToValidate = null) => {
    // Use provided data (e.g. from wizard) or fall back to current formData
    const data = dataToValidate || formData;
    
    // Ensure we're working with string values for validation
    // Handle cases where data might be undefined or in wrong format
    const name = data?.name ? (typeof data.name === 'string' ? data.name.trim() : String(data.name).trim()) : '';
    const description = data?.description ? (typeof data.description === 'string' ? data.description.trim() : String(data.description).trim()) : '';
    const price = data?.price !== null && data?.price !== undefined ? String(data.price).trim() : '';
    const category = data?.category ? String(data.category).trim() : '';
    
    // Validate each field - only show error if field is actually empty/invalid
    // If field has a value, validate it; if empty, show required error
    const nameError = name && name.length > 0 ? validateServiceName(name) : (!name || name.length === 0 ? 'Service name is required' : '');
    const descriptionError = description && description.length > 0 ? validateServiceDescription(description) : '';
    const priceError = price && price.length > 0 
      ? validateServicePrice(price) 
      : (!price || price.length === 0 && data?.pricingPolicy !== 'time_based' 
        ? 'Price is required' 
        : '');
    const categoryError = !category || category.length === 0 ? 'Category is required' : '';
    const customCategoryError =
      category === 'Other' && (!data?.customCategory || String(data?.customCategory || '').trim().length < 2)
        ? 'Custom category is required (2-50 characters)'
        : '';
    const imageError = validateServiceImages(images);
    const maxQuantityError =
      data?.availabilityType === 'quantity_based' && (!data?.maxQuantity || parseFloat(data.maxQuantity) <= 0)
        ? 'Max quantity is required and must be greater than 0'
        : '';

    // Store errors for reference (but don't display inline)
    const errors = {};
    if (nameError) errors.name = nameError;
    if (descriptionError) errors.description = descriptionError;
    if (priceError) errors.price = priceError;
    if (categoryError) errors.category = categoryError;
    if (customCategoryError) errors.customCategory = customCategoryError;
    if (imageError) errors.images = imageError;
    if (maxQuantityError) errors.maxQuantity = maxQuantityError;
    
    setFieldErrors(errors);

    const isValid = !nameError && !descriptionError && !priceError && !categoryError && !customCategoryError && !imageError && !maxQuantityError;
    
    // Return object with validation result and first error message
    const firstErrorKey = Object.keys(errors).find(key => errors[key]);
    const firstErrorMessage = firstErrorKey ? errors[firstErrorKey] : null;
    
    return { isValid, firstErrorMessage };
  };

  const handleSave = async (wizardDataOrEvent = null) => {
    // Decide what data we are validating/saving:
    // - For wizard flow (create), use wizardData passed in
    // - For edit flow (modal), use current formData
    // NOTE: When used as a click handler, the first argument will be a React event.
    // We need to ignore that and fall back to formData.
    const isReactEvent =
      wizardDataOrEvent &&
      typeof wizardDataOrEvent === 'object' &&
      ('nativeEvent' in wizardDataOrEvent || 'target' in wizardDataOrEvent);

    const dataToUse = !isReactEvent && wizardDataOrEvent ? wizardDataOrEvent : formData;

    // Validate with the chosen data
    const validationResult = validateAllFields(dataToUse);
    if (!validationResult.isValid) {
      const errorMessage = validationResult.firstErrorMessage || 'Please fix the errors before saving';
      setToastNotification({ open: true, message: errorMessage, severity: 'error' });
      return;
    }

    // Validate components
    // A component is valid if it has either:
    // 1. A designElementId selected, OR
    // 2. A 3D model file uploaded (which will create a design element)
    const invalidComponents = components.filter((comp, idx) => {
      const hasDesignElement = !!comp.designElementId;
      const componentKey = comp.id || `component-${idx}`;
      const has3DFile = !!component3DFiles[componentKey];
      const hasValidQuantity = comp.quantityPerUnit && comp.quantityPerUnit > 0;
      return (!hasDesignElement && !has3DFile) || !hasValidQuantity;
    });
    
    if (invalidComponents.length > 0) {
      setToastNotification({ open: true, message: 'Please ensure all components have either a design element selected or a 3D model uploaded, and valid quantity', severity: 'error' });
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingListing) {
        // Update existing listing
        const updateData = {
          name: dataToUse.name,
          description: dataToUse.description || null,
          category: dataToUse.category,
          customCategory: dataToUse.category === 'Other' ? dataToUse.customCategory : null,
          price: parseFloat(dataToUse.price),
          isActive: dataToUse.isActive !== undefined ? dataToUse.isActive : formData.isActive,
          availabilityType: dataToUse.availabilityType,
          maxQuantity: dataToUse.availabilityType === 'quantity_based' ? parseInt(dataToUse.maxQuantity) : null,
          pricingPolicy: dataToUse.pricingPolicy,
          hourlyRate: dataToUse.pricingPolicy === 'time_based' && dataToUse.hourlyRate ? parseFloat(dataToUse.hourlyRate) : null,
          cancellationPolicy: dataToUse.cancellationPolicy || formData.cancellationPolicy || null,
          cancellationFeeTiers: dataToUse.cancellationFeeTiers || formData.cancellationFeeTiers || null,
          // Include designElementId for non-bundle services
          ...(components.length === 0 && useExistingDesignElement && selectedDesignElementId
            ? { designElementId: selectedDesignElementId }
            : components.length === 0 && !useExistingDesignElement && !model3DFile
            ? { designElementId: null }
            : {}),
          // Only include components that already have designElementId
          // Components with uploaded 3D files will be added after upload
          components: components
            .filter((comp) => comp.designElementId) // Only existing design elements
            .map((comp) => ({
              designElementId: comp.designElementId,
              quantityPerUnit: parseInt(comp.quantityPerUnit),
              role: comp.role || null,
            })),
        };

        const updatedListing = await apiFetch(`/service-listings/${editingListing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(updateData),
        });

        // Update editingListing with the response to get the latest designElement
        if (updatedListing) {
          setEditingListing(updatedListing);
        }

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

        // Handle 3D model upload for non-bundle services (only if uploading new file)
        if (components.length === 0 && model3DFile && !useExistingDesignElement) {
          // Upload new 3D model
          const formData3D = new FormData();
          formData3D.append('model3D', model3DFile);
          formData3D.append('isStackable', String(isStackable));
          const listingDimensions = buildDimensionsPayloadFromState(modelDimensions);
          if (listingDimensions) {
            formData3D.append('dimensions', JSON.stringify(listingDimensions));
          }

          const uploadResponse = await apiFetch(`/service-listings/${editingListing.id}/model3d`, {
            method: 'POST',
            body: formData3D,
          });
          
          // Refetch listing to get updated designElement
          if (uploadResponse) {
            const refreshedListing = await apiFetch(`/service-listings/${editingListing.id}`);
            if (refreshedListing) {
              setEditingListing(refreshedListing);
            }
          }
        } else if (model3DFiles.length > 0) {
          // Multiple models for bundle services (legacy - not recommended)
          const formData3D = new FormData();
          model3DFiles.forEach((file, idx) => {
            const meta = model3DFileMeta[idx] || createDefaultPhysicalProps();
            const dims = buildDimensionsPayloadFromState(meta);
            formData3D.append('model3DFiles', file);
            formData3D.append(`isStackable_${file.name}`, String(Boolean(meta.isStackable)));
            if (dims) {
              formData3D.append(`dimensions_${file.name}`, JSON.stringify(dims));
            }
          });

          const response = await apiFetch(`/service-listings/${editingListing.id}/model3d/bundle`, {
            method: 'POST',
            body: formData3D,
          });

          if (response.designElements) {
            await fetchDesignElements();
          }
        }

        // Upload 3D models for individual components and update components array
        let updatedComponentsList = [...components];
        for (const [componentKey, file] of Object.entries(component3DFiles)) {
          const componentIndex = updatedComponentsList.findIndex((comp) => comp.id === componentKey);
          const component = componentIndex >= 0 ? updatedComponentsList[componentIndex] : null;
          if (!component) continue;
          const physicalProps = componentPhysicalProps[componentKey] || createDefaultPhysicalProps();
          const componentDimensions = buildDimensionsPayloadFromState(physicalProps);

          if (!component.designElementId) {
            // Create new design element
            const formData3D = new FormData();
            formData3D.append('model3D', file);
            formData3D.append('name', component.role || `Component ${componentIndex + 1}`);
            if (dataToUse.category) {
              formData3D.append('elementType', dataToUse.category);
            }
            formData3D.append('isStackable', String(Boolean(physicalProps.isStackable)));
            if (componentDimensions) {
              formData3D.append('dimensions', JSON.stringify(componentDimensions));
            }

            const newElement = await apiFetch('/design-elements', {
              method: 'POST',
              body: formData3D,
            });

            // Update component with new design element ID
            updatedComponentsList[componentIndex] = {
              ...updatedComponentsList[componentIndex],
              designElementId: newElement.id,
            };
          } else {
            // Update existing design element
            const formData3D = new FormData();
            formData3D.append('model3D', file);
            formData3D.append('isStackable', String(Boolean(physicalProps.isStackable)));
            if (componentDimensions) {
              formData3D.append('dimensions', JSON.stringify(componentDimensions));
            }

            await apiFetch(`/design-elements/${component.designElementId}/model3d`, {
              method: 'POST',
              body: formData3D,
            });
          }
        }

        // Update listing with final components (including newly created design elements)
        if (Object.keys(component3DFiles).length > 0) {
          const finalUpdateData = {
            components: updatedComponentsList
              .filter((comp) => comp.designElementId)
              .map((comp) => ({
                designElementId: comp.designElementId,
                quantityPerUnit: parseInt(comp.quantityPerUnit),
                role: comp.role || null,
              })),
          };

          await apiFetch(`/service-listings/${editingListing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(finalUpdateData),
          });

          await fetchDesignElements();
        }

        setToastNotification({ open: true, message: 'Listing updated successfully!', severity: 'success' });
        
        // Refetch the updated listing to ensure we have the latest designElement data
        try {
          const refreshedListing = await apiFetch(`/service-listings/${editingListing.id}`);
          if (refreshedListing) {
            setEditingListing(refreshedListing);
          }
        } catch (err) {
          console.error('Failed to refetch listing:', err);
        }
      } else {
        // Create new listing
        const createData = {
          name: dataToUse.name,
          description: dataToUse.description || null,
          category: dataToUse.category,
          customCategory: dataToUse.category === 'Other' ? dataToUse.customCategory : null,
          price: parseFloat(dataToUse.price),
          isActive: dataToUse.isActive !== undefined ? dataToUse.isActive : formData.isActive,
          availabilityType: dataToUse.availabilityType,
          maxQuantity: dataToUse.availabilityType === 'quantity_based' ? parseInt(dataToUse.maxQuantity) : null,
          pricingPolicy: dataToUse.pricingPolicy,
          hourlyRate: dataToUse.pricingPolicy === 'time_based' && dataToUse.hourlyRate ? parseFloat(dataToUse.hourlyRate) : null,
          cancellationPolicy: dataToUse.cancellationPolicy || formData.cancellationPolicy || null,
          cancellationFeeTiers: dataToUse.cancellationFeeTiers || formData.cancellationFeeTiers || null,
          // Include designElementId for non-bundle services
          ...(components.length === 0 && useExistingDesignElement && selectedDesignElementId
            ? { designElementId: selectedDesignElementId }
            : {}),
          // Only include components that already have designElementId
          // Components with uploaded 3D files will be added after upload
          components: components
            .filter((comp) => comp.designElementId) // Only existing design elements
            .map((comp) => ({
              designElementId: comp.designElementId,
              quantityPerUnit: parseInt(comp.quantityPerUnit),
              role: comp.role || null,
            })),
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

        // Handle 3D model for non-bundle services
        if (components.length === 0) {
          if (useExistingDesignElement && selectedDesignElementId) {
            // Link existing design element
            await apiFetch(`/service-listings/${newListing.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                designElementId: selectedDesignElementId,
              }),
            });
          } else if (model3DFile) {
            // Upload new 3D model
            const formData3D = new FormData();
            formData3D.append('model3D', model3DFile);
            formData3D.append('isStackable', String(isStackable));
            const listingDimensions = buildDimensionsPayloadFromState(modelDimensions);
            if (listingDimensions) {
              formData3D.append('dimensions', JSON.stringify(listingDimensions));
            }

            await apiFetch(`/service-listings/${newListing.id}/model3d`, {
              method: 'POST',
              body: formData3D,
            });
          }
        } else if (model3DFiles.length > 0) {
          // Multiple models for bundle services (legacy - not recommended)
          const formData3D = new FormData();
          model3DFiles.forEach((file, idx) => {
            const meta = model3DFileMeta[idx] || createDefaultPhysicalProps();
            const dims = buildDimensionsPayloadFromState(meta);
            formData3D.append('model3DFiles', file);
            formData3D.append(`isStackable_${file.name}`, String(Boolean(meta.isStackable)));
            if (dims) {
              formData3D.append(`dimensions_${file.name}`, JSON.stringify(dims));
            }
          });

          const response = await apiFetch(`/service-listings/${newListing.id}/model3d/bundle`, {
            method: 'POST',
            body: formData3D,
          });

          if (response.designElements) {
            await fetchDesignElements();
          }
        }

        // Upload 3D models for individual components and update components array
        let updatedComponentsList = [...components];
        for (const [componentKey, file] of Object.entries(component3DFiles)) {
          const componentIndex = updatedComponentsList.findIndex((comp) => comp.id === componentKey);
          const component = componentIndex >= 0 ? updatedComponentsList[componentIndex] : null;
          if (!component) continue;
          const physicalProps = componentPhysicalProps[componentKey] || createDefaultPhysicalProps();
          const componentDimensions = buildDimensionsPayloadFromState(physicalProps);

          if (!component.designElementId) {
            // Create new design element
            const formData3D = new FormData();
            formData3D.append('model3D', file);
            formData3D.append('name', component.role || `Component ${componentIndex + 1}`);
            if (dataToUse.category) {
              formData3D.append('elementType', dataToUse.category);
            }
            formData3D.append('isStackable', String(Boolean(physicalProps.isStackable)));
            if (componentDimensions) {
              formData3D.append('dimensions', JSON.stringify(componentDimensions));
            }

            const newElement = await apiFetch('/design-elements', {
              method: 'POST',
              body: formData3D,
            });

            // Update component with new design element ID
            updatedComponentsList[componentIndex] = {
              ...updatedComponentsList[componentIndex],
              designElementId: newElement.id,
            };
          } else {
            // Update existing design element
            const formData3D = new FormData();
            formData3D.append('model3D', file);
            formData3D.append('isStackable', String(Boolean(physicalProps.isStackable)));
            if (componentDimensions) {
              formData3D.append('dimensions', JSON.stringify(componentDimensions));
            }

            await apiFetch(`/design-elements/${component.designElementId}/model3d`, {
              method: 'POST',
              body: formData3D,
            });
          }
        }

        // Update listing with final components (including newly created design elements)
        if (Object.keys(component3DFiles).length > 0) {
          const finalUpdateData = {
            components: updatedComponentsList
              .filter((comp) => comp.designElementId)
              .map((comp) => ({
                designElementId: comp.designElementId,
                quantityPerUnit: parseInt(comp.quantityPerUnit),
                role: comp.role || null,
              })),
          };

          await apiFetch(`/service-listings/${newListing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(finalUpdateData),
          });

          await fetchDesignElements();
        }

        setToastNotification({ open: true, message: 'Listing created successfully!', severity: 'success' });
      }

      // Refresh listings
      await fetchListings();
      setTimeout(() => {
        handleCloseModal();
      }, 1000);
    } catch (err) {
      // Try to extract validation errors from the error response
      let errorMessage = err.message || 'Failed to save listing';
      
      // If the error contains issues array (from Zod validation), show all errors
      if (err.issues && Array.isArray(err.issues)) {
        const errorMessages = err.issues.map(issue => {
          const field = issue.path?.[0] || 'field';
          return `${field}: ${issue.message}`;
        });
        errorMessage = errorMessages.join('\n');
      }
      
      setToastNotification({ open: true, message: errorMessage, severity: 'error' });
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
      setToastNotification({ open: true, message: 'Listing deleted successfully!', severity: 'success' });
      await fetchListings();
      setShowDeleteDialog(false);
      setDeletingListingId(null);
    } catch (err) {
      setToastNotification({ open: true, message: err.message || 'Failed to delete listing', severity: 'error' });
      setShowDeleteDialog(false);
      setDeletingListingId(null);
    }
  };

  // Helper function to convert relative image URLs to full backend URLs
  const getImageUrl = (url) => {
    if (!url) return '/images/default-listing.jpg';
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
    const displayCategory = listing.category === 'Other' && listing.customCategory 
      ? listing.customCategory 
      : listing.category;
    const matchesSearch =
      listing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (listing.description && listing.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      listing.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (listing.customCategory && listing.customCategory.toLowerCase().includes(searchQuery.toLowerCase()));
    
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
        const categoryA = a.category === 'Other' && a.customCategory ? a.customCategory : a.category;
        const categoryB = b.category === 'Other' && b.customCategory ? b.customCategory : b.category;
        comparison = categoryA.localeCompare(categoryB);
        break;
      default:
        comparison = 0;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, showActiveOnly, sortBy, sortOrder]);

  // Paginate listings
  const paginatedListings = sortedListings.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handle3DModelChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate 3D model file type - only .glb allowed
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.glb')) {
        setToastNotification({ open: true, message: 'Please select a .glb file (GLTF Binary format)', severity: 'error' });
        if (e.target) {
          e.target.value = '';
        }
        return;
      }

      // Check file size (max 150MB for 3D models)
      const maxSize = 150 * 1024 * 1024;
      if (file.size > maxSize) {
        setToastNotification({ open: true, message: '3D model file size must be less than 150MB', severity: 'error' });
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

  // Handle multiple 3D model files for bundle services
  const handle3DModelsChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const maxSize = 150 * 1024 * 1024; // 150MB per file
        const validFiles = [];
        const invalidFiles = [];

        files.forEach((file) => {
          const fileName = file.name.toLowerCase();
          if (!fileName.endsWith('.glb')) {
            invalidFiles.push(`${file.name}: Not a .glb file`);
            return;
          }
          if (file.size > maxSize) {
            invalidFiles.push(`${file.name}: File size exceeds 150MB`);
        return;
      }
      validFiles.push(file);
    });

    if (invalidFiles.length > 0) {
      setToastNotification({ open: true, message: `Some files were rejected:\n${invalidFiles.join('\n')}`, severity: 'error' });
    }

    if (validFiles.length > 0) {
      setModel3DFiles(validFiles);
      setModel3DPreviews(validFiles.map((file) => ({
        name: file.name,
        size: file.size,
        id: `preview-${Date.now()}-${Math.random()}`,
      })));
      setModel3DFileMeta(validFiles.map(() => createDefaultPhysicalProps()));
      if (invalidFiles.length === 0) {
        setError('');
      }
    }

    // Clear file input
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleRemove3DModelFile = (index) => {
    const newFiles = model3DFiles.filter((_, i) => i !== index);
    const newPreviews = model3DPreviews.filter((_, i) => i !== index);
    setModel3DFiles(newFiles);
    setModel3DPreviews(newPreviews);
    setModel3DFileMeta((prev) => prev.filter((_, i) => i !== index));
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

  // Floorplan editor handlers
  const handleFloorplanExport = async (exportData) => {
    try {
      // Convert the GLB blob to a File object
      const glbFile = new File(
        [exportData.glbBlob],
        exportData.glbFileName || 'venue-model.glb',
        { type: 'model/gltf-binary' }
      );

      // Set as the model file
      setModel3DFile(glbFile);
      setModel3DPreview('venue-floorplan.glb');
      setFloorplanData(exportData.floorplan);
      setFloorplanEditorOpen(false);
      setToastNotification({
        open: true,
        message: 'Floorplan exported successfully! The 3D model will be saved when you save the listing.',
        severity: 'success',
      });
    } catch (err) {
      console.error('Error handling floorplan export:', err);
      setToastNotification({ open: true, message: err.message || 'Failed to export floorplan', severity: 'error' });
    }
  };

  const handleFloorplanChange = (data) => {
    // Data is now in plancraft format: { points: [], walls: [] }
    setFloorplanData(data);
  };

  // Component management handlers
  const createDefaultPhysicalProps = () => ({
    width: '',
    height: '',
    depth: '',
    isStackable: false,
  });

  const buildDimensionsPayloadFromState = (stateObj = {}) => {
    const payload = {};
    ['width', 'height', 'depth'].forEach((axis) => {
      const raw = stateObj[axis];
      if (raw === '' || raw === null || raw === undefined) return;
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) {
        payload[axis] = value;
      }
    });
    return Object.keys(payload).length > 0 ? payload : null;
  };

  const updateComponentPhysicalProps = (componentKey, patch) => {
    setComponentPhysicalProps((prev) => ({
      ...prev,
      [componentKey]: {
        ...(prev[componentKey] || createDefaultPhysicalProps()),
        ...patch,
      },
    }));
  };

  const updateModel3DFileMeta = (index, patch) => {
    setModel3DFileMeta((prev) => {
      const next = [...prev];
      const existing = next[index] || createDefaultPhysicalProps();
      next[index] = { ...existing, ...patch };
      return next;
    });
  };

  const handleAddComponent = () => {
    const newComponent = {
      id: `temp-${Date.now()}`,
      designElementId: '',
      quantityPerUnit: 1,
      role: '',
    };
    const nextComponents = [...components, newComponent];
    setComponents(nextComponents);
    setComponentPhysicalProps((prev) => ({
      ...prev,
      [newComponent.id]: prev[newComponent.id] || createDefaultPhysicalProps(),
    }));
  };

  const handleRemoveComponent = (index) => {
    const nextComponents = components.filter((_, i) => i !== index);
    setComponents(nextComponents);
    setComponentPhysicalProps((prev) => {
      const next = {};
      nextComponents.forEach((comp) => {
        next[comp.id] = prev[comp.id] || createDefaultPhysicalProps();
      });
      return next;
    });
    setComponent3DFiles((prev) => {
      const next = {};
      nextComponents.forEach((comp) => {
        if (prev[comp.id]) {
          next[comp.id] = prev[comp.id];
        }
      });
      return next;
    });
    setComponent3DPreviews((prev) => {
      const next = {};
      nextComponents.forEach((comp) => {
        if (prev[comp.id]) {
          next[comp.id] = prev[comp.id];
        }
      });
      return next;
    });
  };

  const handleComponentChange = (index, field, value) => {
    const updated = [...components];
    updated[index] = { ...updated[index], [field]: value };
    setComponents(updated);
  };

  // Handle 3D model upload for a specific component
  const handleComponent3DModelChange = (componentKey, e) => {
    const file = e.target.files[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.glb')) {
        setToastNotification({ open: true, message: 'Please select a .glb file (GLTF Binary format)', severity: 'error' });
        if (e.target) {
          e.target.value = '';
        }
        return;
      }

      const maxSize = 150 * 1024 * 1024;
        if (file.size > maxSize) {
        setToastNotification({ open: true, message: '3D model file size must be less than 150MB', severity: 'error' });
        if (e.target) {
          e.target.value = '';
        }
        return;
      }

      setComponent3DFiles((prev) => ({ ...prev, [componentKey]: file }));
      setComponent3DPreviews((prev) => ({
        ...prev,
        [componentKey]: { name: file.name, size: file.size },
      }));
      updateComponentPhysicalProps(componentKey, {});
      setError('');
    }
  };

  const handleRemoveComponent3DModel = (componentKey) => {
    setComponent3DFiles((prev) => {
      const updated = { ...prev };
      delete updated[componentKey];
      return updated;
    });
    setComponent3DPreviews((prev) => {
      const updated = { ...prev };
      delete updated[componentKey];
      return updated;
    });
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
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenModal()}
              sx={{
                backgroundColor: '#e16789',
                color: '#ffffff',
                textTransform: 'none',
                px: 3,
                fontWeight: 600,
                '&:hover': { backgroundColor: '#d1537a' },
              }}
            >
              Create New Listing
            </Button>
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
                borderRadius: 1,
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
                borderRadius: 1,
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
                borderRadius: 1,
                backgroundColor: '#fff',
              },
            }}
          >
            <MenuItem value="desc">Descending</MenuItem>
            <MenuItem value="asc">Ascending</MenuItem>
          </TextField>
        </Box>

        {/* Listings Table */}
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
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenModal()}
              sx={{
                backgroundColor: '#e16789',
                color: '#ffffff',
                textTransform: 'none',
                px: 3,
                fontWeight: 600,
                '&:hover': { backgroundColor: '#d1537a' },
              }}
            >
              Create New Listing
            </Button>
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
          <TableContainer component={Paper}>
            <Table sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ width: 100 }}>Image</TableCell>
                  <TableCell align="center" sx={{ width: 200 }}>
                    <TableSortLabel
                      active={sortBy === 'name'}
                      direction={sortBy === 'name' ? sortOrder : 'asc'}
                      onClick={() => {
                        if (sortBy === 'name') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('name');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <Box component="span" sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>Name</Box>
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center" sx={{ width: 150 }}>
                    <TableSortLabel
                      active={sortBy === 'category'}
                      direction={sortBy === 'category' ? sortOrder : 'asc'}
                      onClick={() => {
                        if (sortBy === 'category') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('category');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <Box component="span" sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>Category</Box>
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center" sx={{ width: 120 }}>
                    <TableSortLabel
                      active={sortBy === 'price'}
                      direction={sortBy === 'price' ? sortOrder : 'asc'}
                      onClick={() => {
                        if (sortBy === 'price') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('price');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <Box component="span" sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>Price</Box>
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center" sx={{ width: 100 }}>Status</TableCell>
                  <TableCell align="center" sx={{ width: 140 }}>Availability</TableCell>
                  <TableCell align="center" sx={{ width: 120 }}>Pricing Policy</TableCell>
                  <TableCell align="center" sx={{ width: 200 }}>Components</TableCell>
                  <TableCell align="center" sx={{ width: 120 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedListings.map((listing) => (
                  <TableRow key={listing.id} hover>
                    <TableCell align="center" sx={{ width: 100 }}>
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          mx: 'auto',
                          borderRadius: 1,
                          overflow: 'hidden',
                          backgroundColor: '#f5f5f5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                        }}
                      >
                        <img
                          src={getImageUrl(listing.images?.[0])}
                          alt={listing.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                          onError={(e) => {
                            if (e.target.src !== '/images/default-listing.jpg') {
                              e.target.src = '/images/default-listing.jpg';
                            }
                          }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: 200 }}>
                      <Typography noWrap title={listing.name}>{listing.name || '-'}</Typography>
                    </TableCell>
                    <TableCell sx={{ width: 150 }}>
                      <Typography noWrap title={listing.category === 'Other' && listing.customCategory ? listing.customCategory : listing.category}>
                        {listing.category === 'Other' && listing.customCategory ? listing.customCategory : listing.category}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ width: 120 }}>
                      {listing.pricingPolicy === 'time_based' ? (
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            RM {parseFloat(listing.hourlyRate || 0).toLocaleString()}/hr
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Time-based
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          RM {parseFloat(listing.price || 0).toLocaleString()}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ width: 100 }}>
                      <Chip
                        size="small"
                        label={listing.isActive ? 'Active' : 'Inactive'}
                        color={listing.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ width: 140 }}>
                      {listing.availabilityType ? (
                        <Chip
                          size="small"
                          label={listing.availabilityType === 'exclusive' ? 'Exclusive' : listing.availabilityType === 'reusable' ? 'Reusable' : 'Quantity-based'}
                          sx={{
                            backgroundColor: listing.availabilityType === 'exclusive' ? '#e3f2fd' : listing.availabilityType === 'reusable' ? '#f3e5f5' : '#fff3e0',
                            color: listing.availabilityType === 'exclusive' ? '#1976d2' : listing.availabilityType === 'reusable' ? '#7b1fa2' : '#e65100',
                          }}
                        />
                      ) : (
                        '-'
                      )}
                      {listing.availabilityType === 'quantity_based' && listing.maxQuantity && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                          Max: {listing.maxQuantity}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ width: 120 }}>
                      {listing.pricingPolicy ? (
                        <Chip
                          size="small"
                          label={PRICING_POLICIES[listing.pricingPolicy] || (listing.pricingPolicy === 'flat' ? 'Fixed Package' : listing.pricingPolicy.replace(/_/g, ' '))}
                          sx={{
                            backgroundColor: '#e8f5e9',
                            color: '#2e7d32',
                          }}
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell sx={{ width: 200 }}>
                      {listing.components && listing.components.length > 0 ? (
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }} noWrap title={
                          listing.components.map((comp, idx) => {
                            const elementName = comp.designElement?.name || comp.designElement?.elementType || 'Element';
                            return `${comp.quantityPerUnit} ${comp.role || elementName}`;
                          }).join(', ')
                        }>
                          {listing.components.map((comp, idx) => {
                            const elementName = comp.designElement?.name || comp.designElement?.elementType || 'Element';
                            return `${comp.quantityPerUnit} ${comp.role || elementName}`;
                          }).join(', ')}
                        </Typography>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ width: 120 }}>
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenModal(listing)}
                          title="Edit"
                          sx={{ color: '#666' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(listing.id)}
                          title="Delete"
                          sx={{ color: '#d32f2f' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={sortedListings.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </TableContainer>
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

        <DialogContent sx={{ pt: 3, maxHeight: '80vh', overflowY: 'auto' }}>
          {/* Use wizard for new listings, old form for editing */}
          {!editingListing ? (
            <ListingWizard
              initialData={editingListing}
              onComplete={handleWizardComplete}
              onCancel={handleCloseModal}
              designElements={designElements}
              onFloorplanEditorOpen={() => setFloorplanEditorOpen(true)}
              floorplanData={floorplanData}
              // Media props
              onImageChange={handleImageChange}
              onImageRemove={handleRemoveImage}
              imagePreviews={imagePreviews}
              on3DModelChange={handle3DModelChange}
              on3DModelRemove={handleRemove3DModel}
              model3DFile={model3DFile}
              model3DPreview={model3DPreview}
              onDesignElementSelect={setSelectedDesignElementId}
              selectedDesignElementId={selectedDesignElementId}
              useExistingDesignElement={useExistingDesignElement}
              model3DSource={model3DSource}
              onModel3DSourceChange={(value) => {
                setModel3DSource(value);
                if (value === 'existing') {
                  setUseExistingDesignElement(true);
                  setModel3DFile(null);
                  setModel3DPreview(null);
                  setFloorplanData(null);
                } else if (value === 'upload') {
                  setUseExistingDesignElement(false);
                  setSelectedDesignElementId('');
                  setFloorplanData(null);
                } else if (value === 'floorplan') {
                  setUseExistingDesignElement(false);
                  setSelectedDesignElementId('');
                  setModel3DFile(null);
                  setModel3DPreview(null);
                  setFloorplanEditorOpen(true);
                }
              }}
              modelDimensions={modelDimensions}
              onModelDimensionsChange={setModelDimensions}
              isStackable={isStackable}
              onStackableChange={setIsStackable}
              // Bundle components (hidden for venues)
              components={components}
              onAddComponent={handleAddComponent}
              onComponentChange={handleComponentChange}
              onRemoveComponent={handleRemoveComponent}
              component3DFiles={component3DFiles}
              component3DPreviews={component3DPreviews}
              onComponent3DChange={handleComponent3DModelChange}
              onRemoveComponent3DModel={handleRemoveComponent3DModel}
              componentPhysicalProps={componentPhysicalProps}
              onComponentPhysicalPropsChange={updateComponentPhysicalProps}
            />
          ) : (
            <Stack spacing={3} sx={{ mt: 3 }}>
            {/* Name */}
            <TextField
              fullWidth
              label="Service Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              helperText="10-100 characters, no special characters"
              required
              sx={{ '& .MuiInputBase-input':{border: 'none'}, '& .MuiFormHelperText-root': { fontSize: '12px' } }}
            />

            {/* 3D Model Preview - Show second (after service name) */}
            {editingListing && (
              <>
                {/* Single model preview (non-bundle) */}
                {components.length === 0 && (() => {
                  // Check if we have a design element from editingListing or from selectedDesignElementId
                  let designElement = editingListing.designElement;
                  
                  // If no designElement in editingListing but we have selectedDesignElementId, find it
                  if (!designElement && selectedDesignElementId && useExistingDesignElement) {
                    designElement = designElements.find(el => el.id === selectedDesignElementId);
                  }
                  
                  // Show preview if we have a design element with a model file
                  if (designElement && designElement.modelFile) {
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
                    
                    return (
                      <Box>
                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                          3D Model Preview
                        </Typography>
                        <Model3DViewer
                          modelUrl={getModelUrl(designElement.modelFile)}
                          width="100%"
                          height="400px"
                          targetDimensions={designElement.dimensions}
                        />
                      </Box>
                    );
                  }
                  return null;
                })()}
                
                {/* Bundle preview with component switching */}
                {components.length > 0 && (
                  <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        3D Model Preview
                      </Typography>
                      <TextField
                        select
                        size="small"
                        value={previewComponentIndex !== null ? previewComponentIndex : ''}
                        onChange={(e) => setPreviewComponentIndex(e.target.value !== '' ? parseInt(e.target.value) : null)}
                        sx={{ minWidth: 200 }}
                      >
                        <MenuItem value="">
                          <em>Select component to preview</em>
                        </MenuItem>
                        {components.map((component, index) => {
                          const hasModel = component.designElementId || component3DFiles[component.id];
                          if (!hasModel) return null;
                          
                          const element = designElements.find(el => el.id === component.designElementId);
                          const componentName = component.role || element?.name || element?.elementType || `Component ${index + 1}`;
                          
                          return (
                            <MenuItem key={index} value={index}>
                              {componentName}
                            </MenuItem>
                          );
                        })}
                      </TextField>
                    </Box>
                    {previewComponentIndex !== null && (() => {
                      const component = components[previewComponentIndex];
                      if (!component) return null;
                      
                      // Check if there's a newly uploaded file
                      const componentKey = component.id || `component-${previewComponentIndex}`;
                      if (component3DFiles[componentKey] && previewBlobUrl) {
                        return (
                          <Model3DViewer
                            modelUrl={previewBlobUrl}
                            width="100%"
                            height="400px"
                          />
                        );
                      }
                      
                      // Check if there's an existing design element
                      if (component.designElementId) {
                        const element = designElements.find(el => el.id === component.designElementId);
                        if (element && element.modelFile) {
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
                          
                          return (
                            <Model3DViewer
                              modelUrl={getModelUrl(element.modelFile)}
                              width="100%"
                              height="400px"
                              targetDimensions={element.dimensions}
                            />
                          );
                        }
                      }
                      
                      return (
                        <Box sx={{ p: 3, textAlign: 'center', backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            No 3D model available for this component
                          </Typography>
                        </Box>
                      );
                    })()}
                    {previewComponentIndex === null && (
                      <Box sx={{ p: 3, textAlign: 'center', backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Select a component from the dropdown to preview its 3D model
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </>
            )}

            {/* Category */}
            <TextField
              fullWidth
              select
              label="Category"
              value={formData.category}
              onChange={(e) => {
                handleInputChange('category', e.target.value);
                // Clear customCategory if category is not "Other"
                if (e.target.value !== 'Other') {
                  handleInputChange('customCategory', '');
                }
              }}
              helperText="Select the category for this service"
              required
              sx={{ '& .MuiFormHelperText-root': { fontSize: '12px' } }}
            >
              {VENDOR_CATEGORIES.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </TextField>

            {/* Custom Category - Only show when "Other" is selected */}
            {formData.category === 'Other' && (
              <TextField
                fullWidth
                label="Custom Category Name"
                value={formData.customCategory}
                onChange={(e) => handleInputChange('customCategory', e.target.value)}
                helperText="Enter a custom category name (2-50 characters)"
                required
                sx={{ '& .MuiFormHelperText-root': { fontSize: '12px' } }}
              />
            )}

            {/* Description */}
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              helperText={`${formData.description.length}/2000 characters (optional, min 10 if provided)`}
              multiline
              rows={4}
              sx={{ '& .MuiFormHelperText-root': { fontSize: '12px' } }}
            />

            {/* Price - Not required for time_based */}
            <TextField
              fullWidth
              label="Base Price (RM)"
              type="number"
              value={formData.price}
              onChange={(e) => handleInputChange('price', e.target.value)}
              helperText={
                formData.pricingPolicy === 'time_based' 
                  ? 'Not required for this pricing policy' 
                  : 'Base price for this service'
              }
              required={formData.pricingPolicy !== 'time_based'}
              inputProps={{ min: 0, step: 0.01 }}
              sx={{ '& .MuiFormHelperText-root': { fontSize: '12px' } }}
            />

            {/* Availability Type - Disabled for venues (always exclusive) */}
            {formData.category === 'Venue' ? (
              <Box
                sx={{
                  p: 2,
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                  backgroundColor: '#f8f9fa',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                  Availability Type: Exclusive
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Venue listings are always exclusive - one booking per date
                </Typography>
              </Box>
            ) : (
              <TextField
                fullWidth
                select
                label="Availability Type"
                value={formData.availabilityType}
                onChange={(e) => handleInputChange('availabilityType', e.target.value)}
                helperText="How this service can be booked"
                sx={{ '& .MuiFormHelperText-root': { fontSize: '12px' } }}
              >
                <MenuItem value="exclusive">
                  Exclusive - One booking per date (e.g., single ballroom)
                </MenuItem>
                <MenuItem value="reusable">
                  Reusable - Multiple bookings allowed (e.g., bouquets)
                </MenuItem>
                <MenuItem value="quantity_based">
                  Quantity-based - Track available quantity (e.g., table sets)
                </MenuItem>
              </TextField>
            )}

            {/* Max Quantity - Only show when quantity_based */}
            {formData.availabilityType === 'quantity_based' && (
              <TextField
                fullWidth
                label="Max Quantity"
                type="number"
                value={formData.maxQuantity}
                onChange={(e) => handleInputChange('maxQuantity', e.target.value)}
                helperText="Maximum available quantity for this service"
                required
                inputProps={{ min: 1, step: 1 }}
                sx={{ '& .MuiFormHelperText-root': { fontSize: '12px' } }}
              />
            )}

            {/* Pricing Policy */}
            <TextField
              fullWidth
              select
              label="Pricing Policy"
              value={formData.pricingPolicy}
              onChange={(e) => handleInputChange('pricingPolicy', e.target.value)}
              helperText="How the price is calculated"
              sx={{ '& .MuiFormHelperText-root': { fontSize: '12px' } }}
            >
              {Object.entries(getAvailablePricingPolicies(formData.category, formData.availabilityType)).map(([key, label]) => (
                <MenuItem key={key} value={key}>
                  {label}
                </MenuItem>
              ))}
            </TextField>

            {/* Hourly Rate - Only show when time_based pricing is selected */}
            {formData.pricingPolicy === 'time_based' && (
              <TextField
                fullWidth
                label="Hourly Rate (RM)"
                type="number"
                value={formData.hourlyRate}
                onChange={(e) => handleInputChange('hourlyRate', e.target.value)}
                helperText="The rate charged per hour for this service"
                required
                inputProps={{ min: 0, step: 0.01 }}
                sx={{ '& .MuiFormHelperText-root': { fontSize: '12px' } }}
              />
            )}


            {/* Bundle Toggle - Hide for venue listings when editing */}
            {!(editingListing && editingListing.category === 'Venue') && (
            <Box sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fafafa' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isBundle}
                    onChange={(e) => {
                      handleInputChange('isBundle', e.target.checked);
                      if (!e.target.checked) {
                        // Clear components when disabling bundle
                        setComponents([]);
                      }
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      This is a bundle service
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Enable this if your service consists of multiple components (e.g., "Table Set" = 1 table + 10 chairs)
                    </Typography>
                  </Box>
                }
              />
            </Box>
            )}

            {/* Service Components Section - Only show when bundle is enabled */}
            {formData.isBundle && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Service Components
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddComponent}
                  sx={{
                    textTransform: 'none',
                    borderColor: '#e0e0e0',
                    color: '#666',
                    '&:hover': { borderColor: '#e16789', color: '#e16789' },
                  }}
                >
                  Add Component
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Define what makes up 1 unit of this service (e.g., "Table Set" = 1 table + 10 chairs).
                <br />
                <strong>Tip:</strong> Upload 3D models in the <a href="/vendor/design-elements" target="_blank" style={{ color: '#e16789', textDecoration: 'none' }}>Design Elements Library</a> first, then select them here for better organization and reuse.
              </Typography>

              {components.length > 0 && (
                <Stack spacing={2}>
                  {components.map((component, index) => {
                    const componentKey = component.id || `component-${index}`;
                    const physicalProps = componentPhysicalProps[componentKey] || createDefaultPhysicalProps();
                    const componentPreview = component3DPreviews[componentKey];
                    const hasPendingUpload = Boolean(component3DFiles[componentKey]);
                    const shouldShowPhysicalConfig = hasPendingUpload || !component.designElementId;

                    return (
                      <Box
                      key={componentKey}
                      sx={{
                        p: 2,
                        border: '1px solid #e0e0e0',
                        borderRadius: 2,
                        backgroundColor: '#fafafa',
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          Component {index + 1}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveComponent(index)}
                          sx={{ color: '#d32f2f' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Stack spacing={2}>
                        <Box display="flex" gap={1} alignItems="flex-start">
                          <TextField
                            fullWidth
                            select
                            label="Design Element"
                            value={component.designElementId || ''}
                            onChange={(e) => handleComponentChange(index, 'designElementId', e.target.value)}
                            size="small"
                            helperText="Select existing or upload new 3D model below"
                            disabled={loadingDesignElements}
                          >
                            <MenuItem value="">
                              <em>None selected</em>
                            </MenuItem>
                            {designElements.map((element) => (
                              <MenuItem key={element.id} value={element.id}>
                                {element.name || element.elementType || `Element ${element.id.slice(0, 8)}`}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Box>
                        
                        {/* Per-component 3D model upload */}
                        <Box>
                          <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                            Or upload new 3D model for this component:
                          </Typography>
                          <input
                            type="file"
                            accept=".glb"
                            onChange={(e) => handleComponent3DModelChange(componentKey, e)}
                            style={{ display: 'none' }}
                            id={`component-3d-upload-${componentKey}`}
                          />
                          <label htmlFor={`component-3d-upload-${componentKey}`}>
                            <Button
                              variant="outlined"
                              component="span"
                              size="small"
                              startIcon={<ThreeDIcon />}
                              sx={{
                                textTransform: 'none',
                                borderColor: '#e0e0e0',
                                color: '#666',
                                fontSize: '0.75rem',
                                '&:hover': { borderColor: '#e16789', color: '#e16789' },
                              }}
                            >
                              Upload 3D Model
                            </Button>
                          </label>
                          
                          {componentPreview && (
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                mt: 1,
                                p: 1,
                                backgroundColor: '#f5f5f5',
                                borderRadius: 1,
                              }}
                            >
                              <ThreeDIcon sx={{ color: '#666', fontSize: '1rem' }} />
                              <Typography variant="caption" sx={{ flex: 1, color: '#666' }}>
                                {componentPreview.name} ({(componentPreview.size / 1024 / 1024).toFixed(2)} MB)
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveComponent3DModel(componentKey)}
                                sx={{ color: '#d32f2f', padding: '4px' }}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          )}
                          
                          {hasPendingUpload && (
                            <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
                              ✓ 3D model will be uploaded and linked to this component
                            </Typography>
                          )}

                          {shouldShowPhysicalConfig && (
                            <Box
                              sx={{
                                mt: 1.5,
                                p: 1.5,
                                borderRadius: 1,
                                border: '1px dashed #d3d3d3',
                                backgroundColor: '#fff',
                              }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                                Physical Properties (required for scaling)
                              </Typography>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
                                <TextField
                                  label="Width (X)"
                                  type="number"
                                  size="small"
                                  value={physicalProps.width}
                                  onChange={(e) => updateComponentPhysicalProps(componentKey, { width: e.target.value })}
                                  InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                                  inputProps={{ step: '0.01', min: '0' }}
                                />
                                <TextField
                                  label="Height (Y)"
                                  type="number"
                                  size="small"
                                  value={physicalProps.height}
                                  onChange={(e) => updateComponentPhysicalProps(componentKey, { height: e.target.value })}
                                  InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                                  inputProps={{ step: '0.01', min: '0' }}
                                />
                                <TextField
                                  label="Depth (Z)"
                                  type="number"
                                  size="small"
                                  value={physicalProps.depth}
                                  onChange={(e) => updateComponentPhysicalProps(componentKey, { depth: e.target.value })}
                                  InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                                  inputProps={{ step: '0.01', min: '0' }}
                                />
                              </Stack>
                              <FormControlLabel
                                control={
                                  <Switch
                                    size="small"
                                    checked={Boolean(physicalProps.isStackable)}
                                    onChange={(e) => updateComponentPhysicalProps(componentKey, { isStackable: e.target.checked })}
                                  />
                                }
                                label={
                                  <Typography variant="caption" color="text.secondary">
                                    Stackable (can be placed on tables/surfaces)
                                  </Typography>
                                }
                              />
                            </Box>
                          )}
                        </Box>
                        <Box display="flex" gap={2}>
                          <TextField
                            fullWidth
                            label="Quantity Per Unit"
                            type="number"
                            value={component.quantityPerUnit}
                            onChange={(e) => handleComponentChange(index, 'quantityPerUnit', parseInt(e.target.value) || 1)}
                            size="small"
                            required
                            inputProps={{ min: 1, step: 1 }}
                          />
                          <TextField
                            fullWidth
                            label="Role (Optional)"
                            value={component.role || ''}
                            onChange={(e) => handleComponentChange(index, 'role', e.target.value)}
                            placeholder="e.g., table, chair"
                            size="small"
                          />
                        </Box>
                      </Stack>
                    </Box>
                  );
                })}
                </Stack>
              )}

              {components.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                  No components added. Click "Add Component" to define bundle composition.
                </Typography>
              )}
            </Box>
            )}

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

            {/* 3D Model Upload - Hide for venue listings when editing */}
            {!(editingListing && editingListing.category === 'Venue') && (
            <Box>
              {components.length === 0 ? (
                // Single 3D model for non-bundle services
                <>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    3D Model (Optional)
                  </Typography>
                  
                  {/* Toggle between existing, upload, and floorplan (for venues) */}
                  <FormControl component="fieldset" sx={{ mb: 2, width: '100%' }}>
                    <RadioGroup
                      row
                      value={model3DSource}
                      onChange={(e) => {
                        const value = e.target.value;
                        setModel3DSource(value);
                        
                        if (value === 'existing') {
                          setUseExistingDesignElement(true);
                          setModel3DFile(null);
                          setModel3DPreview(null);
                          setFloorplanData(null);
                        } else if (value === 'upload') {
                          setUseExistingDesignElement(false);
                          setSelectedDesignElementId('');
                          setFloorplanData(null);
                        } else if (value === 'floorplan') {
                          setUseExistingDesignElement(false);
                          setSelectedDesignElementId('');
                          setModel3DFile(null);
                          setModel3DPreview(null);
                          setFloorplanEditorOpen(true);
                        }
                      }}
                    >
                      <FormControlLabel
                        value="existing"
                        control={<Radio size="small" />}
                        label="Select from existing"
                      />
                      <FormControlLabel
                        value="upload"
                        control={<Radio size="small" />}
                        label="Upload new"
                      />
                      {formData.category === 'Venue' && (
                        <FormControlLabel
                          value="floorplan"
                          control={<Radio size="small" />}
                          label="Draw Floorplan"
                        />
                      )}
                    </RadioGroup>
                  </FormControl>

                  {useExistingDesignElement ? (
                    // Select from existing design elements
                    <Box sx={{ mb: 2 }}>
                      <TextField
                        select
                        fullWidth
                        label="Select Design Element"
                        value={selectedDesignElementId}
                        onChange={(e) => setSelectedDesignElementId(e.target.value)}
                        size="small"
                        sx={{ mb: 1 }}
                      >
                        <MenuItem value="">
                          <em>None</em>
                        </MenuItem>
                        {designElements.map((element) => (
                          <MenuItem key={element.id} value={element.id}>
                            {element.name || element.elementType || `Element ${element.id.slice(0, 8)}`}
                            {element.modelFile && ' (3D Model)'}
                          </MenuItem>
                        ))}
                      </TextField>
                      {selectedDesignElementId && (
                        <Typography variant="caption" color="text.secondary">
                          Selected design element will be linked to this listing
                        </Typography>
                      )}
                    </Box>
                  ) : model3DSource === 'upload' ? (
                    // Upload new 3D model
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        .glb format only, max 150MB
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
                    </>
                  ) : (
                    // Draw Floorplan option
                    <>
                      <Box
                        sx={{
                          p: 2,
                          border: '1px solid #e0e0e0',
                          borderRadius: 1,
                          backgroundColor: '#f8f9fa',
                          mb: 2,
                        }}
                      >
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Draw your venue floorplan to generate a 3D model automatically.
                        </Typography>
                        <Button
                          variant="outlined"
                          onClick={() => setFloorplanEditorOpen(true)}
                          sx={{
                            textTransform: 'none',
                            borderColor: '#e16789',
                            color: '#e16789',
                            '&:hover': { borderColor: '#d1537a', backgroundColor: 'rgba(225, 103, 137, 0.04)' },
                          }}
                        >
                          {floorplanData ? 'Edit Floorplan' : 'Open Floorplan Editor'}
                        </Button>
                        {floorplanData && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            ✓ Floorplan ready ({floorplanData.points?.length || 0} points, {floorplanData.walls?.length || 0} walls)
                          </Typography>
                        )}
                      </Box>
                    </>
                  )}

                  {/* Dimensions and Settings (creation only; edits managed in Design Elements) */}
                  {!editingListing && (((!useExistingDesignElement && (model3DPreview || floorplanData)) || (useExistingDesignElement && selectedDesignElementId))) && (
                    <Box sx={{ mt: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#f8f9fa' }}>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                        3D Model Settings
                      </Typography>

                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Real-world dimensions (in meters) for accurate scaling:
                      </Typography>
                      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                        <TextField
                          label="Width (X)"
                          type="number"
                          size="small"
                          value={modelDimensions.width}
                          onChange={(e) => setModelDimensions((prev) => ({ ...prev, width: e.target.value }))}
                          InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                          disabled={useExistingDesignElement}
                          inputProps={{ step: '0.01', min: '0' }}
                          sx={{ backgroundColor: '#fff' }}
                        />
                        <TextField
                          label="Height (Y)"
                          type="number"
                          size="small"
                          value={modelDimensions.height}
                          onChange={(e) => setModelDimensions((prev) => ({ ...prev, height: e.target.value }))}
                          InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                          disabled={useExistingDesignElement}
                          inputProps={{ step: '0.01', min: '0' }}
                          sx={{ backgroundColor: '#fff' }}
                        />
                        <TextField
                          label="Depth (Z)"
                          type="number"
                          size="small"
                          value={modelDimensions.depth}
                          onChange={(e) => setModelDimensions((prev) => ({ ...prev, depth: e.target.value }))}
                          InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                          disabled={useExistingDesignElement}
                          inputProps={{ step: '0.01', min: '0' }}
                          sx={{ backgroundColor: '#fff' }}
                        />
                      </Stack>

                      <FormControlLabel
                        control={
                          <Switch
                            checked={isStackable}
                            onChange={(e) => setIsStackable(e.target.checked)}
                            color="primary"
                            disabled={useExistingDesignElement}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              Stackable Item
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Can be placed on top of tables or other surfaces (e.g., Centerpieces, Tableware)
                            </Typography>
                          </Box>
                        }
                      />
                    </Box>
                  )}
                </>
              ) : (
                // Multiple 3D models for bundle services
                <>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    3D Models for Components (Optional, .glb format only, max 150MB each)
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                    Upload 3D model files for each component. Each file will create a DesignElement that you can then select in the components section above. You can upload up to {components.length} file(s) matching your components.
                  </Typography>
                  <input
                    type="file"
                    accept=".glb"
                    multiple
                    onChange={handle3DModelsChange}
                    style={{ display: 'none' }}
                    id="3d-models-upload"
                  />
                  <label htmlFor="3d-models-upload">
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
                      Upload 3D Model Files
                    </Button>
                  </label>

                  {model3DPreviews.length > 0 && (
                    <Stack spacing={1.5} sx={{ mb: 2 }}>
                      {model3DPreviews.map((preview, index) => {
                        const fileMeta = model3DFileMeta[index] || createDefaultPhysicalProps();
                        return (
                          <Box
                            key={preview.id}
                            sx={{
                              p: 1.5,
                              backgroundColor: '#f5f5f5',
                              borderRadius: 1,
                              border: '1px solid #e0e0e0',
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <ThreeDIcon sx={{ color: '#666' }} />
                              <Typography variant="body2" sx={{ flex: 1, color: '#666' }}>
                                {preview.name} ({(preview.size / 1024 / 1024).toFixed(2)} MB)
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => handleRemove3DModelFile(index)}
                                sx={{ color: '#d32f2f' }}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                              <TextField
                                label="Width (X)"
                                type="number"
                                size="small"
                                value={fileMeta.width}
                                onChange={(e) => updateModel3DFileMeta(index, { width: e.target.value })}
                                InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                                inputProps={{ step: '0.01', min: '0' }}
                              />
                              <TextField
                                label="Height (Y)"
                                type="number"
                                size="small"
                                value={fileMeta.height}
                                onChange={(e) => updateModel3DFileMeta(index, { height: e.target.value })}
                                InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                                inputProps={{ step: '0.01', min: '0' }}
                              />
                              <TextField
                                label="Depth (Z)"
                                type="number"
                                size="small"
                                value={fileMeta.depth}
                                onChange={(e) => updateModel3DFileMeta(index, { depth: e.target.value })}
                                InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                                inputProps={{ step: '0.01', min: '0' }}
                              />
                              <FormControlLabel
                                control={
                                  <Switch
                                    size="small"
                                    checked={Boolean(fileMeta.isStackable)}
                                    onChange={(e) => updateModel3DFileMeta(index, { isStackable: e.target.checked })}
                                  />
                                }
                                label="Stackable"
                              />
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}

                  {components.length > 0 && model3DPreviews.length === 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
                      Note: 3D models are optional. You can add components without 3D models, or upload models later.
                    </Typography>
                  )}
                </>
              )}
            </Box>
            )}

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
          )}
        </DialogContent>

        {/* DialogActions only shown when editing (wizard has its own buttons) */}
        {editingListing && (
          <DialogActions sx={{ p: 3, borderTop: '1px solid #e0e0e0', gap: 2 }}>
            <Button onClick={handleCloseModal} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              onClick={() => handleSave()}
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
        )}
      </Dialog>

      {/* Floorplan Editor Modal */}
      <Dialog
        open={floorplanEditorOpen}
        onClose={() => setFloorplanEditorOpen(false)}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: '95vw',
            height: '95vh',
            maxWidth: '95vw',
            maxHeight: '95vh',
            m: 0,
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Draw Venue Floorplan
          </Typography>
          <IconButton onClick={() => setFloorplanEditorOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'hidden', height: 'calc(95vh - 64px)' }}>
          <BlueprintEditor
            onExport={handleFloorplanExport}
            onFloorplanChange={handleFloorplanChange}
            initialFloorplan={floorplanData}
          />
        </DialogContent>
      </Dialog>

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

      {/* Toast Notification */}
      <Snackbar
        open={toastNotification.open}
        autoHideDuration={6000}
        onClose={() => setToastNotification({ ...toastNotification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToastNotification({ ...toastNotification, open: false })}
          severity={toastNotification.severity}
          sx={{ width: '100%' }}
        >
          {toastNotification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ManageListings;

