const express = require('express');
const { PrismaClient, WeddingPackageStatus } = require('@prisma/client');
const { PACKAGE_INCLUDE, buildPackageResponse, ensurePackageDesign } = require('../services/package.service');
const { buildDefaultLayoutData } = require('../services/package.service');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (_req, res, next) => {
  try {
    const packages = await prisma.weddingPackage.findMany({
      where: { status: WeddingPackageStatus.published },
      include: PACKAGE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    res.json(packages.map(buildPackageResponse));
  } catch (err) {
    next(err);
  }
});

router.get('/:packageId', async (req, res, next) => {
  try {
    const pkg = await prisma.weddingPackage.findFirst({
      where: {
        id: req.params.packageId,
        status: WeddingPackageStatus.published,
      },
      include: PACKAGE_INCLUDE,
    });

    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    res.json(buildPackageResponse(pkg));
  } catch (err) {
    next(err);
  }
});

// Public preview endpoint for 3D design
router.get('/:packageId/preview', async (req, res, next) => {
  try {
    const pkg = await prisma.weddingPackage.findFirst({
      where: {
        id: req.params.packageId,
        status: WeddingPackageStatus.published,
      },
      select: {
        id: true,
        packageName: true,
        status: true,
      },
    });

    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    // Fetch design with full relations for preview
    const design = await prisma.packageDesign.findUnique({
      where: { packageId: pkg.id },
      include: {
        placedElements: {
          include: {
            position: true,
            designElement: {
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
          },
        },
        cameraPosition: true,
      },
    });

    if (!design) {
      // Create default design if it doesn't exist
      const defaultDesign = await ensurePackageDesign(prisma, pkg.id);
      const layoutData = defaultDesign.layoutData || buildDefaultLayoutData();
      return res.json({
        package: {
          id: pkg.id,
          name: pkg.packageName,
          status: pkg.status,
        },
        venue: null,
        design: {
          id: defaultDesign.id,
          layoutData,
          cameraPosition: defaultDesign.cameraPosition
            ? {
                x: defaultDesign.cameraPosition.x,
                y: defaultDesign.cameraPosition.y,
                z: defaultDesign.cameraPosition.z,
              }
            : null,
          zoomLevel: defaultDesign.zoomLevel,
          placedElements: [],
        },
      });
    }

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

    const serviceMap = serviceListings.reduce((acc, listing) => {
      acc[listing.id] = serializeServiceListing(listing);
      return acc;
    }, {});

    const serializePlacement = (placement, meta) => {
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

    const placements = design.placedElements.map((placement) =>
      serializePlacement(placement, placementsMeta[placement.id])
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

module.exports = router;

