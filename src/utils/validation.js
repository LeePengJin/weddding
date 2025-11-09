/**
 * Validation utilities for consistent validation across the application
 */

/**
 * Validates Malaysian phone number format
 * Supports mobile (01X-XXXXXXX) and landline (0[3-9]-XXXXXXX) formats
 * @param {string} contactNumber - The contact number to validate
 * @returns {string} - Empty string if valid, error message if invalid
 */
export const validateMalaysianContactNumber = (contactNumber) => {
  if (!contactNumber || !contactNumber.trim()) {
    return 'Contact number is required';
  }
  
  // Remove spaces for validation
  const cleaned = contactNumber.replace(/\s/g, '');
  
  // Pattern 1: Mobile numbers (01X-XXXXXXX or 01X-XXXXXXXX)
  const mobilePattern = /^(?:\+?60|0)1[0-9]-?\d{7,8}$/;
  
  // Pattern 2: Landline numbers (0[3-9]-XXXXXXX or 0[3-9]-XXXXXXXX)
  const landlinePattern = /^(?:\+?60|0)[3-9]-?\d{7,8}$/;
  
  if (mobilePattern.test(cleaned) || landlinePattern.test(cleaned)) {
    return '';
  }
  
  return 'Please enter a valid Malaysian phone number (e.g., 012-3456789, 03-87654321, +6012-3456789)';
};

/**
 * Validates name according to registration rules
 * @param {string} name - The name to validate
 * @param {number} maxLength - Maximum length (default 100 for couple, 120 for vendor)
 * @returns {string} - Empty string if valid, error message if invalid
 */
export const validateName = (name, maxLength = 100) => {
  if (!name || !name.trim()) {
    return 'Name is required';
  }
  if (name.length < 2) {
    return 'Name must be at least 2 characters';
  }
  if (name.length > maxLength) {
    return `Name must be at most ${maxLength} characters`;
  }
  const SAFE_TEXT = /^[A-Za-z0-9 .,'-]+$/;
  if (!SAFE_TEXT.test(name)) {
    return 'Name may only include letters, numbers, spaces, period, comma, apostrophe, and hyphen';
  }
  return '';
};

/**
 * Validates service listing name (10-100 characters, no special characters)
 * @param {string} name - The service name to validate
 * @returns {string} - Empty string if valid, error message if invalid
 */
export const validateServiceName = (name) => {
  if (!name || !name.trim()) {
    return 'Service name is required';
  }
  if (name.length < 10) {
    return 'Service name must be at least 10 characters';
  }
  if (name.length > 100) {
    return 'Service name must be at most 100 characters';
  }
  const SAFE_TEXT = /^[A-Za-z0-9 .,'-]+$/;
  if (!SAFE_TEXT.test(name)) {
    return 'Service name may only include letters, numbers, spaces, period, comma, apostrophe, and hyphen';
  }
  return '';
};

/**
 * Validates service listing description (reasonable length, no special characters)
 * @param {string} description - The description to validate
 * @param {number} maxLength - Maximum length (default 2000)
 * @returns {string} - Empty string if valid, error message if invalid
 */
export const validateServiceDescription = (description, maxLength = 2000) => {
  if (!description || !description.trim()) {
    return ''; // Description is optional
  }
  if (description.length < 10) {
    return 'Description must be at least 10 characters';
  }
  if (description.length > maxLength) {
    return `Description must be at most ${maxLength} characters`;
  }
  const SAFE_TEXT = /^[A-Za-z0-9 .,'-]+$/;
  if (!SAFE_TEXT.test(description)) {
    return 'Description may only include letters, numbers, spaces, period, comma, apostrophe, and hyphen';
  }
  return '';
};

/**
 * Validates service listing price (>= 0, reasonable maximum)
 * @param {number|string} price - The price to validate
 * @param {number} maxPrice - Maximum price (default 1,000,000)
 * @returns {string} - Empty string if valid, error message if invalid
 */
export const validateServicePrice = (price, maxPrice = 1000000) => {
  if (price === null || price === undefined || price === '') {
    return 'Price is required';
  }
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) {
    return 'Price must be a valid number';
  }
  if (numPrice < 0) {
    return 'Price cannot be less than 0';
  }
  if (numPrice > maxPrice) {
    return `Price cannot exceed RM ${maxPrice.toLocaleString()}`;
  }
  return '';
};

/**
 * Validates service listing images
 * @param {File[]} images - Array of image files
 * @param {number} maxImages - Maximum number of images (default 10)
 * @param {number} maxSizePerImage - Maximum size per image in bytes (default 5MB)
 * @returns {string} - Empty string if valid, error message if invalid
 */
export const validateServiceImages = (images, maxImages = 10, maxSizePerImage = 5 * 1024 * 1024) => {
  if (!images || images.length === 0) {
    return ''; // Images are optional
  }
  if (images.length > maxImages) {
    return `Maximum ${maxImages} images allowed`;
  }
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    if (!image.type || !image.type.startsWith('image/')) {
      return `File ${i + 1} must be an image file (JPG, PNG, GIF, etc.)`;
    }
    if (image.size > maxSizePerImage) {
      return `File ${i + 1} size must be less than ${maxSizePerImage / (1024 * 1024)}MB`;
    }
  }
  return '';
};

