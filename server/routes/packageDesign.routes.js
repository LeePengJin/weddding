const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { requireAdmin } = require('../middleware/auth');
const { prefixedUlid } = require('../utils/id');
const { buildDefaultLayoutData, ensurePackageDesign } = require('../services/package.service');

const router = express.Router();
const prisma = new PrismaClient();
const previewDir = path.join(__dirname, '..', 'uploads', 'package-previews');
fs.mkdirSync(previewDir, { recursive: true });

const VECTOR_SCHEMA = z.object({
  x: z.coerce.number(),
  y: z.coerce.number(),
  z: z.coerce.number(),
});

const ADD_ELEMENT_SCHEMA = z.object({
  serviceListingId: z.string().uuid('Invalid service listing ID'),
  position: VECTOR_SCHEMA.optional(),
  rotation: z.coerce.number().optional(),
});

const UPDATE_ELEMENT_SCHEMA = z
  .object({
    position: VECTOR_SCHEMA.optional(),
    rotation: z.coerce.number().optional(),
    isLocked: z.boolean().optional(),
    metadata: z
      .object({
        role: z.string().max(50).nullable().optional(),
        quantityIndex: z.number().int().nullable().optional(),
      })
      .optional(),
  })
  .refine(
    (data) => data.position || data.rotation !== undefined || data.isLocked !== undefined || data.metadata,
    { message: 'Nothing to update' }
  );

const CAMERA_SCHEMA = z
  .object({
    position: VECTOR_SCHEMA.optional(),
    zoomLevel: z.coerce.number().min(0.1).max(10).optional(),
  })
  .refine((data) => data.position || data.zoomLevel !== undefined, {
    message: 'Provide position or zoomLevel to update',
  });

const SAVE_SCHEMA = z.object({
  layoutData: z.any().optional(),
});

const PREVIEW_SCHEMA = z.object({
  imageData: z.string().min(100, 'Preview image data is required'),
});

const SET_VENUE_SCHEMA = z.object({
  venueServiceListingId: z.string().uuid('Invalid venue service listing ID'),
});

const CATALOG_QUERY_SCHEMA = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  has3DModel: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (typeof val === 'boolean') return val;
      return val === 'true';
    }),
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      const num = Number(val);
      return Number.isNaN(num) || num < 1 ? 1 : num;
    }),
  pageSize: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      const num = Number(val);
      if (Number.isNaN(num)) return 20;
      return Math.min(Math.max(num, 5), 50);
    }),
});

const PLACEMENT_INCLUDE = {
  designElement: {
    select: {
      id: true,
      name: true,
      modelFile: true,
      vendorId: true,
      isStackable: true,
      dimensions: true,
      vendor: {
        select: {
          userId: true,
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
  position: true,
};

const serializeServiceListing = (listing) => {
  if (!listing) return null;
  return {
    id: listing.id,
    name: listing.name,
    category: listing.category,
    price: listing.price ? listing.price.toString() : null,
    vendor: listing.vendor
      ? {
          id: listing.vendor.userId,
          name: listing.vendor.user?.name ?? null,
          email: listing.vendor.user?.email ?? null,
        }
      : null,
  };
};

const serializePlacement = (placement, meta, serviceMap) => {
  const position = placement?.position;
  const safePosition = {
    x: typeof position?.x === 'number' ? position.x : 0,
    y: typeof position?.y === 'number' ? position.y : 0,
    z: typeof position?.z === 'number' ? position.z : 0,
  };
  const service = meta?.serviceListingId ? serviceMap[meta.serviceListingId] ?? null : null;

  return {
    id: placement.id,
    rotation: placement.rotation ?? 0,
    isLocked: placement.isLocked,
    position: {
      x: safePosition.x,
      y: safePosition.y,
      z: safePosition.z,
    },
    designElement: placement.designElement
      ? {
          id: placement.designElement.id,
          name: placement.designElement.name,
          modelFile: placement.designElement.modelFile,
          vendorId: placement.designElement.vendorId,
          isStackable: placement.designElement.isStackable,
          dimensions: placement.designElement.dimensions,
          vendor: placement.designElement.vendor
            ? {
                id: placement.designElement.vendor.userId,
                name: placement.designElement.vendor.user?.name ?? null,
                email: placement.designElement.vendor.user?.email ?? null,
              }
            : null,
        }
      : null,
    serviceListing: service,
    metadata: meta || null,
  };
};

const serializeListingForCatalog = (listing) => {
  // Calculate average rating from reviews if not already set
  let averageRating = listing.averageRating ? parseFloat(listing.averageRating.toString()) : null;
  if (!averageRating && listing.reviews && listing.reviews.length > 0) {
    const sum = listing.reviews.reduce((acc, review) => acc + review.rating, 0);
    averageRating = sum / listing.reviews.length;
  }

  return {
    id: listing.id,
    name: listing.name,
    description: listing.description,
    category: listing.category,
    customCategory: listing.customCategory,
    price: listing.price.toString(),
    averageRating: averageRating ? averageRating.toFixed(2) : null,
    reviewCount: listing.reviews ? listing.reviews.length : 0,
    reviews: listing.reviews
      ? listing.reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          reviewDate: review.reviewDate,
          reviewer: review.reviewer
            ? {
                id: review.reviewer.id,
                name: review.reviewer.name,
              }
            : null,
        }))
      : [],
    has3DModel: listing.has3DModel,
    availabilityType: listing.availabilityType,
    images: listing.images,
    vendor: listing.vendor
      ? {
          id: listing.vendor.userId,
          name: listing.vendor.user?.name ?? null,
          email: listing.vendor.user?.email ?? null,
        }
      : null,
    designElement: listing.designElement
      ? {
          id: listing.designElement.id,
          name: listing.designElement.name,
          modelFile: listing.designElement.modelFile,
          dimensions: listing.designElement.dimensions, // Include dimensions for 3D preview
        }
      : null,
    components: listing.components
      ? listing.components.map((component) => ({
          id: component.id,
          role: component.role,
          quantityPerUnit: component.quantityPerUnit,
          designElement: component.designElement
            ? {
                id: component.designElement.id,
                name: component.designElement.name,
                modelFile: component.designElement.modelFile,
                dimensions: component.designElement.dimensions, // Include dimensions for component 3D preview
              }
            : null,
        }))
      : [],
    availability: null,
  };
};

async function fetchPackage(packageId) {
  return prisma.weddingPackage.findUnique({
    where: { id: packageId },
    select: {
      id: true,
      packageName: true,
      status: true,
      previewImage: true,
    },
  });
}

const ensurePackageEditable = (pkg, res) => {
  if (pkg.status === 'published') {
    res.status(400).json({ error: 'Published packages cannot be modified. Unpublish the package to continue.' });
    return false;
  }
  return true;
};

router.get('/:packageId', requireAdmin, async (req, res, next) => {
  try {
    const pkg = await fetchPackage(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    const design = await ensurePackageDesign(prisma, pkg.id);
    const layoutData = design.layoutData || buildDefaultLayoutData();
    const placementsMeta = layoutData.placementsMeta || {};

    // Fetch venue info if venueServiceListingId exists
    let venueInfo = null;
    if (design.venueServiceListingId) {
      const venueListing = await prisma.serviceListing.findUnique({
        where: { id: design.venueServiceListingId },
        include: {
          designElement: true,
          vendor: {
            select: {
              userId: true,
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });
      if (venueListing) {
        venueInfo = {
          id: venueListing.id,
          name: venueListing.name,
          modelFile: venueListing.designElement?.modelFile || null,
          vendor: venueListing.vendor
            ? {
                id: venueListing.vendor.userId,
                name: venueListing.vendor.user?.name || null,
                email: venueListing.vendor.user?.email || null,
              }
            : null,
        };
      }
    }

    const serviceListingIds = [
      ...new Set(
        Object.values(placementsMeta)
          .map((meta) => meta?.serviceListingId)
          .filter(Boolean)
      ),
    ];

    let serviceListings = [];
    if (serviceListingIds.length > 0) {
      serviceListings = await prisma.serviceListing.findMany({
        where: { id: { in: serviceListingIds } },
        include: {
          vendor: {
            select: {
              userId: true,
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    }

    const serviceMap = serviceListings.reduce((acc, listing) => {
      acc[listing.id] = serializeServiceListing(listing);
      return acc;
    }, {});

    const placements = design.placedElements.map((placement) =>
      serializePlacement(placement, placementsMeta[placement.id], serviceMap)
    );

    return res.json({
      package: {
        id: pkg.id,
        name: pkg.packageName,
        status: pkg.status,
      },
      venue: venueInfo,
      design: {
        id: design.id,
        layoutData,
        cameraPosition: design.cameraPosition
          ? {
              x: design.cameraPosition.x,
              y: design.cameraPosition.y,
              z: design.cameraPosition.z,
            }
          : null,
        zoomLevel: design.zoomLevel,
        placedElements: placements,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:packageId/elements', requireAdmin, async (req, res, next) => {
  try {
    const payload = ADD_ELEMENT_SCHEMA.parse(req.body);
    const pkg = await fetchPackage(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    if (!ensurePackageEditable(pkg, res)) {
      return;
    }

    const serviceListing = await prisma.serviceListing.findFirst({
      where: {
        id: payload.serviceListingId,
        isActive: true,
      },
      include: {
        designElement: true,
        vendor: {
          select: {
            userId: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        components: {
          include: {
            designElement: true,
          },
        },
      },
    });

    if (!serviceListing) {
      return res.status(404).json({ error: 'Service listing not found or inactive' });
    }

    if (serviceListing.category === 'Venue') {
      return res.status(400).json({ error: 'Venue listings cannot be placed inside another venue.' });
    }

    const design = await ensurePackageDesign(prisma, pkg.id);
    const elementDescriptors = [];

    if (serviceListing.designElementId && serviceListing.designElement) {
      elementDescriptors.push({
        designElementId: serviceListing.designElementId,
        role: 'primary',
        quantity: 1,
      });
    }

    serviceListing.components.forEach((component) => {
      if (component.designElementId) {
        elementDescriptors.push({
          designElementId: component.designElementId,
          role: component.role || 'component',
          quantity: component.quantityPerUnit || 1,
        });
      }
    });

    if (elementDescriptors.length === 0) {
      return res.status(400).json({
        error: 'Selected service listing does not have any 3D design elements yet.',
      });
    }

    const basePosition = payload.position || { x: 0, y: 0, z: 0 };
    const rotation = payload.rotation ?? 0;
    const bundleId = prefixedUlid('bnd');
    const metadataEntries = {};
    const createdPlacements = [];

    await prisma.$transaction(async (tx) => {
      let offsetIndex = 0;
      for (const descriptor of elementDescriptors) {
        for (let i = 0; i < descriptor.quantity; i += 1) {
          const positionRecord = await tx.coordinates.create({
            data: {
              id: prefixedUlid('pos'),
              x: basePosition.x + offsetIndex * 0.5,
              y: basePosition.y,
              z: basePosition.z,
            },
          });

          const placement = await tx.packagePlacedElement.create({
            data: {
              id: prefixedUlid('ple'),
              packageDesignId: design.id,
              designElementId: descriptor.designElementId,
              serviceListingId: serviceListing.id,
              positionId: positionRecord.id,
              rotation,
            },
            include: PLACEMENT_INCLUDE,
          });

          createdPlacements.push(placement);

          metadataEntries[placement.id] = {
            serviceListingId: serviceListing.id,
            bundleId,
            role: descriptor.role,
            quantityIndex: descriptor.quantity > 1 ? i + 1 : null,
            unitPrice: serviceListing.price ? serviceListing.price.toString() : null,
          };

          offsetIndex += 1;
        }
      }

      const layoutData = design.layoutData || buildDefaultLayoutData();
      const placementsMeta = { ...(layoutData.placementsMeta || {}) };

      Object.assign(placementsMeta, metadataEntries);

      await tx.packageDesign.update({
        where: { id: design.id },
        data: {
          layoutData: {
            ...layoutData,
            placementsMeta,
            lastSavedAt: new Date().toISOString(),
          },
        },
      });
    });

    const serviceInfo = serializeServiceListing(serviceListing);
    const serviceMap = serviceInfo ? { [serviceInfo.id]: serviceInfo } : {};

    const responsePlacements = createdPlacements.map((placement) =>
      serializePlacement(placement, metadataEntries[placement.id], serviceMap)
    );

    return res.status(201).json({
      bundleId,
      placements: responsePlacements,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((issue) => ({
        field: issue.path?.[0] ?? 'unknown',
        message: issue.message,
      }));
      return res.status(400).json({
        error: issues[0]?.message || 'Invalid input',
        issues,
      });
    }
    return next(err);
  }
});

router.patch('/:packageId/elements/:elementId', requireAdmin, async (req, res, next) => {
  try {
    const payload = UPDATE_ELEMENT_SCHEMA.parse(req.body);
    const pkg = await fetchPackage(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    if (!ensurePackageEditable(pkg, res)) {
      return;
    }

    const design = await ensurePackageDesign(prisma, pkg.id);
    const placement = await prisma.packagePlacedElement.findFirst({
      where: {
        id: req.params.elementId,
        packageDesignId: design.id,
      },
      include: {
        position: true,
      },
    });

    if (!placement) {
      return res.status(404).json({ error: 'Placed element not found' });
    }

    const layoutData = design.layoutData || {};
    const placementsMeta = { ...(layoutData.placementsMeta || {}) };
    const existingMeta = placementsMeta[placement.id] || {};

    await prisma.$transaction(async (tx) => {
      if (payload.position) {
        await tx.coordinates.update({
          where: { id: placement.positionId },
          data: {
            x: payload.position.x,
            y: payload.position.y,
            z: payload.position.z,
          },
        });
      }

      if (payload.rotation !== undefined || payload.isLocked !== undefined) {
        await tx.packagePlacedElement.update({
          where: { id: placement.id },
          data: {
            rotation: payload.rotation !== undefined ? payload.rotation : placement.rotation,
            isLocked: payload.isLocked !== undefined ? payload.isLocked : placement.isLocked,
          },
        });
      }

      if (payload.metadata) {
        placementsMeta[placement.id] = {
          ...existingMeta,
          ...payload.metadata,
        };
      }

      await tx.packageDesign.update({
        where: { id: design.id },
        data: {
          layoutData: {
            ...layoutData,
            placementsMeta,
            lastSavedAt: new Date().toISOString(),
          },
        },
      });
    });

    const updatedPlacement = await prisma.packagePlacedElement.findUnique({
      where: { id: placement.id },
      include: PLACEMENT_INCLUDE,
    });

    const serviceListingId = placementsMeta[placement.id]?.serviceListingId;
    let serviceListingInfo = null;
    if (serviceListingId) {
      const serviceListing = await prisma.serviceListing.findUnique({
        where: { id: serviceListingId },
        include: {
          vendor: {
            select: {
              userId: true,
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });
      serviceListingInfo = serializeServiceListing(serviceListing);
    }

    const responsePlacement = serializePlacement(
      updatedPlacement,
      placementsMeta[placement.id],
      serviceListingInfo ? { [serviceListingInfo.id]: serviceListingInfo } : {}
    );

    return res.json(responsePlacement);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((issue) => ({
        field: issue.path?.[0] ?? 'unknown',
        message: issue.message,
      }));
      return res.status(400).json({
        error: issues[0]?.message || 'Invalid input',
        issues,
      });
    }
    return next(err);
  }
});

router.delete('/:packageId/elements/:elementId', requireAdmin, async (req, res, next) => {
  try {
    const removeScope = req.query.scope === 'bundle' ? 'bundle' : 'single';
    const pkg = await fetchPackage(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    if (!ensurePackageEditable(pkg, res)) {
      return;
    }

    const design = await ensurePackageDesign(prisma, pkg.id);
    const layoutData = design.layoutData || {};
    const placementsMeta = { ...(layoutData.placementsMeta || {}) };
    const targetMeta = placementsMeta[req.params.elementId];

    const placementIdsToDelete = [req.params.elementId];
    if (removeScope === 'bundle' && targetMeta?.bundleId) {
      Object.entries(placementsMeta).forEach(([placementId, meta]) => {
        if (meta?.bundleId === targetMeta.bundleId && !placementIdsToDelete.includes(placementId)) {
          placementIdsToDelete.push(placementId);
        }
      });
    }

    const placements = await prisma.packagePlacedElement.findMany({
      where: {
        id: { in: placementIdsToDelete },
        packageDesignId: design.id,
      },
      select: {
        id: true,
        positionId: true,
      },
    });

    if (placements.length === 0) {
      return res.status(404).json({ error: 'Placed element not found' });
    }

    const positionIds = placements.map((placement) => placement.positionId);

    await prisma.$transaction(async (tx) => {
      await tx.packagePlacedElement.deleteMany({
        where: { id: { in: placements.map((p) => p.id) } },
      });

      await tx.coordinates.deleteMany({
        where: { id: { in: positionIds } },
      });

      placementIdsToDelete.forEach((placementId) => {
        delete placementsMeta[placementId];
      });

      await tx.packageDesign.update({
        where: { id: design.id },
        data: {
          layoutData: {
            ...layoutData,
            placementsMeta,
            lastSavedAt: new Date().toISOString(),
          },
        },
      });
    });

    return res.json({
      removedPlacementIds: placementIdsToDelete,
    });
  } catch (err) {
    return next(err);
  }
});

router.patch('/:packageId/camera', requireAdmin, async (req, res, next) => {
  try {
    const payload = CAMERA_SCHEMA.parse(req.body);
    const pkg = await fetchPackage(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    if (!ensurePackageEditable(pkg, res)) {
      return;
    }

    const design = await ensurePackageDesign(prisma, pkg.id);

    let cameraPositionId = design.cameraPositionId;
    await prisma.$transaction(async (tx) => {
      if (payload.position) {
        if (cameraPositionId) {
          await tx.coordinates.update({
            where: { id: cameraPositionId },
            data: {
              x: payload.position.x,
              y: payload.position.y,
              z: payload.position.z,
            },
          });
        } else {
          const camera = await tx.coordinates.create({
            data: {
              id: prefixedUlid('cam'),
              x: payload.position.x,
              y: payload.position.y,
              z: payload.position.z,
            },
          });
          cameraPositionId = camera.id;
        }
      }

      await tx.packageDesign.update({
        where: { id: design.id },
        data: {
          cameraPositionId,
          zoomLevel: payload.zoomLevel ?? design.zoomLevel,
        },
      });
    });

    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((issue) => ({
        field: issue.path?.[0] ?? 'unknown',
        message: issue.message,
      }));
      return res.status(400).json({
        error: issues[0]?.message || 'Invalid input',
        issues,
      });
    }
    return next(err);
  }
});

router.post('/:packageId/save', requireAdmin, async (req, res, next) => {
  try {
    const payload = SAVE_SCHEMA.parse(req.body);
    const pkg = await fetchPackage(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    if (!ensurePackageEditable(pkg, res)) {
      return;
    }

    const design = await ensurePackageDesign(prisma, pkg.id);
    const layoutData = design.layoutData || buildDefaultLayoutData();

    await prisma.packageDesign.update({
      where: { id: design.id },
      data: {
        layoutData: {
          ...layoutData,
          ...(payload.layoutData || {}),
          placementsMeta: payload.layoutData?.placementsMeta || layoutData.placementsMeta || {},
          lastSavedAt: new Date().toISOString(),
        },
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((issue) => ({
        field: issue.path?.[0] ?? 'unknown',
        message: issue.message,
      }));
      return res.status(400).json({
        error: issues[0]?.message || 'Invalid input',
        issues,
      });
    }
    return next(err);
  }
});

// GET /admin/package-design/:packageId/venues
// Fetch available venue listings for selection
router.get('/:packageId/venues', requireAdmin, async (req, res, next) => {
  try {
    const pkg = await fetchPackage(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    const venues = await prisma.serviceListing.findMany({
      where: {
        category: 'Venue',
        isActive: true,
        has3DModel: true, // Only venues with 3D models
        vendor: {
          user: {
            status: 'active',
          },
        },
      },
      include: {
        designElement: {
          select: {
            id: true,
            modelFile: true,
          },
        },
        vendor: {
          select: {
            userId: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const serializedVenues = venues.map((venue) => ({
      id: venue.id,
      name: venue.name,
      description: venue.description,
      price: venue.price ? venue.price.toString() : null,
      images: venue.images,
      has3DModel: venue.has3DModel && !!venue.designElement?.modelFile,
      modelFile: venue.designElement?.modelFile || null,
      vendor: venue.vendor
        ? {
            id: venue.vendor.userId,
            name: venue.vendor.user?.name || null,
            email: venue.vendor.user?.email || null,
          }
        : null,
    }));

    return res.json({ venues: serializedVenues });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/package-design/:packageId/venue
// Set or update the venue for a package design
router.patch('/:packageId/venue', requireAdmin, async (req, res, next) => {
  try {
    const payload = SET_VENUE_SCHEMA.parse(req.body);
    const pkg = await fetchPackage(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    if (!ensurePackageEditable(pkg, res)) {
      return;
    }

    // Verify the venue listing exists and is a venue with 3D model
    const venueListing = await prisma.serviceListing.findFirst({
      where: {
        id: payload.venueServiceListingId,
        category: 'Venue',
        isActive: true,
        has3DModel: true,
        vendor: {
          user: {
            status: 'active',
          },
        },
      },
      include: {
        designElement: true,
      },
    });

    if (!venueListing) {
      return res.status(404).json({
        error: 'Venue listing not found, inactive, or does not have a 3D model',
      });
    }

    if (!venueListing.designElement?.modelFile) {
      return res.status(400).json({
        error: 'Selected venue does not have a 3D model file',
      });
    }

    // Update or create the package design with venue
    const design = await ensurePackageDesign(prisma, pkg.id);
    await prisma.packageDesign.update({
      where: { id: design.id },
      data: {
        venueServiceListingId: payload.venueServiceListingId,
        venueName: venueListing.name,
      },
    });

    return res.json({
      ok: true,
      venue: {
        id: venueListing.id,
        name: venueListing.name,
        modelFile: venueListing.designElement.modelFile,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((issue) => ({
        field: issue.path?.[0] ?? 'unknown',
        message: issue.message,
      }));
      return res.status(400).json({
        error: issues[0]?.message || 'Invalid input',
        issues,
      });
    }
    return next(err);
  }
});

router.get('/:packageId/catalog', requireAdmin, async (req, res, next) => {
  try {
    const query = CATALOG_QUERY_SCHEMA.parse(req.query);
    const pkg = await fetchPackage(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    const where = {
      isActive: true,
      category: {
        not: 'Venue',
      },
    };

    if (query.category) {
      if (query.category === 'Venue') {
        return res.status(400).json({ error: 'Venue listings cannot be placed inside another venue.' });
      }
      where.category = query.category;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { vendor: { user: { name: { contains: query.search, mode: 'insensitive' } } } },
        { customCategory: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.has3DModel !== undefined) {
      where.has3DModel = query.has3DModel;
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [total, listings] = await Promise.all([
      prisma.serviceListing.count({ where }),
      prisma.serviceListing.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: {
            select: {
              userId: true,
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
          designElement: true,
          components: {
            include: {
              designElement: true,
            },
          },
          reviews: {
            include: {
              reviewer: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              reviewDate: 'desc',
            },
            take: 10, // Limit to latest 10 reviews for catalog
          },
        },
      }),
    ]);

    const serializedListings = listings.map((listing) => serializeListingForCatalog(listing));

    return res.json({
      page,
      pageSize,
      total,
      listings: serializedListings,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((issue) => ({
        field: issue.path?.[0] ?? 'unknown',
        message: issue.message,
      }));
      return res.status(400).json({
        error: issues[0]?.message || 'Invalid input',
        issues,
      });
    }
    return next(err);
  }
});

router.post('/:packageId/preview', requireAdmin, async (req, res, next) => {
  try {
    const payload = PREVIEW_SCHEMA.parse(req.body);
    const pkg = await fetchPackage(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    if (!ensurePackageEditable(pkg, res)) {
      return;
    }

    const match = payload.imageData.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/i);
    if (!match) {
      return res.status(400).json({ error: 'Invalid image payload' });
    }

    const mimeSubtype = match[2].toLowerCase();
    const extension = mimeSubtype === 'png' ? 'png' : 'jpg';
    const buffer = Buffer.from(match[3], 'base64');
    const filename = `${pkg.id}-${Date.now()}.${extension}`;
    const filePath = path.join(previewDir, filename);

    await fs.promises.writeFile(filePath, buffer);

    if (pkg.previewImage && pkg.previewImage.startsWith('/uploads/package-previews/')) {
      const previousFile = path.join(previewDir, path.basename(pkg.previewImage));
      await fs.promises.unlink(previousFile).catch(() => {});
    }

    const relativePath = `/uploads/package-previews/${filename}`;
    await prisma.weddingPackage.update({
      where: { id: pkg.id },
      data: { previewImage: relativePath },
    });

    return res.json({ url: relativePath });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid input' });
    }
    return next(err);
  }
});

module.exports = router;

