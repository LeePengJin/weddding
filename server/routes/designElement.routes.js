const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Setup multer for 3D model uploads
const model3DUploadDir = path.join(__dirname, '..', 'uploads', 'models3d');
fs.mkdirSync(model3DUploadDir, { recursive: true });

// Helper function to create multer instance for 3D model uploads
const createModel3DUpload = () => {
  const model3DStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, model3DUploadDir),
    filename: (req, file, cb) => {
      const vendorId = req.user.sub;
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const ext = path.extname(file.originalname) || '.glb';
      cb(null, `${vendorId}_${timestamp}_${random}${ext}`);
    },
  });

  return multer({
    storage: model3DStorage,
    limits: { fileSize: 150 * 1024 * 1024 }, // 150MB max
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

// Validation schema
const dimensionsSchema = z
  .object({
    width: z.number().positive('Width must be greater than 0').optional(),
    height: z.number().positive('Height must be greater than 0').optional(),
    depth: z.number().positive('Depth must be greater than 0').optional(),
  })
  .partial();

const designElementPatchSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters').optional(),
  elementType: z.string().max(50, 'Element type must be at most 50 characters').optional().nullable(),
  isStackable: z.boolean().optional(),
  dimensions: dimensionsSchema.nullable().optional(),
});

const designElementCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  elementType: z.string().max(50, 'Element type must be at most 50 characters').optional().nullable(),
});

// GET /design-elements - Get all design elements for the authenticated vendor
router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    // Get all design elements owned by this vendor
    const designElements = await prisma.designElement.findMany({
      where: { vendorId: req.user.sub },
      orderBy: { name: 'asc' },
    });

    res.json(designElements);
  } catch (err) {
    next(err);
  }
});

// POST /design-elements - Create a new design element with 3D model
router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    const model3DUpload = createModel3DUpload();

    model3DUpload.single('model3D')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No 3D model file provided' });
      }

      try {
        const validatedData = designElementCreateSchema.parse({
          name: req.body.name,
          elementType: req.body.elementType,
        });

        const isStackable = req.body.isStackable === 'true';
        let dimensions = null;
        if (req.body.dimensions) {
          try {
            dimensions = JSON.parse(req.body.dimensions);
          } catch (e) {
            console.warn('Invalid dimensions JSON:', e);
          }
        }

        const modelPath = `/uploads/models3d/${req.file.filename}`;

        const designElement = await prisma.designElement.create({
          data: {
            vendorId: req.user.sub,
            name: validatedData.name || req.file.originalname.replace('.glb', ''),
            elementType: validatedData.elementType || null,
            modelFile: modelPath,
            isStackable: isStackable,
            dimensions: dimensions || undefined,
          },
        });

        res.status(201).json(designElement);
      } catch (dbErr) {
        // Delete uploaded file if database operation fails
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        if (dbErr instanceof z.ZodError) {
          return res.status(400).json({ error: dbErr.errors[0].message });
        }
        next(dbErr);
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /design-elements/:id - Get a specific design element
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    const designElement = await prisma.designElement.findUnique({
      where: { id: req.params.id },
    });

    if (!designElement) {
      return res.status(404).json({ error: 'Design element not found' });
    }

    // Check if design element belongs to vendor
    if (designElement.vendorId !== req.user.sub) {
      return res.status(404).json({ error: 'Design element not found' });
    }

    res.json(designElement);
  } catch (err) {
    next(err);
  }
});

// PATCH /design-elements/:id - Update a design element
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    // Check if design element exists and belongs to vendor
    const existingElement = await prisma.designElement.findUnique({
      where: { id: req.params.id },
    });

    if (!existingElement) {
      return res.status(404).json({ error: 'Design element not found' });
    }

    if (existingElement.vendorId !== req.user.sub) {
      return res.status(404).json({ error: 'Design element not found' });
    }

    const validatedData = designElementPatchSchema.parse(req.body);

    const updateData = {};
    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name;
    }
    if (validatedData.elementType !== undefined) {
      updateData.elementType = validatedData.elementType;
    }
    if (validatedData.isStackable !== undefined) {
      updateData.isStackable = validatedData.isStackable;
    }
    if (validatedData.dimensions !== undefined) {
      updateData.dimensions = validatedData.dimensions || null;
    }

    const designElement = await prisma.designElement.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(designElement);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    next(err);
  }
});

// POST /design-elements/:id/model3d - Update 3D model for a design element
router.post('/:id/model3d', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    const existingElement = await prisma.designElement.findUnique({
      where: { id: req.params.id },
    });

    if (!existingElement) {
      return res.status(404).json({ error: 'Design element not found' });
    }

    // Check if design element belongs to vendor
    if (existingElement.vendorId !== req.user.sub) {
      return res.status(404).json({ error: 'Design element not found' });
    }

    const model3DUpload = createModel3DUpload();

    model3DUpload.single('model3D')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No 3D model file provided' });
      }

      try {
        const modelPath = `/uploads/models3d/${req.file.filename}`;

        // Delete old file if exists
        if (existingElement.modelFile) {
          const oldPath = path.join(__dirname, '..', existingElement.modelFile);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }

        const isStackable = req.body.isStackable === 'true';
        let dimensions = null;
        if (req.body.dimensions) {
          try {
            dimensions = JSON.parse(req.body.dimensions);
          } catch (e) {
            console.warn('Invalid dimensions JSON:', e);
          }
        }

        const designElement = await prisma.designElement.update({
          where: { id: req.params.id },
          data: { 
            modelFile: modelPath,
            isStackable: isStackable,
            dimensions: dimensions || undefined,
          },
        });

        res.json(designElement);
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

// DELETE /design-elements/:id - Delete a design element
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    const designElement = await prisma.designElement.findUnique({
      where: { id: req.params.id },
    });

    if (!designElement) {
      return res.status(404).json({ error: 'Design element not found' });
    }

    // Check if design element belongs to vendor
    if (designElement.vendorId !== req.user.sub) {
      return res.status(404).json({ error: 'Design element not found' });
    }

    // Check if design element is used in venue design placements (these will be deleted)
    // Service listings and components will have their designElementId set to null, so we don't need to block deletion
    const usedInPlacements = await prisma.placedElement.count({
      where: { designElementId: req.params.id },
    });

    if (usedInPlacements > 0) {
      return res.status(400).json({
        error: `Cannot delete design element. It is currently placed in ${usedInPlacements} venue design(s). Please remove it from all venue designs before deleting.`,
      });
    }

    // Delete file
    if (designElement.modelFile) {
      const filePath = path.join(__dirname, '..', designElement.modelFile);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.designElement.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Design element deleted successfully' });
  } catch (err) {
    // Handle Prisma foreign key constraint error (in case Restrict behavior is triggered)
    if (err.code === 'P2003' || err.message?.includes('Foreign key constraint')) {
      return res.status(400).json({
        error: 'Cannot delete design element. It is currently placed in one or more venue designs. Please remove all placements before deleting.',
      });
    }
    next(err);
  }
});

module.exports = router;

