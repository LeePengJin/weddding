const { WeddingPackageStatus, WeddingPackageItemStatus } = require('@prisma/client');
const { prefixedUlid } = require('../utils/id');

const PACKAGE_INCLUDE = {
  items: {
    include: {
      serviceListing: {
        include: {
          vendor: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  },
  design: {
    include: {
      placedElements: true,
    },
  },
};

const decimalToString = (value) => (value === null || value === undefined ? null : value.toString());

const buildDefaultLayoutData = () => ({
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
});

const buildListingSnapshotFromEntity = (listing) => {
  if (!listing) return null;
  return {
    id: listing.id,
    name: listing.name,
    price: decimalToString(listing.price),
    category: listing.category,
    vendorId: listing.vendorId,
    vendorName: listing.vendor?.user?.name || null,
    vendorEmail: listing.vendor?.user?.email || null,
    vendorStatus: listing.vendor?.user?.status || null,
    isActive: listing.isActive,
    has3DModel: listing.has3DModel,
    images: listing.images,
  };
};

const mapPackageItem = (item) => ({
  id: item.id,
  label: item.label,
  category: item.category,
  isRequired: item.isRequired,
  minPrice: decimalToString(item.minPrice),
  maxPrice: decimalToString(item.maxPrice),
  serviceListingId: item.serviceListingId,
  replacementTags: item.replacementTags,
  notes: item.notes,
  healthStatus: item.healthStatus,
  serviceListingSnapshot: item.serviceListingSnapshot,
  serviceListing: item.serviceListing
    ? {
        id: item.serviceListing.id,
        name: item.serviceListing.name,
        price: decimalToString(item.serviceListing.price),
        category: item.serviceListing.category,
        isActive: item.serviceListing.isActive,
        vendor: item.serviceListing.vendor
          ? {
              id: item.serviceListing.vendor.userId,
              name: item.serviceListing.vendor.user?.name || null,
              email: item.serviceListing.vendor.user?.email || null,
              status: item.serviceListing.vendor.user?.status || null,
            }
          : null,
      }
    : null,
});

const buildPackageResponse = (pkg) => {
  const items = pkg.items ? pkg.items.map(mapPackageItem) : [];
  const summary = items.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.healthStatus && item.healthStatus !== WeddingPackageItemStatus.ok) {
        acc.issues += 1;
      }
      return acc;
    },
    { total: 0, issues: 0 }
  );

  const designSummary = pkg.design
    ? (() => {
        const placed = pkg.design.placedElements || [];
        const designServiceIds = new Set(placed.map((p) => p?.serviceListingId).filter(Boolean));
        const missingPlacementServiceListingIds = [];

        items.forEach((item) => {
          const listingId = item.serviceListingId || item.serviceListingSnapshot?.id || null;
          const expects3D = Boolean(item.serviceListing?.has3DModel ?? item.serviceListingSnapshot?.has3DModel);
          if (expects3D && listingId && !designServiceIds.has(listingId)) {
            missingPlacementServiceListingIds.push(listingId);
          }
        });

        return {
        id: pkg.design.id,
        elementCount: pkg.design.placedElements?.length || 0,
        updatedAt: pkg.design.updatedAt,
          missingPlacementCount: missingPlacementServiceListingIds.length,
          missingPlacementServiceListingIds,
        };
      })()
    : {
        id: null,
        elementCount: 0,
        updatedAt: null,
        missingPlacementCount: 0,
        missingPlacementServiceListingIds: [],
      };

  return {
    id: pkg.id,
    packageName: pkg.packageName,
    description: pkg.description,
    previewImage: pkg.previewImage,
    status: pkg.status,
    lastValidatedAt: pkg.lastValidatedAt,
    invalidListingIds: pkg.invalidListingIds,
    notes: pkg.notes,
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
    items,
    healthSummary: summary,
    designSummary,
  };
};

const getListingSnapshot = async (prisma, listingId) => {
  if (!listingId) return null;
  const listing = await prisma.serviceListing.findUnique({
    where: { id: listingId },
    include: {
      vendor: {
        include: {
          user: true,
        },
      },
    },
  });
  if (!listing) return null;
  return buildListingSnapshotFromEntity(listing);
};

const validatePackageHealth = async (prisma, packageId) => {
  const pkg = await prisma.weddingPackage.findUnique({
    where: { id: packageId },
    include: PACKAGE_INCLUDE,
  });
  if (!pkg) {
    const error = new Error('Package not found');
    error.status = 404;
    throw error;
  }

  const updateOps = [];
  const invalidListingIds = new Set();
  const issues = [];

  for (const item of pkg.items) {
    let status = WeddingPackageItemStatus.ok;
    const snapshot = item.serviceListing
      ? buildListingSnapshotFromEntity(item.serviceListing)
      : item.serviceListingSnapshot;
    const snapshotListingId = snapshot?.id || null;
    const listingKey = item.serviceListingId || snapshotListingId || null;

    if (!item.serviceListing && listingKey) {
      status = WeddingPackageItemStatus.missing_listing;
    } else if (item.serviceListing) {
      if (!item.serviceListing.isActive) {
        status = WeddingPackageItemStatus.listing_inactive;
      } else if (item.serviceListing.vendor?.user?.status !== 'active') {
        status =
          item.serviceListing.vendor?.user?.status === 'blocked'
            ? WeddingPackageItemStatus.vendor_blocked
            : WeddingPackageItemStatus.vendor_inactive;
      }
    }

    if (status !== WeddingPackageItemStatus.ok && listingKey) {
      invalidListingIds.add(listingKey);
      issues.push({
        itemId: item.id,
        label: item.label,
        status,
        serviceListingId: listingKey,
      });
    }

    if (item.healthStatus !== status || snapshot !== item.serviceListingSnapshot) {
      updateOps.push(
        prisma.weddingPackageItem.update({
          where: { id: item.id },
          data: {
            healthStatus: status,
            serviceListingSnapshot: snapshot,
          },
        })
      );
    }
  }

  if (updateOps.length > 0) {
    await prisma.$transaction(updateOps);
  }

  const targetStatus =
    issues.length > 0 && pkg.status !== WeddingPackageStatus.archived
      ? WeddingPackageStatus.needs_vendor_updates
      : pkg.status;

  const updatedPackage = await prisma.weddingPackage.update({
    where: { id: packageId },
    data: {
      invalidListingIds: Array.from(invalidListingIds),
      lastValidatedAt: new Date(),
      status: targetStatus,
    },
    include: PACKAGE_INCLUDE,
  });

  return {
    package: updatedPackage,
    issues,
  };
};

const flagPackagesForListing = async (prisma, listingId) => {
  const packages = await prisma.weddingPackage.findMany({
    where: {
      items: {
        some: { serviceListingId: listingId },
      },
    },
    select: { id: true, invalidListingIds: true, status: true },
  });

  if (!packages.length) return 0;

  await Promise.all(
    packages.map((pkg) => {
      const alreadyFlagged = pkg.invalidListingIds.includes(listingId);
      return prisma.weddingPackage.update({
        where: { id: pkg.id },
        data: {
          status:
            pkg.status === WeddingPackageStatus.archived
              ? WeddingPackageStatus.archived
              : WeddingPackageStatus.needs_vendor_updates,
          invalidListingIds: alreadyFlagged ? pkg.invalidListingIds : [...pkg.invalidListingIds, listingId],
        },
      });
    })
  );

  return packages.length;
};

const flagPackagesForVendor = async (prisma, vendorId) => {
  const listings = await prisma.serviceListing.findMany({
    where: { vendorId },
    select: { id: true },
  });

  if (!listings.length) return 0;

  const listingIds = listings.map((l) => l.id);
  const packages = await prisma.weddingPackage.findMany({
    where: {
      items: {
        some: {
          serviceListingId: { in: listingIds },
        },
      },
    },
    select: { id: true, invalidListingIds: true, status: true },
  });

  if (!packages.length) return 0;

  await Promise.all(
    packages.map((pkg) => {
      const mergedInvalids = Array.from(new Set([...pkg.invalidListingIds, ...listingIds]));
      return prisma.weddingPackage.update({
        where: { id: pkg.id },
        data: {
          status:
            pkg.status === WeddingPackageStatus.archived
              ? WeddingPackageStatus.archived
              : WeddingPackageStatus.needs_vendor_updates,
          invalidListingIds: mergedInvalids,
        },
      });
    })
  );

  return packages.length;
};

const revalidatePackagesForVendor = async (prisma, vendorId) => {
  const packages = await prisma.weddingPackage.findMany({
    where: {
      items: {
        some: {
          serviceListing: {
            vendorId,
          },
        },
      },
    },
    select: { id: true },
  });

  if (!packages.length) return 0;

  for (const pkg of packages) {
    await validatePackageHealth(prisma, pkg.id);
  }

  return packages.length;
};

const revalidatePackagesForListing = async (prisma, listingId) => {
  const packages = await prisma.weddingPackage.findMany({
    where: {
      items: {
        some: {
          serviceListingId: listingId,
        },
      },
    },
    select: { id: true },
  });

  if (!packages.length) return 0;

  for (const pkg of packages) {
    await validatePackageHealth(prisma, pkg.id);
  }

  return packages.length;
};

const ensurePackageDesign = async (prisma, packageId) => {
  const includeConfig = {
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
  };

  const existing = await prisma.packageDesign.findUnique({
    where: { packageId },
    include: includeConfig,
  });

  if (existing) {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const cameraPosition = await tx.coordinates.create({
      data: {
        id: prefixedUlid('cam'),
        x: 0,
        y: 3,
        z: 8,
      },
    });

    const created = await tx.packageDesign.create({
      data: {
        id: prefixedUlid('pkgd'),
        packageId,
        venueName: 'Template Venue',
        cameraPositionId: cameraPosition.id,
        layoutData: buildDefaultLayoutData(),
        zoomLevel: 1.2,
      },
    });

    return tx.packageDesign.findUnique({
      where: { id: created.id },
      include: includeConfig,
    });
  });
};

const applyPackageDesignToProject = async (prisma, packageId, projectId) => {
  const packageDesign = await ensurePackageDesign(prisma, packageId);

  if (!packageDesign) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const existingDesign = await tx.venueDesign.findUnique({
      where: { projectId },
      include: {
        placedElements: {
          select: {
            id: true,
            positionId: true,
          },
        },
      },
    });

    let cameraPositionId = existingDesign?.cameraPositionId || null;
    if (packageDesign.cameraPosition) {
      if (cameraPositionId) {
        await tx.coordinates.update({
          where: { id: cameraPositionId },
          data: {
            x: packageDesign.cameraPosition.x,
            y: packageDesign.cameraPosition.y,
            z: packageDesign.cameraPosition.z,
          },
        });
      } else {
        const cameraPosition = await tx.coordinates.create({
          data: {
            id: prefixedUlid('cam'),
            x: packageDesign.cameraPosition.x,
            y: packageDesign.cameraPosition.y,
            z: packageDesign.cameraPosition.z,
          },
        });
        cameraPositionId = cameraPosition.id;
      }
    } else if (cameraPositionId) {
      await tx.coordinates.delete({
        where: { id: cameraPositionId },
      });
      cameraPositionId = null;
    }

    const templateLayout = packageDesign.layoutData || buildDefaultLayoutData();
    const templateMeta = templateLayout.placementsMeta || {};
    const newMeta = {};

    // Fallback: some legacy templates may have placements but missing placementsMeta entries.
    // Rebuild per-placement metadata (serviceListingId + bundleId) from PackagePlacedElement.serviceListingId and ServiceComponent composition.
    const fallbackMetaByPackagePlacementId = {};
    try {
      const byListing = new Map();
      (packageDesign.placedElements || []).forEach((p) => {
        if (!p?.serviceListingId) return;
        if (!byListing.has(p.serviceListingId)) byListing.set(p.serviceListingId, []);
        byListing.get(p.serviceListingId).push(p);
      });

      const listingIds = Array.from(byListing.keys());
      if (listingIds.length) {
        const listings = await tx.serviceListing.findMany({
          where: { id: { in: listingIds } },
          select: {
            id: true,
            price: true,
            designElementId: true,
            components: {
              select: {
                designElementId: true,
                quantityPerUnit: true,
                role: true,
              },
            },
          },
        });
        const listingMap = new Map(listings.map((l) => [l.id, l]));

        for (const [serviceListingId, placements] of byListing.entries()) {
          const listing = listingMap.get(serviceListingId);
          if (!listing) continue;

          const requirements = [];
          if (listing.designElementId) {
            requirements.push({ designElementId: listing.designElementId, quantityPerUnit: 1, role: 'primary' });
          }
          (listing.components || []).forEach((c) => {
            if (!c.designElementId) return;
            requirements.push({
              designElementId: c.designElementId,
              quantityPerUnit: c.quantityPerUnit || 1,
              role: c.role || 'component',
            });
          });

          if (!requirements.length) continue;

          // Sort placements for deterministic grouping (PackagePlacedElement IDs are ULID-like in most flows).
          const placementsSorted = [...placements].sort((a, b) => String(a.id).localeCompare(String(b.id)));

          const placementsByElement = new Map();
          requirements.forEach((req) => {
            placementsByElement.set(
              req.designElementId,
              placementsSorted.filter((p) => p.designElementId === req.designElementId)
            );
          });

          let bundleCount = Infinity;
          for (const req of requirements) {
            const list = placementsByElement.get(req.designElementId) || [];
            const per = Math.max(1, Number(req.quantityPerUnit) || 1);
            bundleCount = Math.min(bundleCount, Math.floor(list.length / per));
          }
          if (!Number.isFinite(bundleCount) || bundleCount <= 0) {
            bundleCount = 1;
          }

          const bundleIds = Array.from({ length: bundleCount }, () => prefixedUlid('bnd'));

          // Assign bundle IDs per component in order, chunked by quantityPerUnit.
          for (const req of requirements) {
            const list = placementsByElement.get(req.designElementId) || [];
            const per = Math.max(1, Number(req.quantityPerUnit) || 1);
            let index = 0;
            for (let bi = 0; bi < bundleCount; bi += 1) {
              const bid = bundleIds[bi];
              for (let k = 0; k < per && index < list.length; k += 1) {
                const placement = list[index++];
                const existing = templateMeta[placement.id] || null;
                if (existing && existing.bundleId && existing.serviceListingId) {
                  continue;
                }
                fallbackMetaByPackagePlacementId[placement.id] = {
                  ...(existing || {}),
                  serviceListingId,
                  bundleId: bid,
                  role: req.role,
                  unitPrice: listing.price ? listing.price.toString() : null,
                };
              }
            }

            // Any leftovers get attached to the last bundle.
            const lastBid = bundleIds[bundleIds.length - 1];
            while (index < list.length) {
              const placement = list[index++];
              const existing = templateMeta[placement.id] || null;
              if (existing && existing.bundleId && existing.serviceListingId) {
                continue;
              }
              fallbackMetaByPackagePlacementId[placement.id] = {
                ...(existing || {}),
                serviceListingId,
                bundleId: lastBid,
                role: req.role,
                unitPrice: listing.price ? listing.price.toString() : null,
              };
            }
          }
        }
      }
    } catch {
      // Best-effort fallback only; ignore failures.
    }

    let venueDesign = existingDesign;
    if (venueDesign) {
      const placementIds = venueDesign.placedElements.map((placement) => placement.id);
      const positionIds = venueDesign.placedElements.map((placement) => placement.positionId);

      if (placementIds.length) {
        await tx.placedElement.deleteMany({
          where: { id: { in: placementIds } },
        });
      }

      if (positionIds.length) {
        await tx.coordinates.deleteMany({
          where: { id: { in: positionIds } },
        });
      }

      venueDesign = await tx.venueDesign.update({
        where: { id: venueDesign.id },
        data: {
          venueName: packageDesign.venueName || venueDesign.venueName,
          layoutData: buildDefaultLayoutData(),
          cameraPositionId,
          zoomLevel: packageDesign.zoomLevel || venueDesign.zoomLevel || 1.2,
        },
      });
    } else {
      venueDesign = await tx.venueDesign.create({
        data: {
          id: prefixedUlid('vnd'),
          projectId,
          venueName: packageDesign.venueName || 'Template Venue',
          layoutData: buildDefaultLayoutData(),
          cameraPositionId,
          zoomLevel: packageDesign.zoomLevel || 1.2,
        },
      });
    }

    for (const placement of packageDesign.placedElements) {
      const positionRecord = await tx.coordinates.create({
        data: {
          id: prefixedUlid('pos'),
          x: placement.position?.x ?? 0,
          y: placement.position?.y ?? 0,
          z: placement.position?.z ?? 0,
        },
      });

      const createdPlacement = await tx.placedElement.create({
        data: {
          id: prefixedUlid('ple'),
          venueDesignId: venueDesign.id,
          designElementId: placement.designElementId,
          positionId: positionRecord.id,
          rotation: placement.rotation ?? 0,
          isLocked: placement.isLocked ?? false,
        },
      });

      const meta = templateMeta[placement.id] || fallbackMetaByPackagePlacementId[placement.id] || null;
      if (meta) {
        newMeta[createdPlacement.id] = meta;
      }
    }

    await tx.venueDesign.update({
      where: { id: venueDesign.id },
      data: {
        layoutData: {
          ...templateLayout,
          placementsMeta: newMeta,
          lastSavedAt: new Date().toISOString(),
        },
      },
    });
  });

  // Ensure budget "planned (3D)" reflects the newly applied template placements.
  // updatePlannedSpend is exported from venueDesign.routes and is used elsewhere (e.g., project routes).
  try {
    const venueDesignRoutes = require('../routes/venueDesign.routes');
    if (venueDesignRoutes.updatePlannedSpend) {
      await venueDesignRoutes.updatePlannedSpend(projectId);
    }
  } catch {
    // Best-effort only; template can still load even if planned spend refresh fails.
  }
};

module.exports = {
  PACKAGE_INCLUDE,
  buildPackageResponse,
  getListingSnapshot,
  validatePackageHealth,
  flagPackagesForListing,
  flagPackagesForVendor,
  revalidatePackagesForVendor,
  revalidatePackagesForListing,
  buildDefaultLayoutData,
  ensurePackageDesign,
  applyPackageDesignToProject,
};

