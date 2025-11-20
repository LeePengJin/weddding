'use strict';

const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');

const { requireAuth } = require('../middleware/auth');
const { prefixedUlid } = require('../utils/id');

const router = express.Router();
const prisma = new PrismaClient();

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

const UPDATE_ELEMENT_SCHEMA = z.object({
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

const CAMERA_SCHEMA = z.object({
    position: VECTOR_SCHEMA.optional(),
    zoomLevel: z.coerce.number().min(0.1).max(10).optional(),
  })
  .refine((data) => data.position || data.zoomLevel !== undefined, {
    message: 'Provide position or zoomLevel to update',
  });

const SAVE_SCHEMA = z.object({
  layoutData: z.record(z.any()).optional(),
});

const CATALOG_QUERY_SCHEMA = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  includeUnavailable: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((val) => {
      if (val === undefined) return false;
      if (typeof val === 'boolean') return val;
      return val === 'true';
    }),
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

const AVAILABILITY_QUERY_SCHEMA = z.object({
  serviceListingIds: z
    .string()
    .or(z.array(z.string()))
    .transform((val) => {
      if (Array.isArray(val)) {
        return val;
      }
      return val
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    })
    .pipe(z.array(z.string().uuid()).min(1)),
});

const PLACEMENT_INCLUDE = {
  designElement: {
    select: {
      id: true,
      name: true,
      modelFile: true,
      vendorId: true,
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

function buildDefaultLayoutData() {
  return {
    grid: {
      size: 1,
      visible: true,
      snapToGrid: true,
    },
    sidebar: {
      collapsed: false,
    },
    placementsMeta: {},
    lastSavedAt: new Date().toISOString(),
  };
}

function serializeServiceListing(listing) {
  if (!listing) {
    return null;
  }

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
}

function serializePlacement(placement, meta, serviceMap) {
  const service =
    meta && meta.serviceListingId ? serviceMap[meta.serviceListingId] ?? null : null;

  return {
    id: placement.id,
    rotation: placement.rotation ?? 0,
    isLocked: placement.isLocked,
    position: {
      x: placement.position.x,
      y: placement.position.y,
      z: placement.position.z,
    },
    designElement: placement.designElement
      ? {
          id: placement.designElement.id,
          name: placement.designElement.name,
          modelFile: placement.designElement.modelFile,
          vendorId: placement.designElement.vendorId,
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
}

async function fetchProject(projectId, coupleId) {
  return prisma.weddingProject.findFirst({
    where: {
      id: projectId,
      coupleId,
    },
    include: {
      venueServiceListing: {
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
      },
    },
  });
}

async function checkServiceAvailabilityForDate(serviceListingId, isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  targetDate.setHours(0, 0, 0, 0);

  const serviceListing = await prisma.serviceListing.findUnique({
    where: { id: serviceListingId },
    include: {
      vendor: {
        include: {
          timeSlots: {
            where: {
              date: targetDate,
              status: 'personal_time_off',
            },
          },
        },
      },
    },
  });

  if (!serviceListing || !serviceListing.isActive) {
    return {
      serviceListingId,
      available: false,
      reason: serviceListing ? 'Service listing is inactive' : 'Service listing not found',
    };
  }

  if (serviceListing.vendor.timeSlots.length > 0) {
    return {
      serviceListingId,
      available: false,
      reason: 'Vendor is unavailable on this date',
    };
  }

  const availabilityType = serviceListing.availabilityType;
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  if (availabilityType === 'exclusive') {
    const existingBooking = await prisma.booking.findFirst({
      where: {
        reservedDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          notIn: ['cancelled', 'rejected'],
        },
        selectedServices: {
          some: {
            serviceListingId,
          },
        },
      },
    });

    return {
      serviceListingId,
      available: !existingBooking,
      reason: existingBooking ? 'Already booked for this date' : undefined,
      availabilityType,
    };
  }

  if (availabilityType === 'reusable') {
    return {
      serviceListingId,
      available: true,
      availabilityType,
    };
  }

  if (availabilityType === 'quantity_based') {
    const record = await prisma.serviceAvailability.findUnique({
      where: {
        serviceListingId_date: {
          serviceListingId,
          date: targetDate,
        },
      },
    });

    const maxQuantity = record?.maxQuantity || serviceListing.maxQuantity || 0;

    const bookings = await prisma.booking.findMany({
      where: {
        reservedDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          notIn: ['cancelled', 'rejected'],
        },
        selectedServices: {
          some: {
            serviceListingId,
          },
        },
      },
      include: {
        selectedServices: {
          where: {
            serviceListingId,
          },
        },
      },
    });

    const bookedQuantity = bookings.reduce((sum, booking) => {
      return (
        sum +
        booking.selectedServices.reduce(
          (innerSum, svc) => innerSum + (svc.quantity || 0),
          0
        )
      );
    }, 0);

    const availableQuantity = Math.max(0, (maxQuantity || 0) - bookedQuantity);

    return {
      serviceListingId,
      available: availableQuantity > 0,
      availableQuantity,
      maxQuantity: maxQuantity || 0,
      bookedQuantity,
      availabilityType,
    };
  }

  return {
    serviceListingId,
    available: false,
    reason: 'Unsupported availability type',
  };
}

function serializeListingForCatalog(listing, availability) {
  return {
    id: listing.id,
    name: listing.name,
    description: listing.description,
    category: listing.category,
    customCategory: listing.customCategory,
    price: listing.price.toString(),
    averageRating: listing.averageRating ? listing.averageRating.toString() : null,
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
              }
            : null,
        }))
      : [],
    availability,
  };
}

async function getOrCreateVenueDesign(project) {
  const includeConfig = {
    placedElements: {
      include: PLACEMENT_INCLUDE,
    },
    cameraPosition: true,
  };

  let venueDesign = await prisma.venueDesign.findUnique({
    where: { projectId: project.id },
    include: includeConfig,
  });

  if (venueDesign) {
    return venueDesign;
  }

  if (!project.venueServiceListingId) {
    const error = new Error('Project does not have a venue assigned yet.');
    error.statusCode = 400;
    throw error;
  }

  const venueListing = await prisma.serviceListing.findFirst({
    where: {
      id: project.venueServiceListingId,
      category: 'Venue',
      isActive: true,
    },
    include: {
      designElement: true,
    },
  });

  if (!venueListing) {
    const error = new Error('Selected venue listing is not available.');
    error.statusCode = 404;
    throw error;
  }

  if (!venueListing.designElementId) {
    const error = new Error('Selected venue does not have a 3D model yet.');
    error.statusCode = 400;
    throw error;
  }

  venueDesign = await prisma.$transaction(async (tx) => {
    const cameraPosition = await tx.coordinates.create({
      data: {
        id: prefixedUlid('cam'),
        x: 0,
        y: 3,
        z: 8,
      },
    });

    const created = await tx.venueDesign.create({
      data: {
        id: prefixedUlid('vnd'),
        projectId: project.id,
        venueName: venueListing.name,
        cameraPositionId: cameraPosition.id,
        layoutData: buildDefaultLayoutData(),
        zoomLevel: 1.2,
      },
    });

    return tx.venueDesign.findUnique({
      where: { id: created.id },
      include: includeConfig,
    });
  });

  return venueDesign;
}

router.get('/:projectId', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const project = await fetchProject(req.params.projectId, req.user.sub);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const venueDesign = await getOrCreateVenueDesign(project);
    const layoutData = venueDesign.layoutData || {};
    const placementsMeta = layoutData.placementsMeta || {};

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

    const placements = venueDesign.placedElements.map((placement) =>
      serializePlacement(placement, placementsMeta[placement.id], serviceMap)
    );

    const venueListing = project.venueServiceListing;

    return res.json({
      project: {
        id: project.id,
        name: project.projectName,
        weddingDate:
          project.weddingDate instanceof Date
            ? project.weddingDate.toISOString()
            : project.weddingDate,
      },
      venue: venueListing
        ? {
            listingId: venueListing.id,
            name: venueListing.name,
            modelFile: venueListing.designElement?.modelFile ?? null,
            vendor: venueListing.vendor
              ? {
                  id: venueListing.vendor.userId,
                  name: venueListing.vendor.user?.name ?? null,
                  email: venueListing.vendor.user?.email ?? null,
                }
              : null,
          }
        : null,
      design: {
        id: venueDesign.id,
        layoutData,
        cameraPosition: venueDesign.cameraPosition
          ? {
              x: venueDesign.cameraPosition.x,
              y: venueDesign.cameraPosition.y,
              z: venueDesign.cameraPosition.z,
            }
          : null,
        zoomLevel: venueDesign.zoomLevel,
        placedElements: placements,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.post('/:projectId/elements', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const payload = ADD_ELEMENT_SCHEMA.parse(req.body);

    const project = await fetchProject(req.params.projectId, req.user.sub);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const venueDesign = await getOrCreateVenueDesign(project);

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

          const placement = await tx.placedElement.create({
            data: {
              id: prefixedUlid('ple'),
              venueDesignId: venueDesign.id,
              designElementId: descriptor.designElementId,
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

      const layoutData = venueDesign.layoutData || {};
      const placementsMeta = { ...(layoutData.placementsMeta || {}) };

      Object.assign(placementsMeta, metadataEntries);

      await tx.venueDesign.update({
        where: { id: venueDesign.id },
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
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.patch('/:projectId/elements/:elementId', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const payload = UPDATE_ELEMENT_SCHEMA.parse(req.body);

    const project = await fetchProject(req.params.projectId, req.user.sub);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const venueDesign = await getOrCreateVenueDesign(project);

    const placement = await prisma.placedElement.findFirst({
      where: {
        id: req.params.elementId,
        venueDesignId: venueDesign.id,
      },
      include: {
        position: true,
      },
    });

    if (!placement) {
      return res.status(404).json({ error: 'Placed element not found' });
    }

    const layoutData = venueDesign.layoutData || {};
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
        await tx.placedElement.update({
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

      await tx.venueDesign.update({
        where: { id: venueDesign.id },
        data: {
          layoutData: {
            ...layoutData,
            placementsMeta,
            lastSavedAt: new Date().toISOString(),
          },
        },
      });
    });

    const updatedPlacement = await prisma.placedElement.findUnique({
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
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.delete('/:projectId/elements/:elementId', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const removeScope = req.query.scope === 'bundle' ? 'bundle' : 'single';

    const project = await fetchProject(req.params.projectId, req.user.sub);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const venueDesign = await getOrCreateVenueDesign(project);

    const layoutData = venueDesign.layoutData || {};
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

    const placements = await prisma.placedElement.findMany({
      where: {
        id: { in: placementIdsToDelete },
        venueDesignId: venueDesign.id,
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
      await tx.placedElement.deleteMany({
        where: { id: { in: placements.map((p) => p.id) } },
      });

      await tx.coordinates.deleteMany({
        where: { id: { in: positionIds } },
      });

      placementIdsToDelete.forEach((placementId) => {
        delete placementsMeta[placementId];
      });

      await tx.venueDesign.update({
        where: { id: venueDesign.id },
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
      removedPlacementIds: placements.map((p) => p.id),
      removedBundle: removeScope === 'bundle' && targetMeta?.bundleId ? targetMeta.bundleId : null,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.patch('/:projectId/camera', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const payload = CAMERA_SCHEMA.parse(req.body);

    const project = await fetchProject(req.params.projectId, req.user.sub);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const venueDesign = await getOrCreateVenueDesign(project);

    let cameraPositionId = venueDesign.cameraPositionId;

    await prisma.$transaction(async (tx) => {
      if (payload.position) {
        if (cameraPositionId) {
          await tx.coordinates.update({
            where: { id: cameraPositionId },
            data: payload.position,
          });
        } else {
          const coord = await tx.coordinates.create({
            data: {
              id: prefixedUlid('cam'),
              x: payload.position.x,
              y: payload.position.y,
              z: payload.position.z,
            },
          });
          cameraPositionId = coord.id;
        }
      }

      await tx.venueDesign.update({
        where: { id: venueDesign.id },
        data: {
          cameraPositionId,
          zoomLevel: payload.zoomLevel !== undefined ? payload.zoomLevel : venueDesign.zoomLevel,
          layoutData: {
            ...(venueDesign.layoutData || {}),
            lastSavedAt: new Date().toISOString(),
          },
        },
      });
    });

    const updatedDesign = await prisma.venueDesign.findUnique({
      where: { id: venueDesign.id },
      include: { cameraPosition: true },
    });

    return res.json({
      cameraPosition: updatedDesign.cameraPosition
        ? {
            x: updatedDesign.cameraPosition.x,
            y: updatedDesign.cameraPosition.y,
            z: updatedDesign.cameraPosition.z,
          }
        : null,
      zoomLevel: updatedDesign.zoomLevel,
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
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.post('/:projectId/save', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const payload = SAVE_SCHEMA.parse(req.body);

    const project = await fetchProject(req.params.projectId, req.user.sub);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const venueDesign = await getOrCreateVenueDesign(project);
    const layoutData = venueDesign.layoutData || {};

    const updatedLayout = {
      ...layoutData,
      ...(payload.layoutData || {}),
      placementsMeta: payload.layoutData?.placementsMeta || layoutData.placementsMeta || {},
      lastSavedAt: new Date().toISOString(),
    };

    await prisma.venueDesign.update({
      where: { id: venueDesign.id },
      data: {
        layoutData: updatedLayout,
      },
    });

    return res.json({
      message: 'Design saved successfully',
      layoutData: updatedLayout,
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
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.get('/:projectId/catalog', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const query = CATALOG_QUERY_SCHEMA.parse(req.query);

    const project = await fetchProject(req.params.projectId, req.user.sub);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.weddingDate) {
      return res.status(400).json({ error: 'Wedding date is not set for this project' });
    }

    const where = {
      isActive: true,
    };

    if (query.category) {
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

    // Only filter by has3DModel if explicitly requested
    // This allows showing all listings in the catalog, not just those with 3D models
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
        },
      }),
    ]);

    const weddingDateIso =
      project.weddingDate instanceof Date
        ? project.weddingDate.toISOString().slice(0, 10)
        : project.weddingDate?.toString().slice(0, 10);

    const availabilityResults = await Promise.all(
      listings.map((listing) => checkServiceAvailabilityForDate(listing.id, weddingDateIso))
    );

    const availabilityMap = availabilityResults.reduce((acc, result) => {
      acc[result.serviceListingId] = result;
      return acc;
    }, {});

    const serializedListings = listings
      .map((listing) => serializeListingForCatalog(listing, availabilityMap[listing.id]))
      .filter((listing) => {
        if (query.includeUnavailable) {
          return true;
        }
        return listing.availability?.available !== false;
      });

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
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.get('/:projectId/availability', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const query = AVAILABILITY_QUERY_SCHEMA.parse(req.query);

    const project = await fetchProject(req.params.projectId, req.user.sub);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.weddingDate) {
      return res.status(400).json({ error: 'Wedding date is not set for this project' });
    }

    const weddingDateIso =
      project.weddingDate instanceof Date
        ? project.weddingDate.toISOString().slice(0, 10)
        : project.weddingDate?.toString().slice(0, 10);

    const availabilityResults = await Promise.all(
      query.serviceListingIds.map((id) => checkServiceAvailabilityForDate(id, weddingDateIso))
    );

    return res.json({
      date: weddingDateIso,
      results: availabilityResults,
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
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

module.exports = router;


