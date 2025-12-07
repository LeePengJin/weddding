import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Stepper,
  Step,
  StepLabel,
  TextField,
  MenuItem,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Card,
  CardContent,
  Alert,
  Stack,
  Divider,
  IconButton,
  Switch,
  Snackbar,
} from '@mui/material';
import {
  ArrowBack,
  ArrowForward,
  CheckCircle,
  Info as InfoIcon,
  Image as ImageIcon,
  ThreeDRotation as ThreeDIcon,
  Close as CloseIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import Viewer3D from '../ModelDimensionEditor/Viewer3D';

const VENDOR_CATEGORIES = [
  'Photographer',
  'Videographer',
  'Venue',
  'Caterer',
  'Florist',
  'DJ_Music',
  'Other',
];

const AVAILABILITY_TYPES = {
  exclusive: {
    label: 'Exclusive',
    description: 'Only one booking per date. Perfect for venues, photographers, or videographers where only one couple can book per day.',
    examples: 'Single ballroom, one photographer per wedding',
  },
  reusable: {
    label: 'Reusable',
    description: 'Multiple bookings allowed on the same date. Items that can be used by multiple couples simultaneously.',
    examples: 'Bouquets, centerpieces, decorations',
  },
  quantity_based: {
    label: 'Quantity-based',
    description: 'Track available quantity. Useful for items with limited stock that need inventory management.',
    examples: 'Table sets, chair rentals, tableware',
  },
};

const PRICING_POLICIES = {
  fixed_package: {
    label: 'Fixed Package',
    description: 'One fixed price per booking, regardless of design size.',
    when: 'Best for: Venues, photographers, videographers',
  },
  per_table: {
    label: 'Per Table',
    description: 'Price multiplies by the number of tables in the 3D design.',
    when: 'Best for: Table decorations, centerpieces, tableware',
  },
  per_unit: {
    label: 'Per Unit',
    description: 'Price multiplies by the number of items placed in the design (e.g., table sets, chairs).',
    when: 'Best for: Table and chair rentals, complete table setups',
  },
  time_based: {
    label: 'Time Based',
    description: 'Price calculated based on event duration (hourly rate).',
    when: 'Best for: DJs, entertainment, hourly services',
  },
};

// Filter pricing policies based on category
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

const steps = ['Type & Availability', 'Basic Information', 'Media & 3D Model'];

const ListingWizard = ({ 
  initialData = null,
  onComplete,
  onCancel,
  designElements = [],
  onFloorplanEditorOpen,
  floorplanData,
  // Media handlers
  onImageChange,
  onImageRemove,
  imagePreviews = [],
  on3DModelChange,
  on3DModelRemove,
  model3DFile,
  model3DPreview,
  onDesignElementSelect,
  selectedDesignElementId,
  useExistingDesignElement,
  model3DSource,
  onModel3DSourceChange,
  modelDimensions,
  onModelDimensionsChange,
  isStackable,
  onStackableChange,
  // Bundle components (hidden for venues)
  components = [],
  onAddComponent,
  onComponentChange,
  onRemoveComponent,
  component3DFiles = {},
  component3DPreviews = {},
  onComponent3DChange,
  onRemoveComponent3DModel,
  componentPhysicalProps = {},
  onComponentPhysicalPropsChange,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    // Step 1
    category: '',
    customCategory: '',
    availabilityType: 'exclusive',
    maxQuantity: '',
    
    // Step 2
    name: '',
    description: '',
    price: '',
    pricingPolicy: 'fixed_package',
    hourlyRate: '', // For time_based pricing
    cancellationPolicy: '', // Cancellation policy text
    cancellationFeeTiers: { // Cancellation fee percentages
      '>90': 0,
      '30-90': 0.10,
      '7-30': 0.25,
      '<7': 0.50,
    },
    
    // Step 3
    images: [],
    imagePreviews: [],
    has3DModel: false, // Toggle for whether listing has 3D model
    model3DSource: 'upload', // 'existing', 'upload', 'floorplan'
    selectedDesignElementId: '',
    model3DFile: null,
    model3DPreview: null,
    useExistingDesignElement: false,
    
    // 3D Model dimensions
    modelWidth: '',
    modelHeight: '',
    modelDepth: '',
    modelIsStackable: false,
    
    // Bundle components (hidden for venues)
    components: [],
    isBundle: false,
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [dimensionPreviewUrl, setDimensionPreviewUrl] = useState(null);
  const [toastNotification, setToastNotification] = useState({ open: false, message: '', severity: 'error' });

  // Load initial data if editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        category: initialData.category || '',
        customCategory: initialData.customCategory || '',
        availabilityType: initialData.availabilityType || 'exclusive',
        maxQuantity: initialData.maxQuantity ? initialData.maxQuantity.toString() : '',
        name: initialData.name || '',
        description: initialData.description || '',
        price: initialData.price || '',
        pricingPolicy: initialData.pricingPolicy || 'fixed_package',
        hourlyRate: initialData.hourlyRate ? (typeof initialData.hourlyRate === 'string' ? initialData.hourlyRate : parseFloat(initialData.hourlyRate).toString()) : '',
        cancellationPolicy: initialData.cancellationPolicy || '',
        cancellationFeeTiers: initialData.cancellationFeeTiers ? (
          typeof initialData.cancellationFeeTiers === 'string'
            ? JSON.parse(initialData.cancellationFeeTiers)
            : initialData.cancellationFeeTiers
        ) : {
          '>90': 0,
          '30-90': 0.10,
          '7-30': 0.25,
          '<7': 0.50,
        },
        images: initialData.images || [],
        imagePreviews: initialData.images || [],
        has3DModel: !!(initialData.model3DFile || initialData.designElementId || initialData.floorplanData),
        model3DSource: initialData.model3DFile ? 'upload' : (initialData.designElementId ? 'existing' : (initialData.floorplanData ? 'floorplan' : 'upload')),
        selectedDesignElementId: initialData.designElementId || '',
        model3DFile: null,
        model3DPreview: initialData.model3DFile ? 'existing' : null,
        useExistingDesignElement: !!initialData.designElementId,
        modelWidth: initialData.modelWidth || '',
        modelHeight: initialData.modelHeight || '',
        modelDepth: initialData.modelDepth || '',
        modelIsStackable: initialData.modelIsStackable || false,
        components: initialData.components || [],
      });
    }
  }, [initialData]);

  // Build a blob URL for the uploaded 3D model so we can feed it into the dimension editor
  useEffect(() => {
    if (model3DSource === 'upload' && model3DFile) {
      const url = URL.createObjectURL(model3DFile);
      setDimensionPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setDimensionPreviewUrl(null);
  }, [model3DFile, model3DSource]);

  const handleDimensionsChange = useCallback((dims) => {
    const newWidth = dims?.x > 0 ? Number(dims.x).toFixed(2) : '';
    const newHeight = dims?.y > 0 ? Number(dims.y).toFixed(2) : '';
    const newDepth = dims?.z > 0 ? Number(dims.z).toFixed(2) : '';

    onModelDimensionsChange &&
      onModelDimensionsChange({
        ...modelDimensions,
        width: newWidth,
        height: newHeight,
        depth: newDepth,
      });
  }, [modelDimensions, onModelDimensionsChange]);

  const targetDimensions = useMemo(() => {
    if (!modelDimensions) return null;
    const width = parseFloat(modelDimensions.width);
    const height = parseFloat(modelDimensions.height);
    const depth = parseFloat(modelDimensions.depth);
    return {
      width: Number.isFinite(width) && width > 0 ? width : undefined,
      height: Number.isFinite(height) && height > 0 ? height : undefined,
      depth: Number.isFinite(depth) && depth > 0 ? depth : undefined,
    };
  }, [modelDimensions]);

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-set availability type to exclusive for Venue category
      // Also force has3DModel to true for venues (venues must have 3D model)
      if (field === 'category' && value === 'Venue') {
        updated.availabilityType = 'exclusive';
        updated.has3DModel = true; // Venues must have 3D model
      }
      
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
    // Clear errors when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateStep = (step) => {
    const errors = {};
    let errorMessage = '';
    
    if (step === 0) {
      // Step 1: Type & Availability
      if (!formData.category) {
        errors.category = 'Please select a category';
        errorMessage = 'Please select a category';
      } else if (formData.category === 'Other' && !formData.customCategory) {
        errors.customCategory = 'Please enter a custom category name';
        errorMessage = 'Please enter a custom category name';
      } else if (formData.availabilityType === 'quantity_based' && (!formData.maxQuantity || parseFloat(formData.maxQuantity) <= 0)) {
        errors.maxQuantity = 'Please enter a valid maximum quantity';
        errorMessage = 'Please enter a valid maximum quantity';
      }
    } else if (step === 1) {
      // Step 2: Basic Information
      if (!formData.name || formData.name.trim().length < 10) {
        errors.name = 'Name must be at least 10 characters';
        errorMessage = 'Name must be at least 10 characters';
      } else if (formData.name && formData.name.trim().length > 100) {
        errors.name = 'Name must be at most 100 characters';
        errorMessage = 'Name must be at most 100 characters';
      } else if (formData.description && formData.description.length < 10) {
        errors.description = 'Description must be at least 10 characters if provided';
        errorMessage = 'Description must be at least 10 characters if provided';
      } else if (formData.description && formData.description.length > 2000) {
        errors.description = 'Description must be at most 2000 characters';
        errorMessage = 'Description must be at most 2000 characters';
      } else if (!formData.pricingPolicy) {
        errors.pricingPolicy = 'Please select a pricing policy';
        errorMessage = 'Please select a pricing policy';
      } else if (formData.pricingPolicy !== 'time_based') {
        if (!formData.price || parseFloat(formData.price) < 0) {
          errors.price = 'Please enter a valid price';
          errorMessage = 'Please enter a valid price';
        }
      } else if (formData.pricingPolicy === 'time_based') {
        if (!formData.hourlyRate || parseFloat(formData.hourlyRate) <= 0) {
          errors.hourlyRate = 'Hourly rate is required and must be greater than 0';
          errorMessage = 'Hourly rate is required and must be greater than 0';
        }
      }
    } else if (step === 2) {
      // Step 3: Media & 3D Model
      // For venues, floorplan is required
      if (formData.category === 'Venue' && !floorplanData) {
        errors.floorplan = 'Floorplan is required for venue listings. Please draw the floorplan.';
        errorMessage = 'Floorplan is required for venue listings. Please draw the floorplan.';
      }
    }
    
    if (Object.keys(errors).length > 0 && errorMessage) {
      setToastNotification({ open: true, message: errorMessage, severity: 'error' });
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleComplete = () => {
    // Validate all steps before completing
    let allValid = true;
    const allErrors = {};

    // Validate step 0 (Type & Availability)
    const step0Errors = {};
    if (!formData.category) {
      step0Errors.category = 'Please select a category';
      allValid = false;
    }
    if (formData.category === 'Other' && !formData.customCategory) {
      step0Errors.customCategory = 'Please enter a custom category name';
      allValid = false;
    }
    if (formData.availabilityType === 'quantity_based' && (!formData.maxQuantity || parseFloat(formData.maxQuantity) <= 0)) {
      step0Errors.maxQuantity = 'Please enter a valid maximum quantity';
      allValid = false;
    }
    Object.assign(allErrors, step0Errors);

    // Validate step 1 (Basic Information)
    const step1Errors = {};
    if (!formData.name || formData.name.trim().length < 10) {
      step1Errors.name = 'Name must be at least 10 characters';
      allValid = false;
    }
    if (formData.name && formData.name.trim().length > 100) {
      step1Errors.name = 'Name must be at most 100 characters';
      allValid = false;
    }
    if (formData.description && formData.description.length < 10) {
      step1Errors.description = 'Description must be at least 10 characters if provided';
      allValid = false;
    }
    if (formData.description && formData.description.length > 2000) {
      step1Errors.description = 'Description must be at most 2000 characters';
      allValid = false;
    }
    if (!formData.price || parseFloat(formData.price) < 0) {
      step1Errors.price = 'Please enter a valid price';
      allValid = false;
    }
    if (!formData.pricingPolicy) {
      step1Errors.pricingPolicy = 'Please select a pricing policy';
      allValid = false;
    }

    // Validate time_based pricing
    if (formData.pricingPolicy === 'time_based') {
      if (!formData.hourlyRate || parseFloat(formData.hourlyRate) <= 0) {
        step1Errors.hourlyRate = 'Hourly rate is required and must be greater than 0';
        allValid = false;
      }
      // Price is not required for time_based
    } else {
      // Price is required for other pricing policies
      if (!formData.price || parseFloat(formData.price) <= 0) {
        step1Errors.price = 'Price is required and must be greater than 0';
        allValid = false;
      }
    }

    Object.assign(allErrors, step1Errors);

    // Validate step 2 (Media & 3D Model) - for venues, floorplan is required
    const step2Errors = {};
    if (formData.category === 'Venue' && !floorplanData) {
      step2Errors.floorplan = 'Floorplan is required for venue listings. Please draw the floorplan.';
      allValid = false;
    }
    Object.assign(allErrors, step2Errors);

    // Only set errors if validation failed, otherwise clear them
    if (!allValid) {
      setFieldErrors(allErrors);
      // Show toast with first error message
      const firstErrorKey = Object.keys(allErrors)[0];
      const firstErrorMessage = allErrors[firstErrorKey];
      if (firstErrorMessage) {
        setToastNotification({ open: true, message: firstErrorMessage, severity: 'error' });
      }
      // Navigate to the first step with errors
      if (Object.keys(step0Errors).length > 0) {
        setActiveStep(0);
      } else if (Object.keys(step1Errors).length > 0) {
        setActiveStep(1);
      } else if (Object.keys(step2Errors).length > 0) {
        setActiveStep(2);
      }
      return;
    }

    // All valid - clear any existing errors
    setFieldErrors({});

    // All valid, proceed with completion
    const completeData = {
      ...formData,
      images: imagePreviews || [],
      has3DModel: formData.has3DModel || false,
      model3DFile: formData.has3DModel ? model3DFile : null,
      model3DPreview: formData.has3DModel ? model3DPreview : null,
      selectedDesignElementId: formData.has3DModel ? (selectedDesignElementId || '') : '',
      useExistingDesignElement: formData.has3DModel ? (useExistingDesignElement || false) : false,
      model3DSource: formData.has3DModel ? (model3DSource || 'upload') : 'upload',
      modelDimensions: formData.has3DModel ? (modelDimensions || { width: '', height: '', depth: '' }) : { width: '', height: '', depth: '' },
      isStackable: formData.has3DModel ? (isStackable || false) : false,
      components: components || [],
      floorplanData: (formData.category === 'Venue' ? floorplanData : (formData.has3DModel ? floorplanData : null)),
      // Include pricing-specific fields
      hourlyRate: formData.pricingPolicy === 'time_based' ? formData.hourlyRate : undefined,
      // Include cancellation policy fields
      cancellationPolicy: formData.cancellationPolicy || null,
      cancellationFeeTiers: formData.cancellationFeeTiers || null,
      // Include bundle flag
      isBundle: formData.isBundle,
    };
    onComplete(completeData);
  };

  const availablePricingPolicies = getAvailablePricingPolicies(
    formData.category,
    formData.availabilityType
  );

  // Auto-set pricing policy for venues
  useEffect(() => {
    if (formData.category === 'Venue' && formData.pricingPolicy !== 'fixed_package') {
      handleInputChange('pricingPolicy', 'fixed_package');
    }
  }, [formData.category]);

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Step 1: Choose Listing Type & Availability
            </Typography>

            {/* Category Selection */}
            <Box sx={{ mb: 4 }}>
              <TextField
                fullWidth
                select
                label="Listing Category"
                value={formData.category}
                onChange={(e) => {
                  handleInputChange('category', e.target.value);
                  if (e.target.value !== 'Other') {
                    handleInputChange('customCategory', '');
                  }
                }}
                helperText="What type of service is this?"
                required
              >
                {VENDOR_CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </TextField>

              {formData.category === 'Other' && (
                <TextField
                  fullWidth
                  label="Custom Category Name"
                  value={formData.customCategory}
                  onChange={(e) => handleInputChange('customCategory', e.target.value)}
                  helperText="Enter a custom category name (2-50 characters)"
                  required
                  sx={{ mt: 2 }}
                />
              )}
            </Box>

            {/* Availability Type Selection */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="body2" sx={{ mb: 2, fontWeight: 500 }}>
                How can this service be booked?
              </Typography>
              
              {formData.category === 'Venue' ? (
                // For venues, show exclusive as read-only
                <Box
                  sx={{
                    p: 2,
                    border: '2px solid #e16789',
                    borderRadius: 1,
                    backgroundColor: '#fef2f2',
                  }}
                >
                  <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {AVAILABILITY_TYPES.exclusive.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {AVAILABILITY_TYPES.exclusive.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Venue listings are always exclusive - one booking per date
                  </Typography>
                </Box>
              ) : (
                <FormControl component="fieldset" fullWidth>
                  <RadioGroup
                    value={formData.availabilityType}
                    onChange={(e) => handleInputChange('availabilityType', e.target.value)}
                  >
                    {Object.entries(AVAILABILITY_TYPES).map(([key, info]) => (
                      <Card
                        key={key}
                        sx={{
                          mb: 2,
                          border: formData.availabilityType === key ? '2px solid #e16789' : '1px solid #e0e0e0',
                          cursor: 'pointer',
                          '&:hover': { borderColor: '#e16789' },
                          transition: 'all 0.2s',
                        }}
                        onClick={() => handleInputChange('availabilityType', key)}
                      >
                        <CardContent>
                          <FormControlLabel
                            value={key}
                            control={<Radio />}
                            label={
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                                  {info.label}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  {info.description}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                  Examples: {info.examples}
                                </Typography>
                              </Box>
                            }
                            sx={{ width: '100%', m: 0 }}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </RadioGroup>
                </FormControl>
              )}

              {formData.availabilityType === 'quantity_based' && (
                <TextField
                  fullWidth
                  label="Maximum Quantity"
                  type="number"
                  value={formData.maxQuantity}
                  onChange={(e) => handleInputChange('maxQuantity', e.target.value)}
                  helperText="How many units are available?"
                  required
                  inputProps={{ min: 1, step: 1 }}
                  sx={{ mt: 2 }}
                />
              )}
            </Box>

            {formData.category && (
              <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {formData.category === 'Venue' 
                    ? 'Venue listings are simple - just the venue space itself, no bundle components needed.'
                    : 'You\'ll be able to add bundle components (optional) in later steps if needed.'}
                </Typography>
              </Alert>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Step 2: Basic Information
            </Typography>

            {/* Name */}
            <TextField
              fullWidth
              label="Service Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              helperText="A clear, descriptive name for your service (10-100 characters)"
              required
              sx={{ mb: 3 }}
            />

            {/* Description */}
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              helperText={`${formData.description.length}/2000 characters (optional, min 10 if provided)`}
              multiline
              rows={4}
              sx={{ mb: 3 }}
            />

            {/* Price */}
            <TextField
              fullWidth
              label="Base Price (RM)"
              type="number"
              value={formData.price}
              onChange={(e) => handleInputChange('price', e.target.value)}
              helperText={
                formData.pricingPolicy === 'time_based' 
                  ? 'Not required for this pricing policy' 
                  : 'The base price for this service'
              }
              required={formData.pricingPolicy !== 'time_based'}
              inputProps={{ min: 0, step: 0.01 }}
              sx={{ mb: 3 }}
            />

            {/* Pricing Policy */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 2, fontWeight: 500 }}>
                How should the price be calculated?
              </Typography>
              
              <FormControl component="fieldset" fullWidth>
                <RadioGroup
                  value={formData.pricingPolicy}
                  onChange={(e) => handleInputChange('pricingPolicy', e.target.value)}
                >
                  {Object.entries(availablePricingPolicies).map(([key, info]) => (
                    <Card
                      key={key}
                      sx={{
                        mb: 2,
                        border: formData.pricingPolicy === key ? '2px solid #e16789' : '1px solid #e0e0e0',
                        cursor: 'pointer',
                        '&:hover': { borderColor: '#e16789' },
                        transition: 'all 0.2s',
                      }}
                      onClick={() => handleInputChange('pricingPolicy', key)}
                    >
                      <CardContent>
                        <FormControlLabel
                          value={key}
                          control={<Radio />}
                          label={
                            <Box>
                              <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {info.label}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {info.description}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                {info.when}
                              </Typography>
                            </Box>
                          }
                          sx={{ width: '100%', m: 0 }}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </RadioGroup>
              </FormControl>
              

              {/* Hourly Rate Input for time_based pricing */}
              {formData.pricingPolicy === 'time_based' && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <TextField
                    fullWidth
                    label="Hourly Rate (RM)"
                    type="number"
                    value={formData.hourlyRate}
                    onChange={(e) => handleInputChange('hourlyRate', e.target.value)}
                    helperText="The hourly rate for this service"
                    required
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </Box>
              )}

            </Box>

            {/* Cancellation Policy Section */}
            <Divider sx={{ my: 4 }} />
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
                Cancellation Policy (Optional)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Define your cancellation policy and fee structure. This will be displayed to couples when they view your service.
              </Typography>

              {/* Cancellation Policy Text */}
              <TextField
                fullWidth
                label="Cancellation Policy Description"
                value={formData.cancellationPolicy}
                onChange={(e) => handleInputChange('cancellationPolicy', e.target.value)}
                helperText="Describe your cancellation policy in plain text (e.g., 'Free cancellation up to 90 days before the wedding')"
                multiline
                rows={3}
                sx={{ mb: 3 }}
              />

              {/* Cancellation Fee Tiers */}
              <Typography variant="body2" sx={{ mb: 2, fontWeight: 500 }}>
                Cancellation Fee Schedule (as percentage of total booking amount)
              </Typography>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120 }}>
                      More than 90 days:
                    </Typography>
                    <TextField
                      type="number"
                      size="small"
                      value={formData.cancellationFeeTiers['>90'] * 100}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        handleInputChange('cancellationFeeTiers', {
                          ...formData.cancellationFeeTiers,
                          '>90': Math.max(0, Math.min(100, value)) / 100,
                        });
                      }}
                      InputProps={{
                        endAdornment: <Typography variant="caption">%</Typography>,
                      }}
                      inputProps={{ min: 0, max: 100, step: 1 }}
                      sx={{ width: 120 }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120 }}>
                      30-90 days:
                    </Typography>
                    <TextField
                      type="number"
                      size="small"
                      value={formData.cancellationFeeTiers['30-90'] * 100}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        handleInputChange('cancellationFeeTiers', {
                          ...formData.cancellationFeeTiers,
                          '30-90': Math.max(0, Math.min(100, value)) / 100,
                        });
                      }}
                      InputProps={{
                        endAdornment: <Typography variant="caption">%</Typography>,
                      }}
                      inputProps={{ min: 0, max: 100, step: 1 }}
                      sx={{ width: 120 }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120 }}>
                      7-30 days:
                    </Typography>
                    <TextField
                      type="number"
                      size="small"
                      value={formData.cancellationFeeTiers['7-30'] * 100}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        handleInputChange('cancellationFeeTiers', {
                          ...formData.cancellationFeeTiers,
                          '7-30': Math.max(0, Math.min(100, value)) / 100,
                        });
                      }}
                      InputProps={{
                        endAdornment: <Typography variant="caption">%</Typography>,
                      }}
                      inputProps={{ min: 0, max: 100, step: 1 }}
                      sx={{ width: 120 }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120 }}>
                      Less than 7 days:
                    </Typography>
                    <TextField
                      type="number"
                      size="small"
                      value={formData.cancellationFeeTiers['<7'] * 100}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        handleInputChange('cancellationFeeTiers', {
                          ...formData.cancellationFeeTiers,
                          '<7': Math.max(0, Math.min(100, value)) / 100,
                        });
                      }}
                      InputProps={{
                        endAdornment: <Typography variant="caption">%</Typography>,
                      }}
                      inputProps={{ min: 0, max: 100, step: 1 }}
                      sx={{ width: 120 }}
                    />
                  </Box>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  Default values: 0% (&gt;90 days), 10% (30-90 days), 25% (7-30 days), 50% (&lt;7 days)
                </Typography>
              </Box>
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Step 3: Media & 3D Model
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {formData.category === 'Venue' 
                ? (
                    <>
                      Add images and draw the floorplan to generate a 3D model. <strong>Floorplan is required for venue listings.</strong>
                    </>
                  )
                : (
                    <>
                      Add images and optionally a 3D model to help couples visualize your service. <strong>3D models are optional</strong> - you can create listings without them.
                    </>
                  )}
            </Typography>

            {/* Images Upload */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Images (Optional, max 10 images, 5MB each)
              </Typography>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onImageChange}
                style={{ display: 'none' }}
                id="wizard-image-upload"
              />
              <label htmlFor="wizard-image-upload">
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
              {imagePreviews && imagePreviews.length > 0 && (
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
                        src={typeof preview === 'string' ? preview : URL.createObjectURL(preview)}
                        alt={`Preview ${index + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => onImageRemove(index)}
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

            {/* 3D Model Upload - Only for non-venue or if venue, show floorplan option */}
            {/* Hide 3D model section if bundle is enabled (components will have their own 3D models) */}
            {!formData.isBundle && (
            <Box>
              {formData.category !== 'Venue' && (
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Include 3D Model
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Enable this if your listing has a 3D model for visualization
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.has3DModel || false}
                        onChange={(e) => {
                          handleInputChange('has3DModel', e.target.checked);
                          // Clear 3D model data if toggle is turned off
                          if (!e.target.checked) {
                            if (on3DModelRemove) on3DModelRemove();
                            if (onDesignElementSelect) onDesignElementSelect('');
                            if (onModel3DSourceChange) onModel3DSourceChange('upload');
                          }
                        }}
                      />
                    }
                    label=""
                  />
                </Box>
              )}
              
              {/* For venues, always show floorplan (required); for others, only if toggle is enabled */}
              {(formData.has3DModel || formData.category === 'Venue') && (
                <>
                  {/* For venues, only show floorplan option; for others, show all options */}
                  {formData.category === 'Venue' ? (
                <Box
                  sx={{
                    p: 2,
                    border: floorplanData ? '1px solid #10b981' : '1px solid #e0e0e0',
                    borderRadius: 1,
                    backgroundColor: floorplanData ? '#f0fdf4' : '#f8f9fa',
                    mb: 2,
                  }}
                >
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: floorplanData ? '#065f46' : '#666' }}>
                    {floorplanData ? '✓ Floorplan Ready' : 'Draw your venue floorplan (Required)'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Draw your venue floorplan to generate a 3D model automatically. This is required for venue listings.
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => onFloorplanEditorOpen && onFloorplanEditorOpen()}
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
              ) : (
                <>
                  <FormControl component="fieldset" sx={{ mb: 2, width: '100%' }}>
                    <RadioGroup
                      row
                      value={model3DSource || 'upload'}
                      onChange={(e) => onModel3DSourceChange && onModel3DSourceChange(e.target.value)}
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
                    </RadioGroup>
                  </FormControl>

                  {model3DSource === 'existing' && (
                <Box sx={{ mb: 2 }}>
                  <TextField
                    select
                    fullWidth
                    label="Select Design Element"
                    value={selectedDesignElementId || ''}
                    onChange={(e) => onDesignElementSelect && onDesignElementSelect(e.target.value)}
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
                </Box>
              )}

              {model3DSource === 'upload' && (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    .glb format only, max 150MB
                  </Typography>
                  <input
                    type="file"
                    accept=".glb"
                    onChange={on3DModelChange}
                    style={{ display: 'none' }}
                    id="wizard-3d-model-upload"
                  />
                  <label htmlFor="wizard-3d-model-upload">
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
                        {typeof model3DPreview === 'string' ? model3DPreview : '3D Model uploaded'}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={on3DModelRemove}
                        sx={{ color: '#d32f2f' }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}

                  {/* Dimensions editor - mirror design element page (non-venue, upload flow) */}
                  {formData.category !== 'Venue' && model3DSource === 'upload' && model3DPreview && dimensionPreviewUrl && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
                        Dimensions editor
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Drag the handles on the 3D preview to set real-world size (meters). Pan/zoom to view all sides.
                      </Typography>

                      <Box
                        sx={{
                          mt: 2,
                          p: 0,
                          backgroundColor: '#f5f6fa',
                          borderRadius: 1,
                          position: 'relative',
                          height: 420,
                          overflow: 'hidden',
                        }}
                      >
                        <Viewer3D
                          fileUrl={dimensionPreviewUrl}
                          onDimensionsChange={handleDimensionsChange}
                          targetDimensions={targetDimensions}
                        />
                      </Box>

                      <Box
                        sx={{
                          mt: 2,
                          p: 2,
                          border: '1px solid #e0e0e0',
                          borderRadius: 1,
                          backgroundColor: '#fafafa',
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          Physical properties
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                          Dimensions update automatically from the editor above.
                        </Typography>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={isStackable || false}
                              onChange={(e) => onStackableChange && onStackableChange(e.target.checked)}
                            />
                          }
                          label="Stackable (can be placed on tables/surfaces)"
                        />
                      </Box>
                    </Box>
                  )}
                </>
              )}
                </>
              )}
                </>
              )}
            </Box>
            )}

            {/* Bundle Toggle */}
            {formData.category !== 'Venue' && (
              <Box sx={{ mt: 4, mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fafafa' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isBundle}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          isBundle: e.target.checked,
                          components: e.target.checked ? prev.components : [],
                        }));
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

            {/* Bundle Components - Only show when bundle is enabled */}
            {formData.category !== 'Venue' && formData.isBundle && (
              <Box sx={{ mt: 2, p: 2, border: '1px dashed #e0e0e0', borderRadius: 1, backgroundColor: '#fafafa' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Service Components
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={onAddComponent}
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
                </Typography>
                
                {components && components.length > 0 ? (
                  <Stack spacing={2}>
                    {components.map((component, index) => {
                      const componentKey = component.id || `component-${index}`;
                      const physicalProps = componentPhysicalProps[componentKey] || { width: '', height: '', depth: '', isStackable: false };
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
                            backgroundColor: '#fff',
                          }}
                        >
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              Component {index + 1}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => onRemoveComponent && onRemoveComponent(index)}
                              sx={{ color: '#d32f2f' }}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Box>
                          <Stack spacing={2}>
                            <TextField
                              fullWidth
                              select
                              label="Design Element"
                              value={component.designElementId || ''}
                              onChange={(e) => onComponentChange && onComponentChange(index, 'designElementId', e.target.value)}
                              size="small"
                              helperText="Select existing or upload new 3D model below"
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
                            
                            {/* Per-component 3D model upload */}
                            <Box>
                              <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                                Or upload new 3D model for this component:
                              </Typography>
                              <input
                                type="file"
                                accept=".glb"
                                onChange={(e) => onComponent3DChange && onComponent3DChange(componentKey, e)}
                                style={{ display: 'none' }}
                                id={`wizard-component-3d-upload-${componentKey}`}
                              />
                              <label htmlFor={`wizard-component-3d-upload-${componentKey}`}>
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
                                    onClick={() => onRemoveComponent3DModel && onRemoveComponent3DModel(componentKey)}
                                    sx={{ color: '#d32f2f', padding: '4px' }}
                                  >
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                </Box>
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
                                  <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
                                    <TextField
                                      label="Width (X)"
                                      type="number"
                                      size="small"
                                      value={physicalProps.width}
                                      onChange={(e) => onComponentPhysicalPropsChange && onComponentPhysicalPropsChange(componentKey, { width: e.target.value })}
                                      InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                                      inputProps={{ step: '0.01', min: '0' }}
                                    />
                                    <TextField
                                      label="Height (Y)"
                                      type="number"
                                      size="small"
                                      value={physicalProps.height}
                                      onChange={(e) => onComponentPhysicalPropsChange && onComponentPhysicalPropsChange(componentKey, { height: e.target.value })}
                                      InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                                      inputProps={{ step: '0.01', min: '0' }}
                                    />
                                    <TextField
                                      label="Depth (Z)"
                                      type="number"
                                      size="small"
                                      value={physicalProps.depth}
                                      onChange={(e) => onComponentPhysicalPropsChange && onComponentPhysicalPropsChange(componentKey, { depth: e.target.value })}
                                      InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                                      inputProps={{ step: '0.01', min: '0' }}
                                    />
                                  </Stack>
                                  <FormControlLabel
                                    control={
                                      <Switch
                                        size="small"
                                        checked={Boolean(physicalProps.isStackable)}
                                        onChange={(e) => onComponentPhysicalPropsChange && onComponentPhysicalPropsChange(componentKey, { isStackable: e.target.checked })}
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
                                value={component.quantityPerUnit || 1}
                                onChange={(e) => onComponentChange && onComponentChange(index, 'quantityPerUnit', parseInt(e.target.value) || 1)}
                                size="small"
                                required
                                inputProps={{ min: 1, step: 1 }}
                              />
                              <TextField
                                fullWidth
                                label="Role (Optional)"
                                value={component.role || ''}
                                onChange={(e) => onComponentChange && onComponentChange(index, 'role', e.target.value)}
                                placeholder="e.g., table, chair"
                                size="small"
                              />
                            </Box>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No components added. Click "Add Component" to define bundle composition.
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '800px', mx: 'auto', p: 3 }}>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ minHeight: '400px', mb: 4 }}>
        {renderStepContent()}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 3, borderTop: '1px solid #e0e0e0' }}>
        <Button
          onClick={activeStep === 0 ? onCancel : handleBack}
          startIcon={activeStep === 0 ? null : <ArrowBack />}
          sx={{ textTransform: 'none' }}
        >
          {activeStep === 0 ? 'Cancel' : 'Back'}
        </Button>
        
        <Button
          variant="contained"
          onClick={activeStep === steps.length - 1 ? handleComplete : handleNext}
          endIcon={activeStep === steps.length - 1 ? <CheckCircle /> : <ArrowForward />}
          sx={{
            bgcolor: '#e16789',
            '&:hover': { bgcolor: '#d1537a' },
            textTransform: 'none',
          }}
        >
          {activeStep === steps.length - 1 ? 'Complete' : 'Next'}
        </Button>
      </Box>

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

export default ListingWizard;

