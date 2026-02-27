'use strict';

const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');

const { requireAuth } = require('../middleware/auth');
const { prefixedUlid } = require('../utils/id');
const { calculatePrice, calculateEventDuration } = require('../utils/pricingCalculator');

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
    // parentElementId is a PlacedElement ID, which is a ULID (e.g., "ple_01KBSEGMKNM3TWK9VWNHYWRKJ6"), not a UUID
    parentElementId: z.string().min(1).nullable().optional(),
    metadata: z
      .object({
        role: z.string().max(50).nullable().optional(),
        quantityIndex: z.number().int().nullable().optional(),
      })
      .optional(),
  })
  .refine(
    (data) => data.position || data.rotation !== undefined || data.isLocked !== undefined || data.parentElementId !== undefined || data.metadata,
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
  layoutData: z.any().optional(),
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
  parentElement: {
    select: {
      id: true,
      position: true,
    },
  },
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
  const position = placement?.position;
  const safePosition = {
    x: typeof position?.x === 'number' ? position.x : 0,
    y: typeof position?.y === 'number' ? position.y : 0,
    z: typeof position?.z === 'number' ? position.z : 0,
  };
  const service =
    meta && meta.serviceListingId ? serviceMap[meta.serviceListingId] ?? null : null;

  return {
    id: placement.id,
    rotation: placement.rotation ?? 0,
    isLocked: placement.isLocked,
    parentElementId: placement.parentElementId || null, // Include parent element ID for parent-child relationships
    position: {
      x: safePosition.x,
      y: safePosition.y,
      z: safePosition.z,
    },
    serviceListingIds: placement.serviceListingIds || [], // Include service listing IDs for table tagging
    elementType: placement.elementType || null, // Include element type
    isBooked: placement.isBooked || false, // Include booking status
    bookingId: placement.bookingId || null, // Include booking ID if booked
    designElement: placement.designElement
      ? {
          id: placement.designElement.id,
          name: placement.designElement.name,
          modelFile: placement.designElement.modelFile,
          vendorId: placement.designElement.vendorId,
          isStackable: placement.designElement.isStackable,
          dimensions: placement.designElement.dimensions,
          elementType: placement.designElement.elementType || null, // Include element type from design element
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
      projectServices: {
        include: {
          serviceListing: {
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
      budget: true, // Include budget so frontend can access totalBudget
    },
  });
}

/**
 * Helper function to check if a project can be modified
 * Projects with 'completed' status or past their wedding date cannot be modified
 * Throws an error with statusCode if project is completed/past wedding date or not found
 */
async function checkProjectCanBeModified(projectId, coupleId) {
  const project = await prisma.weddingProject.findFirst({
    where: {
      id: projectId,
      coupleId,
    },
    select: {
      id: true,
      status: true,
      weddingDate: true,
    },
  });

  if (!project) {
    const error = new Error('Project not found');
    error.statusCode = 404;
    throw error;
  }

  if (project.status === 'completed') {
    const error = new Error('Completed projects cannot be modified');
    error.statusCode = 403;
    throw error;
  }

  if (project.weddingDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weddingDate = new Date(project.weddingDate);
    weddingDate.setHours(0, 0, 0, 0);

    if (weddingDate < today) {
      const error = new Error('Projects past their wedding date cannot be modified');
      error.statusCode = 403;
      throw error;
    }
  }

  return project;
}

/**
 * Helper function to calculate and update planned spend from 3D design
 * This calculates the total cost of all non-booked placements in the venue design
 */
// Export updatePlannedSpend so it can be used by other route files
async function updatePlannedSpend(projectId) {
  try {
    const project = await prisma.weddingProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        venueServiceListingId: true,
        weddingDate: true,
        eventStartTime: true,
        eventEndTime: true,
        budget: true,
        venueDesign: {
          include: {
            placedElements: {
              // Include ALL placements regardless of booking status
              // Planned (3D) should show total cost of all services in the design
              select: {
                id: true,
                serviceListingIds: true, // For per-table services
              },
            },
          },
        },
      },
    });

    if (!project || !project.budget) {
      return; // No budget to update
    }

    if (!project.venueDesign) {
      // No venue design, set plannedSpend to 0
      await prisma.budget.update({
        where: { id: project.budget.id },
        data: {
          plannedSpend: 0,
          totalRemaining: parseFloat(project.budget.totalBudget) - parseFloat(project.budget.totalSpent) - 0,
        },
      });
      return;
    }

    // Calculate planned spend using the same logic as checkout summary
    const layoutData = project.venueDesign.layoutData || {};
    const placementsMeta = layoutData.placementsMeta || {};

    // Get all service listing IDs from placements and project services
    const serviceListingIds = new Set();
    project.venueDesign.placedElements.forEach((placement) => {
      const meta = placementsMeta[placement.id];
      if (meta?.serviceListingId) {
        serviceListingIds.add(meta.serviceListingId);
      }
    });

    // Get project services
    const projectServices = await prisma.projectService.findMany({
      where: { projectId: project.id },
      include: {
        serviceListing: {
          select: {
            id: true,
            price: true,
            pricingPolicy: true,
            hourlyRate: true,
          },
        },
      },
    });

    projectServices.forEach((ps) => {
      if (ps.serviceListingId) {
        serviceListingIds.add(ps.serviceListingId);
      }
    });

    // Include venue ALWAYS (planned (3D) should show all services regardless of booking status)
    if (project.venueServiceListingId) {
      serviceListingIds.add(project.venueServiceListingId);
    }

    // Get all service listings
    const serviceListings = await prisma.serviceListing.findMany({
      where: { id: { in: Array.from(serviceListingIds) } },
      select: {
        id: true,
        price: true,
        pricingPolicy: true,
        hourlyRate: true,
      },
    });

    const serviceListingMap = {};
    serviceListings.forEach((listing) => {
      serviceListingMap[listing.id] = listing;
    });

    // Calculate design quantities per service listing (matching checkout summary)
    const designQuantities = {};
    const bundleTracker = new Map(); // Track bundles to avoid double-counting

    // Count 3D placements
    project.venueDesign.placedElements.forEach((placement) => {
      const meta = placementsMeta[placement.id];
      if (!meta?.serviceListingId) return;

      const bundleId = meta.bundleId;
      if (bundleId) {
        // For bundles, count once per bundle
        if (!bundleTracker.has(bundleId)) {
          bundleTracker.set(bundleId, true);
          if (!designQuantities[meta.serviceListingId]) {
            designQuantities[meta.serviceListingId] = 0;
          }
          designQuantities[meta.serviceListingId] += 1;
        }
      } else {
        // Individual placement
        if (!designQuantities[meta.serviceListingId]) {
          designQuantities[meta.serviceListingId] = 0;
        }
        designQuantities[meta.serviceListingId] += 1;
      }
    });

    // Count per-table services from table tagging (serviceListingIds on placements)
    // This matches checkout summary logic - per-table services come from table tagging, not projectServices
    project.venueDesign.placedElements.forEach((placement) => {
      if (placement.serviceListingIds && Array.isArray(placement.serviceListingIds)) {
        placement.serviceListingIds.forEach((serviceListingId) => {
          if (!designQuantities[serviceListingId]) {
            designQuantities[serviceListingId] = 0;
          }
          designQuantities[serviceListingId] += 1;
        });
      }
    });

    // Count non-3D project services (excluding per-table services to avoid double-counting)
    // Matching checkout summary logic
    for (const ps of projectServices) {
      if (!ps.serviceListingId) continue;
      const listing = serviceListingMap[ps.serviceListingId];
      if (!listing) continue;

      // Skip per-table services (they're already counted via table tagging above)
      if (listing.pricingPolicy === 'per_table') {
        continue;
      }

      // For other services, use ProjectService quantity
      if (!designQuantities[ps.serviceListingId]) {
        designQuantities[ps.serviceListingId] = 0;
      }
      designQuantities[ps.serviceListingId] += ps.quantity || 1;
    }

    // Include venue ALWAYS in designQuantities (planned (3D) shows all services regardless of booking)
    if (project.venueServiceListingId) {
      designQuantities[project.venueServiceListingId] = 1;
    }

    // Calculate event duration for time_based pricing
    let eventDuration = null;
    if (project.eventStartTime && project.eventEndTime) {
      try {
        eventDuration = calculateEventDuration(project.eventStartTime, project.eventEndTime);
      } catch (err) {
        console.warn('[updatePlannedSpend] Failed to calculate event duration:', err.message);
      }
    }

    // Calculate total using calculatePrice (matching checkout summary)
    let totalPlannedSpend = 0;
    Object.entries(designQuantities).forEach(([serviceListingId, designQuantity]) => {
      const listing = serviceListingMap[serviceListingId];
      if (!listing || designQuantity <= 0) return;

      try {
        const pricingContext = {};
        
        if (listing.pricingPolicy === 'per_unit') {
          pricingContext.quantity = designQuantity;
        } else if (listing.pricingPolicy === 'per_table') {
          pricingContext.tableCount = designQuantity;
        } else if (listing.pricingPolicy === 'time_based') {
          if (eventDuration !== null) {
            pricingContext.eventDuration = eventDuration;
          } else {
            // Skip time_based services if event duration is not available
            return;
          }
        }
        // fixed_package doesn't need context

        const calculatedPrice = calculatePrice(listing, pricingContext);
        totalPlannedSpend += parseFloat(calculatedPrice.toString());
      } catch (err) {
        console.warn(`[updatePlannedSpend] Failed to calculate price for ${listing.id}:`, err.message);
        // Fallback to base price * quantity for per_unit/per_table, or base price for others
        const basePrice = parseFloat(listing.price?.toString() || '0');
        if (listing.pricingPolicy === 'per_unit' || listing.pricingPolicy === 'per_table') {
          totalPlannedSpend += basePrice * designQuantity;
        } else {
          totalPlannedSpend += basePrice;
        }
      }
    });

    // plannedSpend includes ALL services in the 3D venue design regardless of booking status
    // This represents the total planned cost, not what's available to book
    const plannedSpend = Math.max(0, totalPlannedSpend);

    // Update budget
    await prisma.budget.update({
      where: { id: project.budget.id },
      data: {
        plannedSpend: plannedSpend,
        totalRemaining: parseFloat(project.budget.totalBudget) - parseFloat(project.budget.totalSpent) - plannedSpend,
      },
    });
  } catch (error) {
    console.error('Error updating planned spend:', error);
    // Don't throw - this is a background update
  }
}

/**
 * Handle expenses for per-table services when tables are tagged/untagged
 * Creates, updates, or deletes expenses automatically
 */
async function handlePerTableServiceExpenses(projectId, serviceListingIds, placedElementIds, action) {
  try {
    // Get budget for this project
    const budget = await prisma.budget.findUnique({
      where: { projectId },
      include: {
        categories: true,
      },
    });

    if (!budget) {
      return; // No budget, skip expense management
    }

    // Get service listings to check if they're per-table services
    const serviceListings = await prisma.serviceListing.findMany({
      where: {
        id: { in: serviceListingIds },
        pricingPolicy: 'per_table',
      },
      select: {
        id: true,
        name: true,
        price: true,
      },
    });

    if (serviceListings.length === 0) {
      return; // No per-table services, nothing to do
    }

    // Get or create a default category for 3D design services
    let defaultCategory = budget.categories.find(cat => 
      cat.categoryName.toLowerCase().includes('3d') || 
      cat.categoryName.toLowerCase().includes('venue design')
    );

    if (!defaultCategory) {
      // Create a default category for 3D design services
      defaultCategory = await prisma.budgetCategory.create({
        data: {
          budgetId: budget.id,
          categoryName: '3D Venue Design Services',
        },
      });
    }

    // Get ALL placements in the venue design to count how many tables are tagged for each service
    const venueDesign = await prisma.venueDesign.findUnique({
      where: { projectId },
      select: { id: true },
    });

    if (!venueDesign) {
      return; // No venue design, skip
    }

    const allPlacements = await prisma.placedElement.findMany({
      where: {
        venueDesignId: venueDesign.id,
        elementType: 'table', // Only count tables
      },
      select: {
        id: true,
        serviceListingIds: true,
      },
    });

    for (const serviceListing of serviceListings) {
      // Count how many tables are currently tagged with this service (across all tables)
      const taggedTableCount = allPlacements.filter(p => 
        p.serviceListingIds && p.serviceListingIds.includes(serviceListing.id)
      ).length;

      // Skip if no tables are tagged (shouldn't happen, but safety check)
      if (taggedTableCount === 0 && action === 'tag') {
        console.warn(`No tables tagged for service ${serviceListing.id}, skipping expense creation`);
        continue;
      }

      if (action === 'tag') {
        // Find or create expense for this per-table service
        const existingExpense = await prisma.expense.findFirst({
          where: {
            categoryId: defaultCategory.id,
            serviceListingId: serviceListing.id,
            from3DDesign: true,
            // Per-table services don't have placedElementId, they're tracked by serviceListingId
          },
        });

        const servicePrice = parseFloat(serviceListing.price || 0);
        const costPerTable = servicePrice;
        const totalCost = costPerTable * taggedTableCount;

        // Validate that we have valid cost and count
        if (isNaN(totalCost) || totalCost <= 0) {
          console.error(`Invalid cost calculation for service ${serviceListing.id}: price=${servicePrice}, count=${taggedTableCount}, total=${totalCost}`);
          continue;
        }

        if (existingExpense) {
          // Update existing expense with new quantity and cost
          const nameMatch = existingExpense.expenseName.match(/^(.+?)(\s*\((\d+)\s+tables?\))?$/i);
          const baseName = nameMatch ? nameMatch[1] : existingExpense.expenseName;
          const updatedName = taggedTableCount > 1 
            ? `${baseName} (${taggedTableCount} tables)` 
            : baseName;

          await prisma.expense.update({
            where: { id: existingExpense.id },
            data: {
              expenseName: updatedName,
              estimatedCost: totalCost,
              // Don't update actualCost automatically
            },
          });

          // Update budget: adjust plannedSpend
          const costChange = totalCost - parseFloat(existingExpense.estimatedCost || 0);
          if (costChange !== 0) {
            await prisma.budget.update({
              where: { id: budget.id },
              data: {
                plannedSpend: { increment: costChange },
              },
            });
          }
        } else {
          // Create new expense with proper cost and quantity
          const expenseName = taggedTableCount > 1 
            ? `${serviceListing.name} (${taggedTableCount} tables)` 
            : serviceListing.name;
          
          console.log(`Creating expense for per-table service: ${expenseName}, cost: ${totalCost}, count: ${taggedTableCount}`);
          
          await prisma.expense.create({
            data: {
              categoryId: defaultCategory.id,
              expenseName: expenseName,
              estimatedCost: totalCost,
              from3DDesign: true,
              serviceListingId: serviceListing.id,
              // Per-table services don't have placedElementId
            },
          });

          // Update budget: add to plannedSpend
          await prisma.budget.update({
            where: { id: budget.id },
            data: {
              plannedSpend: { increment: totalCost },
            },
          });
        }
      } else if (action === 'untag') {
        // Find expense for this service
        const existingExpense = await prisma.expense.findFirst({
          where: {
            categoryId: defaultCategory.id,
            serviceListingId: serviceListing.id,
            from3DDesign: true,
          },
        });

        if (existingExpense) {
          if (taggedTableCount === 0) {
            // No tables tagged anymore → delete expense
            const expenseCost = parseFloat(existingExpense.estimatedCost || 0);
            const expenseActualCost = existingExpense.actualCost ? parseFloat(existingExpense.actualCost) : 0;

            await prisma.expense.delete({
              where: { id: existingExpense.id },
            });

            // Update budget: remove from plannedSpend and totalSpent
            await prisma.budget.update({
              where: { id: budget.id },
              data: {
                plannedSpend: { increment: expenseCost },
                totalSpent: expenseActualCost > 0 ? { decrement: expenseActualCost } : undefined,
              },
            });
          } else {
            // Some tables still tagged → update quantity and cost
            const servicePrice = parseFloat(serviceListing.price || 0);
            const newTotalCost = servicePrice * taggedTableCount;
            const oldCost = parseFloat(existingExpense.estimatedCost || 0);

            const nameMatch = existingExpense.expenseName.match(/^(.+?)(\s*\((\d+)\s+tables?\))?$/i);
            const baseName = nameMatch ? nameMatch[1] : existingExpense.expenseName;
            const updatedName = taggedTableCount > 1 
              ? `${baseName} (${taggedTableCount} tables)` 
              : baseName;

            await prisma.expense.update({
              where: { id: existingExpense.id },
              data: {
                expenseName: updatedName,
                estimatedCost: newTotalCost,
              },
            });

            // Update budget: adjust plannedSpend
            const costChange = newTotalCost - oldCost;
            if (costChange !== 0) {
              await prisma.budget.update({
                where: { id: budget.id },
                data: {
                  plannedSpend: { increment: costChange },
                },
              });
            }
          }
        }
      }
    }

    // Recalculate budget totals manually
    const categories = await prisma.budgetCategory.findMany({
      where: { budgetId: budget.id },
      include: { expenses: true },
    });

    let totalSpent = 0;
    categories.forEach(category => {
      category.expenses.forEach(expense => {
        if (expense.actualCost) {
          totalSpent += parseFloat(expense.actualCost);
        }
      });
    });

    const currentBudget = await prisma.budget.findUnique({
      where: { id: budget.id },
    });

    await prisma.budget.update({
      where: { id: budget.id },
      data: {
        totalSpent: totalSpent,
        totalRemaining: parseFloat(currentBudget.totalBudget) - totalSpent - parseFloat(currentBudget.plannedSpend || 0),
      },
    });
  } catch (error) {
    console.error('Error handling per-table service expenses:', error);
    // Don't throw - this is a background operation
  }
}

/**
 * Update per-table service expenses when tables are tagged/untagged
 * This ensures expenses that were already moved to categories stay in sync with the actual tagged table count
 */
async function updatePerTableServiceExpenses(projectId, serviceListingIds) {
  try {
    // Get budget for this project
    const budget = await prisma.budget.findUnique({
      where: { projectId },
      include: {
        categories: {
          include: {
            expenses: {
              where: {
                from3DDesign: true,
                serviceListingId: { in: serviceListingIds },
                placedElementId: null, // Per-table services have null placedElementId
              },
            },
          },
        },
      },
    });

    if (!budget) {
      return; // No budget, nothing to update
    }

    // Get venue design to count currently tagged tables
    const venueDesign = await prisma.venueDesign.findUnique({
      where: { projectId },
      include: {
        placedElements: {
          where: {
            elementType: 'table',
            // Or check designElement.elementType === 'table'
          },
          include: {
            designElement: {
              select: {
                elementType: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!venueDesign) {
      return; // No venue design, nothing to update
    }

    // Count tables tagged with each service
    const taggedTableCounts = new Map(); // serviceListingId -> count
    
    venueDesign.placedElements.forEach(placement => {
      // Check if this is a table
      const isTable = placement.elementType === 'table' ||
                     placement.designElement?.elementType === 'table' ||
                     (placement.designElement?.name && placement.designElement.name.toLowerCase().includes('table'));
      
      if (isTable && placement.serviceListingIds && Array.isArray(placement.serviceListingIds)) {
        placement.serviceListingIds.forEach(serviceListingId => {
          if (serviceListingIds.includes(serviceListingId)) {
            const currentCount = taggedTableCounts.get(serviceListingId) || 0;
            taggedTableCounts.set(serviceListingId, currentCount + 1);
          }
        });
      }
    });

    // Update expenses for each per-table service
    for (const serviceListingId of serviceListingIds) {
      const taggedTableCount = taggedTableCounts.get(serviceListingId) || 0;
      
      // Find all expenses for this per-table service across all categories
      const expenses = [];
      budget.categories.forEach(category => {
        category.expenses.forEach(expense => {
          if (expense.serviceListingId === serviceListingId && 
              expense.from3DDesign && 
              expense.placedElementId === null) {
            expenses.push({ ...expense, categoryId: category.id });
          }
        });
      });

      // Get service listing to get price
      const serviceListing = await prisma.serviceListing.findUnique({
        where: { id: serviceListingId },
        select: { price: true, name: true },
      });

      if (!serviceListing) {
        continue; // Service not found, skip
      }

      const unitPrice = parseFloat(serviceListing.price || 0);
      const newTotalCost = unitPrice * taggedTableCount;

      // Update each expense
      for (const expense of expenses) {
        if (taggedTableCount === 0) {
          // No tables tagged → delete expense
          const expenseCost = parseFloat(expense.estimatedCost || 0);
          const expenseActualCost = expense.actualCost ? parseFloat(expense.actualCost) : 0;

          await prisma.expense.delete({
            where: { id: expense.id },
          });

          // Update budget: when expense is deleted, add cost back to plannedSpend
          // and remove from totalSpent if it had actual cost
          await prisma.budget.update({
            where: { id: budget.id },
            data: {
              plannedSpend: { increment: expenseCost }, // Add back to planned (no longer an expense)
              totalSpent: expenseActualCost > 0 ? { decrement: expenseActualCost } : undefined,
            },
          });
        } else {
          // Some tables still tagged → update quantity and cost
          const oldCost = parseFloat(expense.estimatedCost || 0);
          
          // Update expense name to reflect quantity
          const nameMatch = expense.expenseName.match(/^(.+?)(\s*\((\d+)\))?$/);
          const baseName = nameMatch ? nameMatch[1] : expense.expenseName;
          const updatedName = taggedTableCount > 1 
            ? `${baseName} (${taggedTableCount})` 
            : baseName;

          await prisma.expense.update({
            where: { id: expense.id },
            data: {
              expenseName: updatedName,
              estimatedCost: newTotalCost,
              // Note: actualCost is not updated here - it's managed via payments
            },
          });

          // Update budget: adjust plannedSpend
          // When expense cost increases (more tables), we decrease plannedSpend (more moved to expenses)
          // When expense cost decreases (fewer tables), we increase plannedSpend (less in expenses, back to planned)
          const costChange = newTotalCost - oldCost;
          if (costChange !== 0) {
            await prisma.budget.update({
              where: { id: budget.id },
              data: {
                plannedSpend: { increment: -costChange }, // Negative: if cost increases, plannedSpend decreases
              },
            });
          }
        }
      }
    }

    // Recalculate budget totals
    const updatedCategories = await prisma.budgetCategory.findMany({
      where: { budgetId: budget.id },
      include: { expenses: true },
    });

    let totalSpent = 0;
    updatedCategories.forEach(category => {
      category.expenses.forEach(expense => {
        if (expense.actualCost) {
          totalSpent += parseFloat(expense.actualCost);
        }
      });
    });

    const currentBudget = await prisma.budget.findUnique({
      where: { id: budget.id },
    });

    await prisma.budget.update({
      where: { id: budget.id },
      data: {
        totalSpent: totalSpent,
        totalRemaining: parseFloat(currentBudget.totalBudget) - totalSpent - parseFloat(currentBudget.plannedSpend || 0),
      },
    });
  } catch (error) {
    console.error('Error updating per-table service expenses:', error);
    // Don't throw - this is a background operation
  }
}

async function checkServiceAvailabilityForDate(serviceListingId, isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

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
          notIn: ['cancelled_by_couple', 'cancelled_by_vendor', 'rejected'],
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
          notIn: ['cancelled_by_couple', 'cancelled_by_vendor', 'rejected'],
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
    pricingPolicy: listing.pricingPolicy,
    hourlyRate: listing.hourlyRate ? listing.hourlyRate.toString() : null,
    isActive: listing.isActive,
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

    // Get service listing IDs from placementsMeta (for regular placements)
    const serviceListingIdsFromMeta = [
      ...new Set(
        Object.values(placementsMeta)
          .map((meta) => meta?.serviceListingId)
          .filter(Boolean)
      ),
    ];

    // Also get service listing IDs from serviceListingIds arrays on placements (for per-table services)
    const serviceListingIdsFromPlacements = [
      ...new Set(
        venueDesign.placedElements
          .flatMap((placement) => placement.serviceListingIds || [])
          .filter(Boolean)
      ),
    ];

    // Combine all service listing IDs
    const allServiceListingIds = [
      ...new Set([...serviceListingIdsFromMeta, ...serviceListingIdsFromPlacements]),
    ];

    let serviceListings = [];
    if (allServiceListingIds.length > 0) {
      serviceListings = await prisma.serviceListing.findMany({
        where: { id: { in: allServiceListingIds } },
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

    const bookingIds = [
      ...new Set(
        (placements || [])
          .map((p) => p?.bookingId)
          .filter(Boolean)
      ),
    ];

    let bookingStatusMap = {};
    if (bookingIds.length > 0) {
      const bookingsForPlacements = await prisma.booking.findMany({
        where: { id: { in: bookingIds } },
        select: { id: true, status: true },
      });
      bookingStatusMap = bookingsForPlacements.reduce((acc, b) => {
        acc[b.id] = b.status;
        return acc;
      }, {});
    }

    let placementsWithBookingStatus = (placements || []).map((p) => ({
      ...p,
      bookingStatus: p.bookingId ? bookingStatusMap[p.bookingId] || null : null,
    }));

    const venueListing = project.venueServiceListing;

    // Check if venue has an active booking
    let venueBookingStatus = null;
    if (venueListing && project.weddingDate) {
      const weddingDate = project.weddingDate instanceof Date ? project.weddingDate : new Date(project.weddingDate);
      const startOfDay = new Date(weddingDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(weddingDate);
      endOfDay.setHours(23, 59, 59, 999);

      const venueBooking = await prisma.booking.findFirst({
        where: {
          projectId: project.id,
          reservedDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: {
            notIn: ['cancelled_by_couple', 'cancelled_by_vendor', 'rejected'],
          },
          selectedServices: {
            some: {
              serviceListingId: venueListing.id,
            },
          },
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (venueBooking) {
        venueBookingStatus = {
          isBooked: true,
          bookingId: venueBooking.id,
          status: venueBooking.status,
        };
      }
    }

// (vendor-preview route is declared after the couple-only GET /:projectId handler)

    const projectServices = (project.projectServices || []).map((ps) => ({
      id: ps.id,
      projectId: ps.projectId,
      serviceListingId: ps.serviceListingId,
      quantity: ps.quantity,
      isBooked: ps.isBooked,
      bookingId: ps.bookingId,
      serviceListing: ps.serviceListing
        ? {
            id: ps.serviceListing.id,
            name: ps.serviceListing.name,
            category: ps.serviceListing.category,
            price: ps.serviceListing.price?.toString() ?? null,
            pricingPolicy: ps.serviceListing.pricingPolicy,
            isActive: ps.serviceListing.isActive,
            has3DModel: ps.serviceListing.has3DModel || false, // Include has3DModel flag
            images: ps.serviceListing.images || [],
            vendor: ps.serviceListing.vendor
              ? {
                  id: ps.serviceListing.vendor.userId,
                  name: ps.serviceListing.vendor.user?.name ?? null,
                  email: ps.serviceListing.vendor.user?.email ?? null,
                }
              : null,
          }
        : null,
    }));

    // Get booked quantities for all services in this project (for checkout quantity adjustment)
    const bookedQuantities = {};
    // Get BookedTable records to track which specific tables are booked for per-table services
    const bookedTablesMap = {}; // Map: serviceListingId -> Set of placedElementIds
    if (project.weddingDate) {
      const weddingDate = project.weddingDate instanceof Date ? project.weddingDate : new Date(project.weddingDate);
      const startOfDay = new Date(weddingDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(weddingDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all active bookings for this project and date
      const activeBookings = await prisma.booking.findMany({
        where: {
          projectId: project.id,
          reservedDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: {
            notIn: ['cancelled_by_couple', 'cancelled_by_vendor', 'rejected'],
          },
        },
        select: {
          id: true,
          status: true,
          selectedServices: {
            select: {
              serviceListingId: true,
              quantity: true,
            },
          },
        },
      });

      // Calculate total booked quantity per service listing
      activeBookings.forEach((booking) => {
        booking.selectedServices.forEach((service) => {
          const serviceId = service.serviceListingId;
          if (!bookedQuantities[serviceId]) {
            bookedQuantities[serviceId] = 0;
          }
          bookedQuantities[serviceId] += service.quantity || 0;
        });
      });

      // Get BookedTable records for per-table services
      const bookedTableRecords = await prisma.bookedTable.findMany({
        where: {
          booking: {
            projectId: project.id,
            reservedDate: {
              gte: startOfDay,
              lte: endOfDay,
            },
            status: {
              notIn: ['cancelled_by_couple', 'cancelled_by_vendor', 'rejected'],
            },
          },
        },
        select: {
          bookingId: true,
          serviceListingId: true,
          placedElementId: true,
        },
      });

      // Service-level booking map (covers services that have multiple 3D placements).
      // selectedServices records are at the serviceListing level, so we color ALL placements belonging to that service.
      const serviceBookingMap = {};
      activeBookings.forEach((booking) => {
        (booking.selectedServices || []).forEach((service) => {
          if (!service?.serviceListingId) return;
          // Prefer the "most advanced" booking we see (rough heuristic); in practice there should be only one active booking per listing.
          const existing = serviceBookingMap[service.serviceListingId];
          if (!existing) {
            serviceBookingMap[service.serviceListingId] = { bookingId: booking.id, bookingStatus: booking.status };
          } else {
            serviceBookingMap[service.serviceListingId] = { bookingId: booking.id, bookingStatus: booking.status };
          }
        });
      });

      // Fill bookingStatus for per-table placements using BookedTable -> booking.status
      const bookingStatusById = activeBookings.reduce((acc, booking) => {
        acc[booking.id] = booking.status;
        return acc;
      }, {});

      const tablePlacementBookingMap = bookedTableRecords.reduce((acc, bt) => {
        acc[bt.placedElementId] = {
          bookingId: bt.bookingId,
          bookingStatus: bookingStatusById[bt.bookingId] || null,
        };
        return acc;
      }, {});

      placementsWithBookingStatus = placementsWithBookingStatus.map((p) => {
        if (p.bookingStatus) return p;
        const mapped = tablePlacementBookingMap[p.id];
        if (!mapped) return p;
        return {
          ...p,
          bookingId: p.bookingId || mapped.bookingId,
          bookingStatus: mapped.bookingStatus,
        };
      });

      // Fill bookingStatus for multi-placement services using serviceListingId membership.
      placementsWithBookingStatus = placementsWithBookingStatus.map((p) => {
        if (p.bookingStatus) return p;
        const serviceListingId = p?.metadata?.serviceListingId || p?.serviceListing?.id || null;
        if (!serviceListingId) return p;
        const mapped = serviceBookingMap[serviceListingId];
        if (!mapped) return p;
        return {
          ...p,
          bookingId: p.bookingId || mapped.bookingId,
          bookingStatus: mapped.bookingStatus,
        };
      });

      // Build map: serviceListingId -> Set of placedElementIds
      bookedTableRecords.forEach((bt) => {
        if (!bookedTablesMap[bt.serviceListingId]) {
          bookedTablesMap[bt.serviceListingId] = new Set();
        }
        bookedTablesMap[bt.serviceListingId].add(bt.placedElementId);
      });
    }

    // Convert bookedTablesMap Sets to arrays for JSON serialization
    const bookedTables = {};
    Object.keys(bookedTablesMap).forEach((serviceId) => {
      bookedTables[serviceId] = Array.from(bookedTablesMap[serviceId]);
    });

    // Fetch budget directly from database to ensure we get the latest totalSpent value
    let budgetData = null;
    if (project.budget) {
      budgetData = await prisma.budget.findUnique({
        where: { id: project.budget.id },
      });
    }

    return res.json({
      project: {
        id: project.id,
        name: project.projectName,
        weddingDate:
          project.weddingDate instanceof Date
            ? project.weddingDate.toISOString()
            : project.weddingDate,
        eventStartTime: project.eventStartTime || null,
        eventEndTime: project.eventEndTime || null,
        budget: budgetData ? (() => {
          // Prisma Decimal objects need explicit toString() call
          const totalSpentRaw = budgetData.totalSpent;
          const totalSpentStr = totalSpentRaw != null 
            ? (typeof totalSpentRaw.toString === 'function' ? totalSpentRaw.toString() : String(totalSpentRaw))
            : '0';
          
          const budgetObj = {
            id: budgetData.id,
            totalBudget: budgetData.totalBudget != null 
              ? (typeof budgetData.totalBudget.toString === 'function' ? budgetData.totalBudget.toString() : String(budgetData.totalBudget))
              : '0',
            totalSpent: totalSpentStr,
            plannedSpend: budgetData.plannedSpend != null 
              ? (typeof budgetData.plannedSpend.toString === 'function' ? budgetData.plannedSpend.toString() : String(budgetData.plannedSpend))
              : '0',
            totalRemaining: budgetData.totalRemaining != null 
              ? (typeof budgetData.totalRemaining.toString === 'function' ? budgetData.totalRemaining.toString() : String(budgetData.totalRemaining))
              : '0',
          };
          return budgetObj;
        })() : null,
      },
      bookedQuantities, // Include booked quantities for checkout adjustment
      bookedTables, // Include booked table IDs per service (for per-table services)
      venue: venueListing
        ? {
            id: venueListing.id,
            listingId: venueListing.id, 
            name: venueListing.name,
            description: venueListing.description,
            category: venueListing.category,
            price: venueListing.price?.toString() ?? null,
            pricingPolicy: venueListing.pricingPolicy,
            hourlyRate: venueListing.hourlyRate?.toString() ?? null,
            isActive: venueListing.isActive,
            images: venueListing.images || [],
            modelFile: venueListing.designElement?.modelFile ?? null,
            designElement: venueListing.designElement
              ? {
                  id: venueListing.designElement.id,
                  name: venueListing.designElement.name,
                  modelFile: venueListing.designElement.modelFile,
                  dimensions: venueListing.designElement.dimensions,
                }
              : null,
            vendor: venueListing.vendor
              ? {
                  id: venueListing.vendor.userId,
                  userId: venueListing.vendor.userId,
                  name: venueListing.vendor.user?.name ?? null,
                  email: venueListing.vendor.user?.email ?? null,
                  user: venueListing.vendor.user
                    ? {
                        name: venueListing.vendor.user.name,
                        email: venueListing.vendor.user.email,
                      }
                    : null,
                }
              : null,
            isBooked: venueBookingStatus?.isBooked || false,
            bookingId: venueBookingStatus?.bookingId || null,
            bookingStatus: venueBookingStatus?.status || null,
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
        placedElements: placementsWithBookingStatus,
      },
      projectServices,
      serviceMap, // Include serviceMap so frontend can access service details for per-table services
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

// GET /venue-designs/:projectId/vendor-preview - Vendor preview of a project's venue design (read-only)
router.get('/:projectId/vendor-preview', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Vendor access required' });
    }

    const projectId = req.params.projectId;

    // Only allow vendors who have a NON-cancelled/NON-rejected booking on this project to preview the venue design
    const vendorBooking = await prisma.booking.findFirst({
      where: {
        projectId,
        vendorId: req.user.sub,
        status: {
          notIn: ['cancelled_by_couple', 'cancelled_by_vendor', 'rejected'],
        },
      },
      select: { id: true },
    });

    if (!vendorBooking) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const project = await prisma.weddingProject.findUnique({
      where: { id: projectId },
      include: {
        venueServiceListing: {
          include: {
            designElement: true,
            vendor: {
              select: {
                userId: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const venueDesign = await getOrCreateVenueDesign(project);
    const layoutData = venueDesign.layoutData || {};
    const placementsMeta = layoutData.placementsMeta || {};

    const serviceListingIdsFromMeta = [
      ...new Set(Object.values(placementsMeta).map((meta) => meta?.serviceListingId).filter(Boolean)),
    ];

    const serviceListingIdsFromPlacements = [
      ...new Set(
        (venueDesign.placedElements || [])
          .flatMap((placement) => placement.serviceListingIds || [])
          .filter(Boolean)
      ),
    ];

    const allServiceListingIds = [...new Set([...serviceListingIdsFromMeta, ...serviceListingIdsFromPlacements])];

    let serviceListings = [];
    if (allServiceListingIds.length > 0) {
      serviceListings = await prisma.serviceListing.findMany({
        where: { id: { in: allServiceListingIds } },
        include: {
          vendor: {
            select: {
              userId: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
      });
    }

    const serviceMap = serviceListings.reduce((acc, listing) => {
      acc[listing.id] = serializeServiceListing(listing);
      return acc;
    }, {});

    const placements = (venueDesign.placedElements || []).map((placement) =>
      serializePlacement(placement, placementsMeta[placement.id], serviceMap)
    );

    const venueListing = project.venueServiceListing;

    return res.json({
      venue: venueListing?.designElement?.modelFile
        ? {
            id: venueListing.id,
            name: venueListing.name,
            modelFile: venueListing.designElement.modelFile,
          }
        : null,
      design: {
        id: venueDesign.id,
        layoutData,
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

    // Check if project is archived
    await checkProjectCanBeModified(req.params.projectId, req.user.sub);

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

    // If the project has a wedding date, ensure the service is available for that date.
    // This prevents adding exclusive or otherwise unavailable services to the design
    // after they have already been booked for the selected date.
    if (project.weddingDate) {
      const weddingDateIso =
        project.weddingDate instanceof Date
          ? project.weddingDate.toISOString().slice(0, 10)
          : project.weddingDate.toString().slice(0, 10);

      const availability = await checkServiceAvailabilityForDate(serviceListing.id, weddingDateIso);

      if (availability && availability.available === false) {
        return res.status(400).json({
          error: availability.reason || 'Service is unavailable on the selected wedding date',
        });
      }
    }

    if (serviceListing.category === 'Venue') {
      return res.status(400).json({ error: 'Venue listings cannot be placed inside another venue.' });
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

    // If no 3D models, add to ProjectService instead of PlacedElement
    if (elementDescriptors.length === 0) {
      // For per_table services, initial quantity should be 0 (until tables are tagged)
      // For exclusive services, quantity must always be 1
      // For other services, use quantity 1
      const isPerTable = serviceListing.pricingPolicy === 'per_table';
      const isExclusive = serviceListing.availabilityType === 'exclusive';
      const initialQuantity = isPerTable ? 0 : 1;
      
      // Add to ProjectService table (for non-3D services)
      await prisma.projectService.upsert({
        where: {
          projectId_serviceListingId: {
            projectId: project.id,
            serviceListingId: serviceListing.id,
          },
        },
        update: {
          // For exclusive services, keep quantity at 1 (don't increment)
          // For per_table services, quantity is managed by table tags
          // For other services, increment quantity
          ...(isExclusive || isPerTable ? {} : { quantity: { increment: 1 } }),
        },
        create: {
          projectId: project.id,
          serviceListingId: serviceListing.id,
          quantity: initialQuantity,
        },
      });

      // Update planned spend for non-3D services (they still affect budget)
      // Wait for update to complete so frontend gets fresh data
      await updatePlannedSpend(req.params.projectId);

      return res.status(200).json({
        message: isPerTable 
          ? 'Service added to project. Please tag tables in the 3D design to set the quantity.'
          : 'Service added to project (no 3D model available)',
        placements: [], // No placements for non-3D services
        projectService: true,
        isPerTable: isPerTable, // Include flag for frontend
      });
    }

    const basePosition = payload.position || { x: 0, y: 0, z: 0 };
    const rotation = payload.rotation ?? 0;
    const bundleId = prefixedUlid('bnd');
    const metadataEntries = {};
    const createdPlacements = [];

    // Get existing placements to check for collisions
    const existingPlacements = venueDesign.placedElements || [];
    
      // Helper function to check if a position collides with existing placements
      const findNonOverlappingPosition = (desiredPos, existingPlacements, designElement) => {
        const COLLISION_RADIUS_DEFAULT = 0.4;
        const CLEARANCE = 0.02;
      
      // Get footprint radius for the new element
      let footprintRadius = COLLISION_RADIUS_DEFAULT;
      if (designElement?.dimensions) {
        const width = Number(designElement.dimensions.width) || 0;
        const depth = Number(designElement.dimensions.depth) || 0;
        const derived = Math.max(width, depth) / 2;
        if (derived > 0) footprintRadius = derived;
      }
      
      // Try the desired position first
      let testPos = { ...desiredPos };
      let attempts = 0;
      const maxAttempts = 100;
      const searchRadius = 20; // Maximum search radius
      const angleStep = Math.PI / 4; // 45 degrees
      
      while (attempts < maxAttempts) {
        let hasCollision = false;
        
        // Check collision with all existing placements
        for (const existing of existingPlacements) {
          if (!existing.position) continue;
          
          const existingPos = existing.position;
          const dx = testPos.x - existingPos.x;
          const dz = testPos.z - existingPos.z;
          const distance = Math.sqrt(dx * dx + dz * dz);
          
          // Get footprint radius for existing element
          let existingRadius = COLLISION_RADIUS_DEFAULT;
          if (existing.designElement?.dimensions) {
            const width = Number(existing.designElement.dimensions.width) || 0;
            const depth = Number(existing.designElement.dimensions.depth) || 0;
            const derived = Math.max(width, depth) / 2;
            if (derived > 0) existingRadius = derived;
          }
          
          const threshold = Math.max(0.1, footprintRadius + existingRadius - CLEARANCE);
          if (distance < threshold) {
            hasCollision = true;
            break;
          }
        }
        
        if (!hasCollision) {
          return testPos;
        }
        
        // Try next position in a spiral pattern
        attempts++;
        const ring = Math.floor(Math.sqrt(attempts));
        const angle = (attempts - ring * ring) * angleStep;
        const radius = ring * (footprintRadius * 2 + CLEARANCE);
        testPos = {
          x: desiredPos.x + radius * Math.cos(angle),
          y: desiredPos.y,
          z: desiredPos.z + radius * Math.sin(angle),
        };
        
        // Check if we've gone too far
        const distanceFromOrigin = Math.sqrt(testPos.x * testPos.x + testPos.z * testPos.z);
        if (distanceFromOrigin > searchRadius) {
          // Reset to a closer position
          testPos = {
            x: desiredPos.x + (ring % 4) * (footprintRadius * 2 + CLEARANCE),
            y: desiredPos.y,
            z: desiredPos.z + Math.floor(ring / 4) * (footprintRadius * 2 + CLEARANCE),
          };
        }
      }
      
      // If we couldn't find a position, return the original (user can manually adjust)
      return desiredPos;
    };

    await prisma.$transaction(async (tx) => {
      let offsetIndex = 0;
      for (const descriptor of elementDescriptors) {
        // Get design element for collision detection
        const designElement = await tx.designElement.findUnique({
          where: { id: descriptor.designElementId },
        });
        
        for (let i = 0; i < descriptor.quantity; i += 1) {
          // Calculate position with offset
          const desiredPos = {
            x: basePosition.x + offsetIndex * 0.5,
            y: basePosition.y,
            z: basePosition.z,
          };
          
          // Find non-overlapping position
          const finalPos = findNonOverlappingPosition(desiredPos, existingPlacements, designElement);
          
          const positionRecord = await tx.coordinates.create({
            data: {
              id: prefixedUlid('pos'),
              x: finalPos.x,
              y: finalPos.y,
              z: finalPos.z,
            },
          });

          const placement = await tx.placedElement.create({
            data: {
              id: prefixedUlid('ple'),
              venueDesignId: venueDesign.id,
              designElementId: descriptor.designElementId || null, // Allow null for non-3D items
              positionId: positionRecord.id,
              rotation,
            },
            include: PLACEMENT_INCLUDE,
          });

          createdPlacements.push(placement);
          
          // Add to existingPlacements for collision detection of next items
          existingPlacements.push({
            ...placement,
            position: finalPos,
            designElement: designElement,
          });

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

    // Update planned spend in background (don't wait)
    updatePlannedSpend(req.params.projectId).catch(console.error);

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

    // Check if project is archived
    await checkProjectCanBeModified(req.params.projectId, req.user.sub);

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

      if (payload.rotation !== undefined || payload.isLocked !== undefined || payload.parentElementId !== undefined) {
        const updateData = {};
        if (payload.rotation !== undefined) updateData.rotation = payload.rotation;
        if (payload.isLocked !== undefined) updateData.isLocked = payload.isLocked;
        if (payload.parentElementId !== undefined) {
          console.log('[Backend] Updating parentElementId:', {
            placementId: placement.id,
            newParentElementId: payload.parentElementId,
            currentParentElementId: placement.parentElementId,
          });
          // Validate parent exists and is in same venue design
          if (payload.parentElementId !== null) {
            const parentExists = await tx.placedElement.findFirst({
              where: {
                id: payload.parentElementId,
                venueDesignId: venueDesign.id,
              },
            });
            if (!parentExists) {
              console.error('[Backend] Parent element not found:', payload.parentElementId);
              throw new Error('Parent element not found');
            }
            // Prevent circular references
            if (payload.parentElementId === placement.id) {
              console.error('[Backend] Circular reference detected:', payload.parentElementId);
              throw new Error('Element cannot be its own parent');
            }
          }
          updateData.parentElementId = payload.parentElementId;
        }
        if (Object.keys(updateData).length > 0) {
          await tx.placedElement.update({
            where: { id: placement.id },
            data: updateData,
          });
          console.log('[Backend] Updated placement:', placement.id, 'with data:', updateData);
        }
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

    // Update planned spend in background (don't wait)
    updatePlannedSpend(req.params.projectId).catch(console.error);

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

    // Check if project is archived
    await checkProjectCanBeModified(req.params.projectId, req.user.sub);

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
        isBooked: true,
      },
    });

    if (placements.length === 0) {
      return res.status(404).json({ error: 'Placed element not found' });
    }

    // Prevent removal of any booked elements
    const hasBookedPlacement = placements.some((p) => p.isBooked);
    if (hasBookedPlacement) {
      return res.status(400).json({
        error:
          'One or more selected elements are part of a booking and cannot be removed. Please contact your vendor if you need to change a booked service.',
      });
    }

    const positionIds = placements.map((placement) => placement.positionId);
    const placementIdsBeingDeleted = placements.map((p) => p.id);

    // Hybrid cleanup: Handle expenses linked to placements being deleted
    // Check for expenses that reference these placements
    const budget = await prisma.budget.findUnique({
      where: { projectId: req.params.projectId },
      include: {
        categories: {
          include: {
            expenses: {
              where: {
                from3DDesign: true,
                OR: [
                  { placedElementId: { in: placementIdsBeingDeleted } },
                ],
              },
            },
          },
        },
      },
    });
    
    // Also check expenses with placedElementIds JSON field
    // We'll check this manually since Prisma doesn't have great JSON array query support
    const allExpenses = budget ? budget.categories.flatMap(cat => cat.expenses) : [];
    const expensesToCheck = allExpenses.filter(expense => {
      if (placementIdsBeingDeleted.includes(expense.placedElementId)) {
        return true;
      }
      if (expense.placedElementIds && Array.isArray(expense.placedElementIds)) {
        return expense.placedElementIds.some(id => placementIdsBeingDeleted.includes(id));
      }
      // Check remark for old data
      if (expense.remark) {
        try {
          const remarkData = JSON.parse(expense.remark);
          if (remarkData.placedElementIds && Array.isArray(remarkData.placedElementIds)) {
            return remarkData.placedElementIds.some(id => placementIdsBeingDeleted.includes(id));
          }
        } catch (e) {
          // Not JSON, skip
        }
      }
      return false;
    });

    if (budget && expensesToCheck.length > 0) {
      // Group expenses by category for easier processing
      const expensesByCategory = new Map();
      budget.categories.forEach(category => {
        category.expenses.forEach(expense => {
          if (expensesToCheck.includes(expense)) {
            if (!expensesByCategory.has(category.id)) {
              expensesByCategory.set(category.id, []);
            }
            expensesByCategory.get(category.id).push(expense);
          }
        });
      });
      
      for (const [categoryId, expenses] of expensesByCategory.entries()) {
        for (const expense of expenses) {
          // Get all placement IDs for this expense
          let expensePlacementIds = [];
          if (expense.placedElementIds && Array.isArray(expense.placedElementIds)) {
            expensePlacementIds = expense.placedElementIds;
          } else if (expense.placedElementId) {
            expensePlacementIds = [expense.placedElementId];
          } else {
            // Check remark field for old data
            try {
              if (expense.remark) {
                const remarkData = JSON.parse(expense.remark);
                if (remarkData.placedElementIds && Array.isArray(remarkData.placedElementIds)) {
                  expensePlacementIds = remarkData.placedElementIds;
                }
              }
            } catch (e) {
              // Not JSON, skip
            }
          }

          // Find which placements from this expense are being deleted
          const deletedPlacementIds = expensePlacementIds.filter(id => placementIdsBeingDeleted.includes(id));
          
          if (deletedPlacementIds.length > 0) {
            // Get the service listing to calculate unit price
            const serviceListing = expense.serviceListingId 
              ? await prisma.serviceListing.findUnique({
                  where: { id: expense.serviceListingId },
                  select: { price: true, pricingPolicy: true },
                })
              : null;
            
            const unitPrice = serviceListing ? parseFloat(serviceListing.price || 0) : 0;
            const remainingPlacementIds = expensePlacementIds.filter(id => !placementIdsBeingDeleted.includes(id));
            
            if (remainingPlacementIds.length === 0) {
              // All placements deleted → delete the expense
              await prisma.expense.delete({
                where: { id: expense.id },
              });
              
              // Update budget: add back to plannedSpend, remove from totalSpent if marked as paid
              const expenseEstimatedCost = parseFloat(expense.estimatedCost || 0);
              const expenseActualCost = expense.actualCost ? parseFloat(expense.actualCost) : 0;
              
              await prisma.budget.update({
                where: { id: budget.id },
                data: {
                  plannedSpend: { increment: expenseEstimatedCost },
                  totalSpent: expenseActualCost > 0 ? { decrement: expenseActualCost } : undefined,
                },
              });
            } else {
              // Some placements remain → reduce quantity and cost
              const deletedCount = deletedPlacementIds.length;
              const newQuantity = remainingPlacementIds.length;
              
              // Calculate new costs
              const oldEstimatedCost = parseFloat(expense.estimatedCost || 0);
              const oldActualCost = expense.actualCost ? parseFloat(expense.actualCost) : 0;
              
              // For grouped items, reduce proportionally
              const costPerItem = oldEstimatedCost / expensePlacementIds.length;
              const newEstimatedCost = costPerItem * newQuantity;
              const newActualCost = oldActualCost > 0 ? (oldActualCost / expensePlacementIds.length) * newQuantity : null;
              
              // Update expense name to reflect new quantity
              const nameMatch = expense.expenseName.match(/^(.+?)(\s*\((\d+)\))?$/);
              const baseName = nameMatch ? nameMatch[1] : expense.expenseName;
              const updatedName = newQuantity > 1 ? `${baseName} (${newQuantity})` : baseName;
              
              await prisma.expense.update({
                where: { id: expense.id },
                data: {
                  expenseName: updatedName,
                  estimatedCost: newEstimatedCost,
                  actualCost: newActualCost,
                  placedElementId: remainingPlacementIds[0], // Update to first remaining
                  placedElementIds: remainingPlacementIds, // Update placement IDs
                },
              });
              
              // Update budget: adjust plannedSpend and totalSpent
              const estimatedCostChange = oldEstimatedCost - newEstimatedCost;
              const actualCostChange = oldActualCost - (newActualCost || 0);
              
              await prisma.budget.update({
                where: { id: budget.id },
                data: {
                  plannedSpend: { increment: estimatedCostChange },
                  totalSpent: actualCostChange > 0 ? { decrement: actualCostChange } : undefined,
                },
              });
            }
          }
        }
      }
      
      // Recalculate budget totals
      const categories = await prisma.budgetCategory.findMany({
        where: { budgetId: budget.id },
        include: { expenses: true },
      });
      
      let totalSpent = 0;
      categories.forEach(category => {
        category.expenses.forEach(expense => {
          if (expense.actualCost) {
            totalSpent += parseFloat(expense.actualCost);
          }
        });
      });
      
      const currentBudget = await prisma.budget.findUnique({
        where: { id: budget.id },
      });
      
      await prisma.budget.update({
        where: { id: budget.id },
        data: {
          totalSpent: totalSpent,
          totalRemaining: parseFloat(currentBudget.totalBudget) - totalSpent - parseFloat(currentBudget.plannedSpend || 0),
        },
      });
    }

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

    // Update planned spend immediately so frontend gets fresh data
    await updatePlannedSpend(req.params.projectId);

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

// Duplicate element endpoint
router.post('/:projectId/elements/:elementId/duplicate', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const project = await fetchProject(req.params.projectId, req.user.sub);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await checkProjectCanBeModified(req.params.projectId, req.user.sub);

    const venueDesign = await getOrCreateVenueDesign(project);

    const originalPlacement = await prisma.placedElement.findFirst({
      where: {
        id: req.params.elementId,
        venueDesignId: venueDesign.id,
      },
      include: {
        position: true,
        designElement: true,
      },
    });

    if (!originalPlacement) {
      return res.status(404).json({ error: 'Placed element not found' });
    }

    const layoutData = venueDesign.layoutData || {};
    const placementsMeta = { ...(layoutData.placementsMeta || {}) };
    const originalMeta = placementsMeta[originalPlacement.id] || {};

    // Check if this is part of a bundle - if so, duplicate the entire bundle
    const bundleId = originalMeta.bundleId;
    let bundlePlacements = [];
    if (bundleId) {
      // Find all placements in the same bundle
      const allPlacements = await prisma.placedElement.findMany({
        where: { venueDesignId: venueDesign.id },
        include: { position: true, designElement: true },
      });
      
      bundlePlacements = allPlacements.filter((p) => {
        const meta = placementsMeta[p.id] || {};
        return meta.bundleId === bundleId;
      });
    } else {
      // Single element, not part of a bundle
      bundlePlacements = [originalPlacement];
    }

    // Get service listing info to check availability type (use first placement's service)
    const serviceListingId = originalMeta.serviceListingId;
    let serviceListing = null;
    if (serviceListingId) {
      serviceListing = await prisma.serviceListing.findUnique({
        where: { id: serviceListingId },
        select: {
          id: true,
          availabilityType: true,
          maxQuantity: true,
          name: true,
        },
      });
    }

    // Check duplication limits based on service type
    // For bundles, we count by bundle instances, not individual elements
    if (serviceListing) {
      if (serviceListing.availabilityType === 'exclusive') {
        // Count unique bundles (not individual placements)
        const uniqueBundles = new Set();
        Object.values(placementsMeta).forEach((meta) => {
          if (meta.serviceListingId === serviceListingId && meta.bundleId) {
            uniqueBundles.add(meta.bundleId);
          } else if (meta.serviceListingId === serviceListingId && !meta.bundleId) {
            // Single element (not part of bundle) counts as one instance
            uniqueBundles.add(`single_${Object.keys(placementsMeta).find(k => placementsMeta[k] === meta)}`);
          }
        });
        
        if (uniqueBundles.size >= 1) {
          return res.status(400).json({
            error: `This is an exclusive service (${serviceListing.name}). Only one instance can be placed in the design.`,
            warning: true,
          });
        }
      } else if (serviceListing.availabilityType === 'quantity_based' && serviceListing.maxQuantity) {
        // Count unique bundles (not individual placements)
        const uniqueBundles = new Set();
        Object.values(placementsMeta).forEach((meta) => {
          if (meta.serviceListingId === serviceListingId && meta.bundleId) {
            uniqueBundles.add(meta.bundleId);
          } else if (meta.serviceListingId === serviceListingId && !meta.bundleId) {
            uniqueBundles.add(`single_${Object.keys(placementsMeta).find(k => placementsMeta[k] === meta)}`);
          }
        });
        
        if (uniqueBundles.size >= serviceListing.maxQuantity) {
          return res.status(400).json({
            error: `Maximum quantity (${serviceListing.maxQuantity}) for this service has been reached.`,
            warning: true,
          });
        }
      }
      // 'reusable' services have no limit - allow unlimited duplication
    }

    // Calculate offset position for the bundle (use the first placement as reference)
    const referencePlacement = bundlePlacements[0];
    const COLLISION_RADIUS_DEFAULT = 0.4;
    const CLEARANCE = 0.1;
    
    // Calculate bundle bounding box to determine offset distance
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    bundlePlacements.forEach((p) => {
      if (p.position) {
        minX = Math.min(minX, p.position.x);
        maxX = Math.max(maxX, p.position.x);
        minZ = Math.min(minZ, p.position.z);
        maxZ = Math.max(maxZ, p.position.z);
      }
    });
    const bundleWidth = Math.max(maxX - minX, 0.5);
    const bundleDepth = Math.max(maxZ - minZ, 0.5);
    const offsetDistance = Math.max(bundleWidth, bundleDepth) + CLEARANCE;

    // Get existing placements to find non-overlapping position
    const existingPlacements = await prisma.placedElement.findMany({
      where: { venueDesignId: venueDesign.id },
      include: { position: true, designElement: true },
    });

    const findNonOverlappingPosition = (desiredPos, existingPlacements, bundleBounds) => {
      let testPos = { ...desiredPos };
      let attempts = 0;
      const maxAttempts = 50;
      const angleStep = Math.PI / 4; // 45 degrees

      while (attempts < maxAttempts) {
        let hasCollision = false;

        // Check if the bundle at this position would collide with any existing placement
        for (const existing of existingPlacements) {
          if (!existing.position) continue;
          // Skip placements that are part of the original bundle we're duplicating
          const existingMeta = placementsMeta[existing.id] || {};
          if (existingMeta.bundleId === bundleId) continue;

          // Check if bundle bounds overlap with existing placement
          const bundleMinX = testPos.x - bundleWidth / 2;
          const bundleMaxX = testPos.x + bundleWidth / 2;
          const bundleMinZ = testPos.z - bundleDepth / 2;
          const bundleMaxZ = testPos.z + bundleDepth / 2;

          const existingRadius = COLLISION_RADIUS_DEFAULT;
          const threshold = existingRadius + CLEARANCE;

          if (
            existing.position.x + threshold >= bundleMinX &&
            existing.position.x - threshold <= bundleMaxX &&
            existing.position.z + threshold >= bundleMinZ &&
            existing.position.z - threshold <= bundleMaxZ
          ) {
            hasCollision = true;
            break;
          }
        }

        if (!hasCollision) {
          return testPos;
        }

        attempts++;
        const ring = Math.floor(Math.sqrt(attempts));
        const angle = (attempts - ring * ring) * angleStep;
        const radius = ring * offsetDistance;
        testPos = {
          x: referencePlacement.position.x + radius * Math.cos(angle),
          y: referencePlacement.position.y,
          z: referencePlacement.position.z + radius * Math.sin(angle),
        };
      }

      return testPos; // Return last attempt if all failed
    };

    const bundleCenter = {
      x: (minX + maxX) / 2,
      y: referencePlacement.position.y,
      z: (minZ + maxZ) / 2,
    };

    const newBundleCenter = findNonOverlappingPosition(
      {
        x: bundleCenter.x + offsetDistance,
        y: bundleCenter.y,
        z: bundleCenter.z,
      },
      existingPlacements,
      { width: bundleWidth, depth: bundleDepth }
    );

    // Calculate offset from bundle center for each placement
    const offsetX = newBundleCenter.x - bundleCenter.x;
    const offsetZ = newBundleCenter.z - bundleCenter.z;

    // Create new bundle ID for duplicated bundle
    const newBundleId = bundleId ? prefixedUlid('bnd') : null;

    // Duplicate all placements in the bundle
    // Note: Tagged services are NOT copied - users can tag the duplicated element manually if needed
    const duplicatedPlacements = await prisma.$transaction(async (tx) => {
      const newPlacements = [];
      
      for (const originalPlacement of bundlePlacements) {
        // Calculate new position maintaining relative position within bundle
        const newPosition = {
          x: originalPlacement.position.x + offsetX,
          y: originalPlacement.position.y,
          z: originalPlacement.position.z + offsetZ,
        };

        const newPositionRecord = await tx.coordinates.create({
          data: {
            x: newPosition.x,
            y: newPosition.y,
            z: newPosition.z,
          },
        });

        // Don't copy tagged services - duplicated element starts with no tags
        // User can tag it manually if needed

        const newPlacementRecord = await tx.placedElement.create({
          data: {
            venueDesignId: venueDesign.id,
            designElementId: originalPlacement.designElementId,
            positionId: newPositionRecord.id,
            rotation: originalPlacement.rotation || 0,
            isLocked: false,
            parentElementId: originalPlacement.parentElementId, // Preserve parent if original had one
            serviceListingIds: [], // Don't copy tagged services - user can tag manually
            elementType: originalPlacement.elementType,
          },
        });

        // Copy metadata with new bundleId
        const originalMeta = placementsMeta[originalPlacement.id] || {};
        const newMeta = { ...originalMeta };
        if (newBundleId) {
          newMeta.bundleId = newBundleId;
        }
        placementsMeta[newPlacementRecord.id] = newMeta;

        newPlacements.push(newPlacementRecord);
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

      return newPlacements;
    });

    // Fetch all duplicated placements with includes
    const fullPlacements = await Promise.all(
      duplicatedPlacements.map((p) =>
        prisma.placedElement.findUnique({
          where: { id: p.id },
          include: PLACEMENT_INCLUDE,
        })
      )
    );

    // Get service listing info for serialization
    let serviceListingInfo = null;
    if (serviceListingId) {
      const fullServiceListing = await prisma.serviceListing.findUnique({
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
      serviceListingInfo = serializeServiceListing(fullServiceListing);
    }

    const serviceMap = serviceListingInfo ? { [serviceListingInfo.id]: serviceListingInfo } : {};
    const responsePlacements = fullPlacements.map((placement) =>
      serializePlacement(placement, placementsMeta[placement.id], serviceMap)
    );

    return res.json({
      placements: responsePlacements, // Return array for bundles, single item for non-bundles
      bundleId: newBundleId,
      warning: serviceListing?.availabilityType === 'exclusive' 
        ? 'This is an exclusive service. Only one instance can be booked per date.'
        : null,
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

    // Check if project is archived
    await checkProjectCanBeModified(req.params.projectId, req.user.sub);

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

    // Check if project is archived
    await checkProjectCanBeModified(req.params.projectId, req.user.sub);

    const venueDesign = await getOrCreateVenueDesign(project);
    const layoutData = venueDesign.layoutData || {};
    const incomingMeta = payload.layoutData?.placementsMeta;
    const nextPlacementsMeta =
      incomingMeta && typeof incomingMeta === 'object' && Object.keys(incomingMeta).length > 0
        ? { ...(layoutData.placementsMeta || {}), ...incomingMeta }
        : layoutData.placementsMeta || {};

    const updatedLayout = {
      ...layoutData,
      ...(payload.layoutData || {}),
      // placementsMeta is server-owned metadata used for bundle grouping & summaries.
      // Never wipe it just because the client doesn't send it (or sends an empty object).
      placementsMeta: nextPlacementsMeta,
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

// GET /venue-designs/:venueDesignId/table-count - Get table count, optionally filtered by service listing
router.get('/:venueDesignId/table-count', requireAuth, async (req, res, next) => {
  try {
    const { getTableCount } = require('../services/tableCountService');
    const { venueDesignId } = req.params;
    const { serviceListingId } = req.query;

    // Verify user has access to this project's venue design
    const venueDesign = await prisma.venueDesign.findUnique({
      where: { id: venueDesignId },
      include: {
        project: {
          select: {
            id: true,
            coupleId: true,
            status: true,
          },
        },
      },
    });

    if (!venueDesign) {
      return res.status(404).json({ error: 'Venue design not found' });
    }

    // Check if user is the couple who owns this project
    if (venueDesign.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Note: table count is read-only, so we allow it for completed projects
    // But tag/untag operations are blocked above

    const count = await getTableCount(venueDesignId, serviceListingId || null);

    res.json({
      venueDesignId,
      serviceListingId: serviceListingId || null,
      count,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

// POST /venue-designs/:venueDesignId/tag-tables - Tag tables with service listing IDs
router.post('/:venueDesignId/tag-tables', requireAuth, async (req, res, next) => {
  try {
    const { tagTables } = require('../services/tableCountService');

    const tagSchema = z.object({
      placedElementIds: z.array(z.string().min(1)).min(1, 'At least one placed element ID is required'),
      serviceListingIds: z.array(z.string().uuid()).min(1, 'At least one service listing ID is required'),
    });

    const validatedData = tagSchema.parse(req.body);
    const { venueDesignId } = req.params;

    // Verify user has access to this project's venue design
    const venueDesign = await prisma.venueDesign.findUnique({
      where: { id: venueDesignId },
      include: {
        project: {
          select: {
            id: true,
            coupleId: true,
            status: true,
          },
        },
      },
    });

    if (!venueDesign) {
      return res.status(404).json({ error: 'Venue design not found' });
    }

    // Check if user is the couple who owns this project
    if (venueDesign.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if project is archived
    await checkProjectCanBeModified(venueDesign.project.id, req.user.sub);

    const updatedCount = await tagTables(
      venueDesignId,
      validatedData.placedElementIds,
      validatedData.serviceListingIds
    );

    // Update planned spend when tables are tagged (per-table services affect budget)
    // Wait for update to complete so frontend gets fresh data
    await updatePlannedSpend(venueDesign.project.id);
    
    // Update expenses for per-table services that were already moved to categories
    // This ensures expenses stay in sync with the actual tagged table count
    updatePerTableServiceExpenses(venueDesign.project.id, validatedData.serviceListingIds).catch(console.error);
    
    // Note: Per-table services are now shown in "3D Venue Design (Planned)" section
    // Users can manually move them to categories (Option B approach)

    res.json({
      message: `Successfully tagged ${updatedCount} table(s)`,
      venueDesignId,
      updatedCount,
    });
  } catch (err) {
    console.error('Error in tag-tables endpoint:', err);
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((issue) => ({
        field: issue.path?.join('.') ?? 'unknown',
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
    // Log full error details for debugging
    console.error('Full error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
    return res.status(500).json({ 
      error: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

// POST /venue-designs/:venueDesignId/untag-tables - Remove service listing tags from tables
router.post('/:venueDesignId/untag-tables', requireAuth, async (req, res, next) => {
  try {
    const { untagTables } = require('../services/tableCountService');

    const untagSchema = z.object({
      placedElementIds: z.array(z.string().min(1)).min(1, 'At least one placed element ID is required'), // ULIDs, not UUIDs
      serviceListingIds: z.array(z.string().uuid()).min(1, 'At least one service listing ID is required'),
    });

    const validatedData = untagSchema.parse(req.body);
    const { venueDesignId } = req.params;

    // Verify user has access to this project's venue design
    const venueDesign = await prisma.venueDesign.findUnique({
      where: { id: venueDesignId },
      include: {
        project: {
          select: {
            id: true,
            coupleId: true,
            status: true,
          },
        },
      },
    });

    if (!venueDesign) {
      return res.status(404).json({ error: 'Venue design not found' });
    }

    // Check if user is the couple who owns this project
    if (venueDesign.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if project is archived
    await checkProjectCanBeModified(venueDesign.project.id, req.user.sub);

    const updatedCount = await untagTables(
      venueDesignId,
      validatedData.placedElementIds,
      validatedData.serviceListingIds
    );

    // Update planned spend when tables are untagged (per-table services affect budget)
    // Wait for update to complete so frontend gets fresh data
    await updatePlannedSpend(venueDesign.project.id);
    
    // Update expenses for per-table services that were already moved to categories
    // This ensures expenses stay in sync with the actual tagged table count
    updatePerTableServiceExpenses(venueDesign.project.id, validatedData.serviceListingIds).catch(console.error);
    
    // Note: Per-table services are now shown in "3D Venue Design (Planned)" section
    // Users can manually move them to categories (Option B approach)

    res.json({
      message: `Successfully untagged ${updatedCount} table(s)`,
      venueDesignId,
      updatedCount,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((issue) => ({
        field: issue.path?.join('.') ?? 'unknown',
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
    next(err);
  }
});

// GET /venue-designs/:projectId/budget - Get budget data only (lightweight refresh)
router.get('/:projectId/budget', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const project = await fetchProject(req.params.projectId, req.user.sub);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Return budget data only - ensure all Decimal fields are properly converted to strings
    // totalSpent is stored in Budget.totalSpent field (calculated from sum of Expense.actualCost)
    // Fetch budget directly from database to ensure we get the latest values
    const budgetData = await prisma.budget.findUnique({
      where: { id: project.budget.id },
    });
    
    if (!budgetData) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Convert Decimal fields to strings - handle null/undefined cases
    // Prisma Decimal types need to be converted to string explicitly
    const totalBudget = budgetData.totalBudget != null ? String(budgetData.totalBudget) : '0';
    const plannedSpend = budgetData.plannedSpend != null ? String(budgetData.plannedSpend) : '0';
    
    // Prisma Decimal objects need explicit toString() call
    const totalSpentRaw = budgetData.totalSpent;
    const totalSpent = totalSpentRaw != null 
      ? (typeof totalSpentRaw.toString === 'function' ? totalSpentRaw.toString() : String(totalSpentRaw))
      : '0';
    const totalRemaining = budgetData.totalRemaining != null ? String(budgetData.totalRemaining) : '0';
    
    return res.json({
      budget: {
        totalBudget,
        plannedSpend,
        totalSpent,
        totalRemaining,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /venue-designs/:projectId/checkout-summary - Get checkout summary with calculated quantities and prices
router.get('/:projectId/checkout-summary', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const project = await fetchProject(req.params.projectId, req.user.sub);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if project is archived
    await checkProjectCanBeModified(req.params.projectId, req.user.sub);

    if (!project.weddingDate) {
      return res.status(400).json({ error: 'Wedding date is not set for this project' });
    }

    const venueDesign = await getOrCreateVenueDesign(project);
    const layoutData = venueDesign.layoutData || {};
    const placementsMeta = layoutData.placementsMeta || {};

    // Get all placements with their service listings
    const placements = await prisma.placedElement.findMany({
      where: { venueDesignId: venueDesign.id },
      include: {
        designElement: {
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
        },
      },
    });

    // Get project services (non-3D services)
    const projectServices = await prisma.projectService.findMany({
      where: { projectId: project.id },
      include: {
        serviceListing: {
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
        },
      },
    });

    // Get active bookings for this project and wedding date
    const weddingDate = project.weddingDate instanceof Date ? project.weddingDate : new Date(project.weddingDate);
    const startOfDay = new Date(weddingDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(weddingDate);
    endOfDay.setHours(23, 59, 59, 999);

    const activeBookings = await prisma.booking.findMany({
      where: {
        projectId: project.id,
        reservedDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          notIn: ['cancelled_by_couple', 'cancelled_by_vendor', 'rejected'],
        },
      },
      include: {
        selectedServices: {
          select: {
            serviceListingId: true,
            quantity: true,
          },
        },
      },
    });

    // Calculate already booked quantities per service listing
    const bookedQuantities = {};
    activeBookings.forEach((booking) => {
      booking.selectedServices.forEach((service) => {
        const serviceId = service.serviceListingId;
        if (!bookedQuantities[serviceId]) {
          bookedQuantities[serviceId] = 0;
        }
        bookedQuantities[serviceId] += service.quantity || 0;
      });
    });

    // Get service listings for placements and project services
    const serviceListingIds = new Set();
    placements.forEach((placement) => {
      const meta = placementsMeta[placement.id];
      if (meta?.serviceListingId) {
        serviceListingIds.add(meta.serviceListingId);
      }
    });
    projectServices.forEach((ps) => {
      if (ps.serviceListingId) {
        serviceListingIds.add(ps.serviceListingId);
      }
    });

    // Check if venue has an active booking / request
    let venueBookingStatus = null;
    if (project.venueServiceListingId && project.weddingDate) {
      const venueBooking = await prisma.booking.findFirst({
        where: {
          projectId: project.id,
          reservedDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: {
            notIn: ['cancelled_by_couple', 'cancelled_by_vendor', 'rejected'],
          },
          selectedServices: {
            some: {
              serviceListingId: project.venueServiceListingId,
            },
          },
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (venueBooking) {
        const acceptedVenueStatuses = ['pending_deposit_payment', 'confirmed', 'pending_final_payment', 'completed'];
        venueBookingStatus = {
          isRequested: true,
          isAccepted: acceptedVenueStatuses.includes(venueBooking.status),
          bookingId: venueBooking.id,
          status: venueBooking.status,
        };
      }
    }

    // Include venue in checkout only if there is no existing active venue request yet.
    if (project.venueServiceListingId && !venueBookingStatus?.isRequested) {
      serviceListingIds.add(project.venueServiceListingId);
    }

    const serviceListings = await prisma.serviceListing.findMany({
      where: { id: { in: Array.from(serviceListingIds) } },
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

    const serviceListingMap = {};
    serviceListings.forEach((listing) => {
      serviceListingMap[listing.id] = listing;
    });

    // Calculate design quantities per service listing
    const designQuantities = {};
    const bundleTracker = new Map(); // Track bundles to avoid double-counting

    // Count 3D placements
    placements.forEach((placement) => {
      const meta = placementsMeta[placement.id];
      if (!meta?.serviceListingId) return;

      const bundleId = meta.bundleId;
      if (bundleId) {
        // For bundles, count once per bundle
        if (!bundleTracker.has(bundleId)) {
          bundleTracker.set(bundleId, true);
          if (!designQuantities[meta.serviceListingId]) {
            designQuantities[meta.serviceListingId] = 0;
          }
          designQuantities[meta.serviceListingId] += 1;
        }
      } else {
        // Individual placement
        if (!designQuantities[meta.serviceListingId]) {
          designQuantities[meta.serviceListingId] = 0;
        }
        designQuantities[meta.serviceListingId] += 1;
      }
    });

    // Count non-3D project services
    const { getTableCount } = require('../services/tableCountService');
    for (const ps of projectServices) {
      if (!ps.serviceListingId) continue;
      const listing = serviceListingMap[ps.serviceListingId];
      if (!listing) continue;

      if (listing.pricingPolicy === 'per_table') {
        // For per_table services, use the table count service
        try {
          const tableCount = await getTableCount(venueDesign.id, ps.serviceListingId);
          designQuantities[ps.serviceListingId] = tableCount;
        } catch (err) {
          console.warn(`[checkout-summary] Failed to get table count for ${ps.serviceListingId}:`, err.message);
          designQuantities[ps.serviceListingId] = 0;
        }
      } else {
        // For other services, use ProjectService quantity
        if (!designQuantities[ps.serviceListingId]) {
          designQuantities[ps.serviceListingId] = 0;
        }
        designQuantities[ps.serviceListingId] += ps.quantity || 1;
      }
    }

    // Include venue if not requested yet
    if (project.venueServiceListingId && !venueBookingStatus?.isRequested) {
      designQuantities[project.venueServiceListingId] = 1;
    }

    // Calculate event duration for time_based pricing
    let eventDuration = null;
    if (project.eventStartTime && project.eventEndTime) {
      try {
        eventDuration = calculateEventDuration(project.eventStartTime, project.eventEndTime);
      } catch (err) {
        console.warn('[checkout-summary] Failed to calculate event duration:', err.message);
      }
    }

    // Build checkout items with calculated quantities and prices
    const checkoutItems = [];
    const vendorMap = {};

    Object.entries(designQuantities).forEach(([serviceListingId, designQuantity]) => {
      const listing = serviceListingMap[serviceListingId];
      if (!listing) return;

      const alreadyBooked = bookedQuantities[serviceListingId] || 0;
      const additionalQuantity = Math.max(0, designQuantity - alreadyBooked);

      // Skip if no additional quantity to book
      if (additionalQuantity <= 0) return;

      const vendorId = listing.vendor?.userId;
      const vendorName = listing.vendor?.user?.name || 'Unknown Vendor';

      if (!vendorMap[vendorId]) {
        vendorMap[vendorId] = {
          vendorId,
          vendorName,
          items: [],
          total: 0,
        };
      }

      // Calculate price for additional quantity
      let additionalPrice = 0;
      try {
        const pricingContext = {};
        
        if (listing.pricingPolicy === 'per_unit') {
          pricingContext.quantity = additionalQuantity;
        } else if (listing.pricingPolicy === 'per_table') {
          // For per_table, use the designQuantity (total tables tagged)
          // The price is calculated based on total tables, not additional
          pricingContext.tableCount = designQuantity;
        } else if (listing.pricingPolicy === 'time_based') {
          if (eventDuration !== null) {
            pricingContext.eventDuration = eventDuration;
          } else {
            throw new Error('Event duration is required for time_based pricing');
          }
        }
        // fixed_package doesn't need context

        const calculatedPrice = calculatePrice(listing, pricingContext);
        additionalPrice = parseFloat(calculatedPrice.toString());
        
        // For per_table, if we have booked tables, we need to calculate the price
        // for only the additional tables. Since per_table pricing is linear,
        // we can calculate: price_per_table * additionalQuantity
        if (listing.pricingPolicy === 'per_table' && alreadyBooked > 0) {
          const pricePerTable = parseFloat(listing.price?.toString() || '0');
          additionalPrice = pricePerTable * additionalQuantity;
        }
      } catch (err) {
        console.error(`[checkout-summary] Failed to calculate price for ${listing.id}:`, err.message);
        // Fallback to base price * quantity for per_unit, or base price for others
        const basePrice = parseFloat(listing.price?.toString() || '0');
        if (listing.pricingPolicy === 'per_unit' || listing.pricingPolicy === 'per_table') {
          additionalPrice = basePrice * additionalQuantity;
        } else {
          additionalPrice = basePrice;
        }
      }

      const unitPrice = parseFloat(listing.price?.toString() || '0');
      const displayName = additionalQuantity > 1 ? `${listing.name} x ${additionalQuantity}` : listing.name;

      const item = {
        key: `item_${serviceListingId}`,
        serviceListingId,
        name: listing.name,
        displayName,
        quantity: additionalQuantity,
        designQuantity,
        alreadyBookedQuantity: alreadyBooked,
        unitPrice,
        price: additionalPrice,
        pricingPolicy: listing.pricingPolicy,
        serviceListing: {
          id: listing.id,
          name: listing.name,
          category: listing.category,
          price: listing.price?.toString() || null,
          pricingPolicy: listing.pricingPolicy,
          hourlyRate: listing.hourlyRate?.toString() || null,
        },
      };

      vendorMap[vendorId].items.push(item);
      vendorMap[vendorId].total += additionalPrice;
    });

    // Convert vendor map to array
    const groupedByVendor = Object.values(vendorMap);

    return res.json({
      groupedByVendor,
      weddingDate: project.weddingDate instanceof Date ? project.weddingDate.toISOString() : project.weddingDate,
      eventStartTime: project.eventStartTime || null,
      eventEndTime: project.eventEndTime || null,
      hasVenueSelected: Boolean(project.venueServiceListingId),
      venue: {
        serviceListingId: project.venueServiceListingId || null,
        booking: venueBookingStatus,
      },
    });
  } catch (err) {
    console.error('[checkout-summary] Error:', err);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

// Export updatePlannedSpend function for use in other route files
module.exports = router;
module.exports.updatePlannedSpend = updatePlannedSpend;


