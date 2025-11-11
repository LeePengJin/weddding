const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createProjectSchema = z.object({
  projectName: z.string().min(1, 'Project name is required').max(100, 'Project name is too long'),
  weddingDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)),
  weddingType: z.enum(['self_organized', 'prepackaged']),
  venueServiceListingId: z.string().uuid().optional().nullable(),
  basePackageId: z.string().uuid().optional().nullable(),
});

const updateProjectSchema = z.object({
  projectName: z.string().min(1).max(100).optional(),
  weddingDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)).optional(),
  weddingType: z.enum(['self_organized', 'prepackaged']).optional(),
  venueServiceListingId: z.string().uuid().optional().nullable(),
  basePackageId: z.string().uuid().optional().nullable(),
  status: z.enum(['draft', 'ready_to_book', 'booked']).optional(),
});

/**
 * GET /projects
 * Get all wedding projects for the authenticated couple
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const projects = await prisma.weddingProject.findMany({
      where: { coupleId: req.user.sub },
      include: {
        venueServiceListing: {
          include: {
            vendor: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        basePackage: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(projects);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /projects/:id
 * Get a specific wedding project
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const project = await prisma.weddingProject.findFirst({
      where: {
        id: req.params.id,
        coupleId: req.user.sub,
      },
      include: {
        venueServiceListing: {
          include: {
            vendor: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        basePackage: true,
        venueDesign: true,
        budget: true,
        tasks: {
          orderBy: { dueDate: 'asc' },
        },
        bookings: {
          include: {
            vendor: {
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /projects
 * Create a new wedding project
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const data = createProjectSchema.parse(req.body);

    // Validate project name uniqueness for this couple
    const existingProject = await prisma.weddingProject.findUnique({
      where: {
        coupleId_projectName: {
          coupleId: req.user.sub,
          projectName: data.projectName,
        },
      },
    });

    if (existingProject) {
      return res.status(409).json({ error: 'Project name already exists' });
    }

    // If venue is provided, verify it exists and is a venue service
    if (data.venueServiceListingId) {
      const venueService = await prisma.serviceListing.findFirst({
        where: {
          id: data.venueServiceListingId,
          category: 'Venue',
          isActive: true,
        },
      });

      if (!venueService) {
        return res.status(404).json({ error: 'Venue service not found or inactive' });
      }
    }

    // If base package is provided, verify it exists
    if (data.basePackageId) {
      const basePackage = await prisma.weddingPackage.findUnique({
        where: { id: data.basePackageId },
      });

      if (!basePackage) {
        return res.status(404).json({ error: 'Base package not found' });
      }
    }

    const project = await prisma.weddingProject.create({
      data: {
        coupleId: req.user.sub,
        projectName: data.projectName,
        weddingDate: new Date(data.weddingDate),
        weddingType: data.weddingType,
        venueServiceListingId: data.venueServiceListingId || null,
        basePackageId: data.basePackageId || null,
        status: 'draft',
      },
      include: {
        venueServiceListing: {
          include: {
            vendor: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        basePackage: true,
      },
    });

    res.status(201).json(project);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Project name already exists' });
    }
    next(err);
  }
});

/**
 * PATCH /projects/:id
 * Update a wedding project
 */
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    // Check if project exists and belongs to couple
    const existingProject = await prisma.weddingProject.findFirst({
      where: {
        id: req.params.id,
        coupleId: req.user.sub,
      },
    });

    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const data = updateProjectSchema.parse(req.body);

    // If updating project name, check uniqueness
    if (data.projectName && data.projectName !== existingProject.projectName) {
      const nameConflict = await prisma.weddingProject.findUnique({
        where: {
          coupleId_projectName: {
            coupleId: req.user.sub,
            projectName: data.projectName,
          },
        },
      });

      if (nameConflict) {
        return res.status(409).json({ error: 'Project name already exists' });
      }
    }

    // If venue is provided, verify it exists and is a venue service
    if (data.venueServiceListingId !== undefined) {
      if (data.venueServiceListingId) {
        const venueService = await prisma.serviceListing.findFirst({
          where: {
            id: data.venueServiceListingId,
            category: 'Venue',
            isActive: true,
          },
        });

        if (!venueService) {
          return res.status(404).json({ error: 'Venue service not found or inactive' });
        }
      }
    }

    // If base package is provided, verify it exists
    if (data.basePackageId !== undefined && data.basePackageId) {
      const basePackage = await prisma.weddingPackage.findUnique({
        where: { id: data.basePackageId },
      });

      if (!basePackage) {
        return res.status(404).json({ error: 'Base package not found' });
      }
    }

    const updateData = {};
    if (data.projectName) updateData.projectName = data.projectName;
    if (data.weddingDate) updateData.weddingDate = new Date(data.weddingDate);
    if (data.weddingType) updateData.weddingType = data.weddingType;
    if (data.venueServiceListingId !== undefined) updateData.venueServiceListingId = data.venueServiceListingId || null;
    if (data.basePackageId !== undefined) updateData.basePackageId = data.basePackageId || null;
    if (data.status) updateData.status = data.status;

    const project = await prisma.weddingProject.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        venueServiceListing: {
          include: {
            vendor: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        basePackage: true,
      },
    });

    res.json(project);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

/**
 * DELETE /projects/:id
 * Delete a wedding project
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    // Check if project exists and belongs to couple
    const project = await prisma.weddingProject.findFirst({
      where: {
        id: req.params.id,
        coupleId: req.user.sub,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Only allow deletion of draft projects
    if (project.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft projects can be deleted' });
    }

    await prisma.weddingProject.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

