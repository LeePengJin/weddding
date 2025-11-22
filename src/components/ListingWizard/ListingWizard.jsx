import React, { useState, useEffect } from 'react';
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
  flat: {
    label: 'Flat Rate',
    description: 'One fixed price per booking, regardless of design size.',
    when: 'Best for: Venues, photographers, videographers, DJs',
  },
  per_table: {
    label: 'Per Table',
    description: 'Price multiplies by the number of tables in the 3D design.',
    when: 'Best for: Table decorations, centerpieces, tableware',
  },
  per_set: {
    label: 'Per Table Set',
    description: 'Price multiplies by the number of complete table sets (table + chairs) in the design.',
    when: 'Best for: Table and chair rentals, complete table setups',
  },
  per_guest: {
    label: 'Per Guest',
    description: 'Price multiplies by the total guest count in the project.',
    when: 'Best for: Catering, favors, place cards',
  },
  tiered: {
    label: 'Tiered Pricing',
    description: 'Advanced volume-based pricing with different rates for different quantities.',
    when: 'Best for: Large-scale services with bulk discounts',
  },
};

// Filter pricing policies based on category
const getAvailablePricingPolicies = (category, availabilityType) => {
  // Venues should only have flat rate
  if (category === 'Venue') {
    return { flat: PRICING_POLICIES.flat };
  }
  
  // For exclusive services, usually flat or per_guest
  if (availabilityType === 'exclusive') {
    return {
      flat: PRICING_POLICIES.flat,
      per_guest: PRICING_POLICIES.per_guest,
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
    pricingPolicy: 'flat',
    
    // Step 3
    images: [],
    imagePreviews: [],
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
  });

  const [fieldErrors, setFieldErrors] = useState({});

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
        pricingPolicy: initialData.pricingPolicy || 'flat',
        images: initialData.images || [],
        imagePreviews: initialData.images || [],
        model3DSource: initialData.model3DFile ? 'upload' : (initialData.designElementId ? 'existing' : 'upload'),
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

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
    
    if (step === 0) {
      // Step 1: Type & Availability
      if (!formData.category) {
        errors.category = 'Please select a category';
      }
      if (formData.category === 'Other' && !formData.customCategory) {
        errors.customCategory = 'Please enter a custom category name';
      }
      if (formData.availabilityType === 'quantity_based' && (!formData.maxQuantity || parseFloat(formData.maxQuantity) <= 0)) {
        errors.maxQuantity = 'Please enter a valid maximum quantity';
      }
    } else if (step === 1) {
      // Step 2: Basic Information
      if (!formData.name || formData.name.trim().length < 2) {
        errors.name = 'Name must be at least 2 characters';
      }
      if (formData.description && formData.description.length < 10) {
        errors.description = 'Description must be at least 10 characters if provided';
      }
      if (!formData.price || parseFloat(formData.price) < 0) {
        errors.price = 'Please enter a valid price';
      }
      if (!formData.pricingPolicy) {
        errors.pricingPolicy = 'Please select a pricing policy';
      }
    }
    // Step 3 (Media) is optional, no validation needed
    
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
    if (validateStep(activeStep)) {
      // Merge all form data including media state from props
      const completeData = {
        ...formData,
        images: imagePreviews || [],
        model3DFile: model3DFile,
        model3DPreview: model3DPreview,
        selectedDesignElementId: selectedDesignElementId || '',
        useExistingDesignElement: useExistingDesignElement || false,
        model3DSource: model3DSource || 'upload',
        modelDimensions: modelDimensions || { width: '', height: '', depth: '' },
        isStackable: isStackable || false,
        components: components || [],
        floorplanData: floorplanData,
      };
      onComplete(completeData);
    }
  };

  const availablePricingPolicies = getAvailablePricingPolicies(
    formData.category,
    formData.availabilityType
  );

  // Auto-set pricing policy for venues
  useEffect(() => {
    if (formData.category === 'Venue' && formData.pricingPolicy !== 'flat') {
      handleInputChange('pricingPolicy', 'flat');
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
                error={!!fieldErrors.category}
                helperText={fieldErrors.category || 'What type of service is this?'}
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
                  error={!!fieldErrors.customCategory}
                  helperText={fieldErrors.customCategory || 'Enter a custom category name (2-50 characters)'}
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

              {formData.availabilityType === 'quantity_based' && (
                <TextField
                  fullWidth
                  label="Maximum Quantity"
                  type="number"
                  value={formData.maxQuantity}
                  onChange={(e) => handleInputChange('maxQuantity', e.target.value)}
                  error={!!fieldErrors.maxQuantity}
                  helperText={fieldErrors.maxQuantity || 'How many units are available?'}
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
              error={!!fieldErrors.name}
              helperText={fieldErrors.name || 'A clear, descriptive name for your service'}
              required
              sx={{ mb: 3 }}
            />

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
              sx={{ mb: 3 }}
            />

            {/* Price */}
            <TextField
              fullWidth
              label="Base Price (RM)"
              type="number"
              value={formData.price}
              onChange={(e) => handleInputChange('price', e.target.value)}
              error={!!fieldErrors.price}
              helperText={fieldErrors.price || 'The base price for this service'}
              required
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
              
              {fieldErrors.pricingPolicy && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                  {fieldErrors.pricingPolicy}
                </Typography>
              )}
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
              Add images and optionally a 3D model to help couples visualize your service.
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
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                3D Model (Optional)
              </Typography>
              
              {/* For venues, only show floorplan option; for others, show all options */}
              {formData.category === 'Venue' ? (
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
                </>
              )}


              {/* Dimensions and Settings - Only for non-venue listings */}
              {formData.category !== 'Venue' && ((model3DSource === 'upload' && model3DPreview) || (model3DSource === 'existing' && selectedDesignElementId)) && (
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
                      value={modelDimensions?.width || ''}
                      onChange={(e) => onModelDimensionsChange && onModelDimensionsChange({ ...modelDimensions, width: e.target.value })}
                      InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                      disabled={model3DSource === 'existing'}
                      inputProps={{ step: '0.01', min: '0' }}
                    />
                    <TextField
                      label="Height (Y)"
                      type="number"
                      size="small"
                      value={modelDimensions?.height || ''}
                      onChange={(e) => onModelDimensionsChange && onModelDimensionsChange({ ...modelDimensions, height: e.target.value })}
                      InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                      disabled={model3DSource === 'existing'}
                      inputProps={{ step: '0.01', min: '0' }}
                    />
                    <TextField
                      label="Depth (Z)"
                      type="number"
                      size="small"
                      value={modelDimensions?.depth || ''}
                      onChange={(e) => onModelDimensionsChange && onModelDimensionsChange({ ...modelDimensions, depth: e.target.value })}
                      InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                      disabled={model3DSource === 'existing'}
                      inputProps={{ step: '0.01', min: '0' }}
                    />
                  </Stack>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isStackable || false}
                        onChange={(e) => onStackableChange && onStackableChange(e.target.checked)}
                        disabled={model3DSource === 'existing'}
                      />
                    }
                    label="Stackable (can be placed on tables/surfaces)"
                  />
                </Box>
              )}
                </>
              )}
            </Box>

            {/* Bundle Components - Hidden for Venues */}
            {formData.category !== 'Venue' && (
              <Box sx={{ mt: 4, p: 2, border: '1px dashed #e0e0e0', borderRadius: 1, backgroundColor: '#fafafa' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Service Components (Optional - for bundle services)
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
                  <Typography variant="body2" color="text.secondary">
                    {components.length} component(s) added. Bundle component management will be available in the full form.
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No components added. You can add bundle components after creating the listing.
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
    </Box>
  );
};

export default ListingWizard;

