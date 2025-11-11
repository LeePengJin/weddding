const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Setup multer for service listing image uploads
const serviceImageUploadDir = path.join(__dirname, '..', 'uploads', 'service');
fs.mkdirSync(serviceImageUploadDir, { recursive: true });

// Setup multer for 3D model uploads
const model3DUploadDir = path.join(__dirname, '..', 'uploads', 'models3d');
fs.mkdirSync(model3DUploadDir, { recursive: true });

const serviceImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, serviceImageUploadDir),
  filename: (req, file, cb) => {
    // Format: {listingId}_{timestamp}_{index}.{ext}
    const listingId = req.params.id || 'temp';
    const timestamp = Date.now();
    const index = req.body.imageIndex || Math.floor(Math.random() * 10000);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${listingId}_${timestamp}_${index}${ext}`);
  },
});

const serviceImageUpload = multer({
  storage: serviceImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per image
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Validation schema for service listing
const SAFE_TEXT = /^[A-Za-z0-9 .,'-]+$/;
const serviceListingSchema = z
  .object({
    name: z
      .string()
      .min(10, 'Service name must be at least 10 characters')
      .max(100, 'Service name must be at most 100 characters')
      .regex(SAFE_TEXT, 'Service name may only include letters, numbers, spaces, period, comma, apostrophe, and hyphen'),
    description: z
      .string()
      .min(10, 'Description must be at least 10 characters')
      .max(2000, 'Description must be at most 2000 characters')
      .regex(SAFE_TEXT, 'Description may only include letters, numbers, spaces, period, comma, apostrophe, and hyphen')
      .optional()
      .nullable(),
    category: z.enum(['Photographer', 'Videographer', 'Venue', 'Caterer', 'Florist', 'DJ_Music', 'Other']),
    customCategory: z
      .string()
      .min(2, 'Custom category must be at least 2 characters')
      .max(50, 'Custom category must be at most 50 characters')
      .regex(SAFE_TEXT, 'Custom category may only include letters, numbers, spaces, period, comma, apostrophe, and hyphen')
      .optional()
      .nullable(),
    price: z
      .number()
      .min(0, 'Price cannot be less than 0')
      .max(1000000, 'Price cannot exceed RM 1,000,000'),
    isActive: z.boolean().optional().default(true),
  })
  .refine(
    (data) => {
      // If category is "Other", customCategory is required
      if (data.category === 'Other') {
        return data.customCategory && data.customCategory.trim().length >= 2;
      }
      // If category is not "Other", customCategory should be null/empty
      return !data.customCategory || data.customCategory.trim().length === 0;
    },
    {
      message: 'Custom category is required when category is "Other"',
      path: ['customCategory'],
    }
  );

// GET /service-listings - Get all service listings for the authenticated vendor
router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    const listings = await prisma.serviceListing.findMany({
      where: { vendorId: req.user.sub },
      orderBy: { createdAt: 'desc' },
      include: {
        designElement: true,
      },
    });

    // Convert image URLs to full backend URLs
    const listingsWithFullUrls = listings.map((listing) => ({
      ...listing,
      images: listing.images.map((img) => {
        if (img.startsWith('http://') || img.startsWith('https://')) {
          return img;
        }
        if (img.startsWith('/uploads')) {
          return `http://localhost:4000${img}`;
        }
        return img;
      }),
      price: listing.price.toString(),
    }));

    res.json(listingsWithFullUrls);
  } catch (err) {
    next(err);
  }
});

// GET /service-listings/:id - Get a specific service listing
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    const listing = await prisma.serviceListing.findFirst({
      where: {
        id: req.params.id,
        vendorId: req.user.sub,
      },
      include: {
        designElement: true,
      },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Service listing not found' });
    }

    // Convert image URLs to full backend URLs
    const listingWithFullUrls = {
      ...listing,
      images: listing.images.map((img) => {
        if (img.startsWith('http://') || img.startsWith('https://')) {
          return img;
        }
        if (img.startsWith('/uploads')) {
          return `http://localhost:4000${img}`;
        }
        return img;
      }),
      price: listing.price.toString(),
    };

    res.json(listingWithFullUrls);
  } catch (err) {
    next(err);
  }
});

// POST /service-listings - Create a new service listing
router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    const { name, description, category, customCategory, price, isActive } = serviceListingSchema.parse(req.body);

    const listing = await prisma.serviceListing.create({
      data: {
        vendorId: req.user.sub,
        name,
        description: description || null,
        category,
        customCategory: category === 'Other' ? customCategory : null,
        price: parseFloat(price),
        isActive: isActive !== undefined ? isActive : true,
        images: [],
      },
    });

    res.status(201).json({
      ...listing,
      price: listing.price.toString(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

// PATCH /service-listings/:id - Update a service listing
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    // Check if listing exists and belongs to vendor
    const existingListing = await prisma.serviceListing.findFirst({
      where: {
        id: req.params.id,
        vendorId: req.user.sub,
      },
    });

    if (!existingListing) {
      return res.status(404).json({ error: 'Service listing not found' });
    }

    // Partial schema for updates
    const updateSchema = z
      .object({
        name: z
          .string()
          .min(10, 'Service name must be at least 10 characters')
          .max(100, 'Service name must be at most 100 characters')
          .regex(SAFE_TEXT, 'Service name may only include letters, numbers, spaces, period, comma, apostrophe, and hyphen')
          .optional(),
        description: z
          .string()
          .min(10, 'Description must be at least 10 characters')
          .max(2000, 'Description must be at most 2000 characters')
          .regex(SAFE_TEXT, 'Description may only include letters, numbers, spaces, period, comma, apostrophe, and hyphen')
          .optional()
          .nullable(),
        category: z.enum(['Photographer', 'Videographer', 'Venue', 'Caterer', 'Florist', 'DJ_Music', 'Other']).optional(),
        customCategory: z
          .string()
          .min(2, 'Custom category must be at least 2 characters')
          .max(50, 'Custom category must be at most 50 characters')
          .regex(SAFE_TEXT, 'Custom category may only include letters, numbers, spaces, period, comma, apostrophe, and hyphen')
          .optional()
          .nullable(),
        price: z
          .number()
          .min(0, 'Price cannot be less than 0')
          .max(1000000, 'Price cannot exceed RM 1,000,000')
          .optional(),
        isActive: z.boolean().optional(),
      })
      .refine(
        (data) => {
          // If category is "Other", customCategory is required
          if (data.category === 'Other') {
            return data.customCategory && data.customCategory.trim().length >= 2;
          }
          // If category is provided and not "Other", customCategory should be null/empty
          if (data.category && data.category !== 'Other') {
            return !data.customCategory || data.customCategory.trim().length === 0;
          }
          return true;
        },
        {
          message: 'Custom category is required when category is "Other"',
          path: ['customCategory'],
        }
      );

    const updateData = updateSchema.parse(req.body);
    if (updateData.price !== undefined) {
      updateData.price = parseFloat(updateData.price);
    }

    // Handle customCategory based on category
    if (updateData.category !== undefined) {
      if (updateData.category === 'Other') {
        // Ensure customCategory is set when category is Other
        if (!updateData.customCategory) {
          return res.status(400).json({ error: 'Custom category is required when category is "Other"' });
        }
        updateData.customCategory = updateData.customCategory;
      } else {
        // Clear customCategory when category is not Other
        updateData.customCategory = null;
      }
    } else if (updateData.customCategory !== undefined) {
      // If only customCategory is being updated, check current category
      const currentListing = await prisma.serviceListing.findUnique({
        where: { id: req.params.id },
        select: { category: true },
      });
      if (currentListing.category !== 'Other') {
        updateData.customCategory = null;
      }
    }

    const updatedListing = await prisma.serviceListing.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({
      ...updatedListing,
      price: updatedListing.price.toString(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

// DELETE /service-listings/:id - Delete a service listing
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    // Check if listing exists and belongs to vendor
    const existingListing = await prisma.serviceListing.findFirst({
      where: {
        id: req.params.id,
        vendorId: req.user.sub,
      },
    });

    if (!existingListing) {
      return res.status(404).json({ error: 'Service listing not found' });
    }

    // Delete associated images from filesystem
    if (existingListing.images && existingListing.images.length > 0) {
      existingListing.images.forEach((imagePath) => {
        const fullPath = path.join(__dirname, '..', imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      });
    }

    await prisma.serviceListing.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Service listing deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /service-listings/:id/images - Upload images for a service listing
router.post('/:id/images', requireAuth, serviceImageUpload.array('images', 10), async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    // Check if listing exists and belongs to vendor
    const existingListing = await prisma.serviceListing.findFirst({
      where: {
        id: req.params.id,
        vendorId: req.user.sub,
      },
    });

    if (!existingListing) {
      return res.status(404).json({ error: 'Service listing not found' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    // Generate image URLs from uploaded files
    const imageUrls = req.files.map((file) => {
      // File is already saved with the correct name by multer
      const relativePath = `/uploads/service/${file.filename}`;
      return relativePath;
    });

    // Update listing with new images (append to existing)
    const updatedImages = [...existingListing.images, ...imageUrls];

    // Ensure we don't exceed 10 images
    if (updatedImages.length > 10) {
      // Delete the newly uploaded files
      req.files.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
      return res.status(400).json({ error: 'Maximum 10 images allowed per listing' });
    }

    const updatedListing = await prisma.serviceListing.update({
      where: { id: req.params.id },
      data: { images: updatedImages },
    });

    // Convert to full URLs
    const imagesWithFullUrls = updatedListing.images.map((img) => {
      if (img.startsWith('http://') || img.startsWith('https://')) {
        return img;
      }
      if (img.startsWith('/uploads')) {
        return `http://localhost:4000${img}`;
      }
      return img;
    });

    res.json({
      images: imagesWithFullUrls,
      message: 'Images uploaded successfully',
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /service-listings/:id/images/:imageIndex - Delete a specific image
router.delete('/:id/images/:imageIndex', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    const imageIndex = parseInt(req.params.imageIndex, 10);
    if (isNaN(imageIndex) || imageIndex < 0) {
      return res.status(400).json({ error: 'Invalid image index' });
    }

    // Check if listing exists and belongs to vendor
    const existingListing = await prisma.serviceListing.findFirst({
      where: {
        id: req.params.id,
        vendorId: req.user.sub,
      },
    });

    if (!existingListing) {
      return res.status(404).json({ error: 'Service listing not found' });
    }

    if (imageIndex >= existingListing.images.length) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete image file from filesystem
    const imagePath = existingListing.images[imageIndex];
    const fullPath = path.join(__dirname, '..', imagePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // Remove image from array
    const updatedImages = existingListing.images.filter((_, index) => index !== imageIndex);

    await prisma.serviceListing.update({
      where: { id: req.params.id },
      data: { images: updatedImages },
    });

    res.json({ message: 'Image deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// Helper function to create multer instance for 3D model uploads
const createModel3DUpload = (listingId) => {
  const model3DStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, model3DUploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.glb';
      cb(null, `${listingId}${ext}`);
    },
  });

  return multer({
    storage: model3DStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === '.glb') {
        cb(null, true);
      } else {
        cb(new Error('Only .glb files are allowed (GLTF Binary format)'), false);
      }
    },
  });
};

// POST /service-listings/:id/model3d - Upload 3D model for a service listing
router.post('/:id/model3d', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    // Check if listing exists and belongs to vendor
    const existingListing = await prisma.serviceListing.findFirst({
      where: {
        id: req.params.id,
        vendorId: req.user.sub,
      },
    });

    if (!existingListing) {
      return res.status(404).json({ error: 'Service listing not found' });
    }

    const model3DUpload = createModel3DUpload(req.params.id);

    model3DUpload.single('model3D')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No 3D model file provided' });
      }

      try {
        // Create or update DesignElement
        const modelPath = `/uploads/models3d/${req.file.filename}`;
        
        // Check if designElementId exists
        let designElement;
        if (existingListing.designElementId) {
          // Delete old file if exists
          const oldElement = await prisma.designElement.findUnique({
            where: { id: existingListing.designElementId },
          });
          if (oldElement && oldElement.modelFile) {
            const oldPath = path.join(__dirname, '..', oldElement.modelFile);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
          // Update existing design element
          designElement = await prisma.designElement.update({
            where: { id: existingListing.designElementId },
            data: { modelFile: modelPath },
          });
        } else {
          // Create new design element
          designElement = await prisma.designElement.create({
            data: {
              name: existingListing.name,
              elementType: existingListing.category,
              modelFile: modelPath,
            },
          });
        }

        // Update service listing with designElementId and has3DModel
        await prisma.serviceListing.update({
          where: { id: req.params.id },
          data: {
            designElementId: designElement.id,
            has3DModel: true,
          },
        });

        res.json({
          message: '3D model uploaded successfully',
          has3DModel: true,
        });
      } catch (dbErr) {
        // Delete uploaded file if database operation fails
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        next(dbErr);
      }
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /service-listings/:id/model3d - Delete 3D model for a service listing
router.delete('/:id/model3d', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    // Check if listing exists and belongs to vendor
    const existingListing = await prisma.serviceListing.findFirst({
      where: {
        id: req.params.id,
        vendorId: req.user.sub,
      },
      include: {
        designElement: true,
      },
    });

    if (!existingListing) {
      return res.status(404).json({ error: 'Service listing not found' });
    }

    // Delete 3D model file if exists
    if (existingListing.designElement) {
      const modelPath = path.join(__dirname, '..', existingListing.designElement.modelFile);
      if (fs.existsSync(modelPath)) {
        fs.unlinkSync(modelPath);
      }

      // Delete design element
      await prisma.designElement.delete({
        where: { id: existingListing.designElement.id },
      });
    }

    // Update service listing
    await prisma.serviceListing.update({
      where: { id: req.params.id },
      data: {
        designElementId: null,
        has3DModel: false,
      },
    });

    res.json({ message: '3D model deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

