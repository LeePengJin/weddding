const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
const { applyPackageDesignToProject } = require('../services/package.service');
const notificationService = require('../services/notificationService');

const router = express.Router();
const prisma = new PrismaClient();

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
const BASE_PACKAGE_INCLUDE = {
  items: {
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
};

// Validation schemas
const createProjectSchema = z.object({
  projectName: z.string().min(1, 'Project name is required').max(100, 'Project name is too long'),
  weddingDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)),
  eventStartTime: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)).optional().nullable(),
  eventEndTime: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)).optional().nullable(),
  weddingType: z.enum(['self_organized', 'prepackaged']),
  venueServiceListingId: z.string().uuid().optional().nullable(),
  basePackageId: z.string().uuid().optional().nullable(),
  totalBudget: z.number().min(0).optional().nullable(),
}).refine((data) => {
  if (data.eventStartTime && !data.eventEndTime) {
    return false;
  }
  if (data.eventEndTime && !data.eventStartTime) {
    return false;
  }
  if (data.eventStartTime && data.eventEndTime) {
    const start = new Date(data.eventStartTime);
    const end = new Date(data.eventEndTime);
    return end > start;
  }
  return true;
}, {
  message: 'Event end time must be after start time',
  path: ['eventEndTime'],
});

const updateProjectSchema = z.object({
  projectName: z.string().min(1).max(100).optional(),
  weddingDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)).optional(),
  eventStartTime: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)).optional().nullable(),
  eventEndTime: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)).optional().nullable(),
  weddingType: z.enum(['self_organized', 'prepackaged']).optional(),
  venueServiceListingId: z.string().uuid().optional().nullable(),
  basePackageId: z.string().uuid().optional().nullable(),
  status: z.enum(['draft', 'ready_to_book', 'booked', 'completed']).optional(),
}).refine((data) => {
  if (data.eventStartTime !== undefined && data.eventEndTime === undefined) {
    return false;
  }
  if (data.eventEndTime !== undefined && data.eventStartTime === undefined) {
    return false;
  }
  if (data.eventStartTime && data.eventEndTime) {
    const start = new Date(data.eventStartTime);
    const end = new Date(data.eventEndTime);
    return end > start;
  }
  return true;
}, {
  message: 'Event end time must be after start time',
  path: ['eventEndTime'],
});

/**
 * GET /projects
 * Get all wedding projects for the authenticated couple
 * Auto-updates projects past their wedding date to 'completed' status
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Auto-update projects past their wedding date to 'completed' status
    await prisma.weddingProject.updateMany({
      where: {
        coupleId: req.user.sub,
        weddingDate: {
          lt: today,
        },
        status: {
          not: 'completed',
        },
      },
      data: {
        status: 'completed',
      },
    });

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
      basePackage: {
        include: BASE_PACKAGE_INCLUDE,
      },
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
        basePackage: {
          include: BASE_PACKAGE_INCLUDE,
        },
        venueDesign: true,
        budget: true,
        tasks: {
          include: {
            subtasks: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { dueDate: 'asc' },
        },
        bookings: {
          include: {
            vendor: {
              select: {
                userId: true,
                category: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            selectedServices: {
              include: {
                serviceListing: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            cancellation: true,
          },
          orderBy: {
            bookingDate: 'desc',
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

    // If base package is provided, ensure it is published and healthy
    if (data.basePackageId) {
      const basePackage = await prisma.weddingPackage.findFirst({
        where: {
          id: data.basePackageId,
          status: 'published',
        },
        select: {
          id: true,
          invalidListingIds: true,
        },
      });

      if (!basePackage) {
        return res.status(404).json({ error: 'Base package is not available' });
      }

      if (basePackage.invalidListingIds && basePackage.invalidListingIds.length > 0) {
        return res.status(400).json({ error: 'Selected package requires vendor updates. Please choose another package.' });
      }
    }

    const project = await prisma.weddingProject.create({
      data: {
        coupleId: req.user.sub,
        projectName: data.projectName,
        weddingDate: new Date(data.weddingDate),
        eventStartTime: data.eventStartTime ? new Date(data.eventStartTime) : null,
        eventEndTime: data.eventEndTime ? new Date(data.eventEndTime) : null,
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
        basePackage: {
          include: BASE_PACKAGE_INCLUDE,
        },
      },
    });

    // Ensure each project has its own budget record as soon as it is created
    const totalBudget = data.totalBudget || 0;
    const budget = await prisma.budget.upsert({
      where: { projectId: project.id },
      update: {},
      create: {
        projectId: project.id,
        totalBudget: totalBudget,
        totalSpent: 0,
        plannedSpend: 0,
        totalRemaining: totalBudget,
      },
    });

    // If venue is selected, create a venue expense record
    if (project.venueServiceListingId && project.venueServiceListing) {
      const venuePrice = parseFloat(project.venueServiceListing.price || 0);
      
      if (venuePrice > 0) {
        // Find or create a "Venue" category
        let venueCategory = await prisma.budgetCategory.findFirst({
          where: {
            budgetId: budget.id,
            categoryName: 'Venue',
          },
        });

        if (!venueCategory) {
          venueCategory = await prisma.budgetCategory.create({
            data: {
              budgetId: budget.id,
              categoryName: 'Venue',
            },
          });
        }

        // Create venue expense (if it doesn't already exist)
        const existingVenueExpense = await prisma.expense.findFirst({
          where: {
            categoryId: venueCategory.id,
            serviceListingId: project.venueServiceListingId,
            from3DDesign: false, 
          },
        });

        if (!existingVenueExpense) {
          await prisma.expense.create({
            data: {
              categoryId: venueCategory.id,
              expenseName: project.venueServiceListing.name || 'Venue',
              estimatedCost: venuePrice,
              actualCost: null, 
              serviceListingId: project.venueServiceListingId,
              from3DDesign: false, 
              placedElementId: null,
              bookingId: null, 
            },
          });
        }
      }
    }

    if (data.basePackageId) {
      await applyPackageDesignToProject(prisma, data.basePackageId, project.id);
    }

    res.status(201).json({ ...project, budget });
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

    // Prevent modifications to completed projects or projects past wedding date
    if (existingProject.status === 'completed') {
      return res.status(403).json({ error: 'Completed projects cannot be modified' });
    }
    
    if (existingProject.weddingDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weddingDate = new Date(existingProject.weddingDate);
      weddingDate.setHours(0, 0, 0, 0);
      
      if (weddingDate < today) {
        return res.status(403).json({ error: 'Projects past their wedding date cannot be modified' });
      }
    }

    const data = updateProjectSchema.parse(req.body);

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
    let newVenueService = null;
    if (data.venueServiceListingId !== undefined) {
      if (data.venueServiceListingId) {
        newVenueService = await prisma.serviceListing.findFirst({
          where: {
            id: data.venueServiceListingId,
            category: 'Venue',
            isActive: true,
          },
        });

        if (!newVenueService) {
          return res.status(404).json({ error: 'Venue service not found or inactive' });
        }
      }
    }

    // Restrict venue changes:
    // - Initial venue set (existingProject.venueServiceListingId is null) is allowed.
    // - Changing an already-selected venue is ONLY allowed when the venue vendor cancelled the booking.
    if (
      data.venueServiceListingId !== undefined &&
      data.venueServiceListingId &&
      existingProject.venueServiceListingId &&
      data.venueServiceListingId !== existingProject.venueServiceListingId
    ) {
      // If there's still any active venue booking/request, do not allow changing.
      const activeVenueBooking = await prisma.booking.findFirst({
        where: {
          projectId: existingProject.id,
          status: {
            notIn: ['cancelled_by_vendor', 'cancelled_by_couple', 'rejected'],
          },
          selectedServices: {
            some: {
              serviceListing: {
                category: 'Venue',
              },
            },
          },
        },
        select: { id: true, status: true },
      });
      if (activeVenueBooking) {
        return res.status(403).json({
          error: 'Venue cannot be changed after booking. Please contact support if you need help.',
        });
      }

      // Require vendor-cancelled venue booking for current venue
      const vendorCancelledVenueBooking = await prisma.booking.findFirst({
        where: {
          projectId: existingProject.id,
          status: 'cancelled_by_vendor',
          selectedServices: {
            some: {
              serviceListingId: existingProject.venueServiceListingId,
            },
          },
        },
        select: { id: true },
      });

      if (!vendorCancelledVenueBooking) {
        return res.status(403).json({
          error: 'You can only change venue if the venue vendor cancels the booking.',
        });
      }
    }

    if (data.basePackageId !== undefined && data.basePackageId) {
      const basePackage = await prisma.weddingPackage.findFirst({
        where: {
          id: data.basePackageId,
          status: 'published',
        },
        select: {
          id: true,
          invalidListingIds: true,
        },
      });

      if (!basePackage) {
        return res.status(404).json({ error: 'Base package is not available' });
      }

      if (basePackage.invalidListingIds && basePackage.invalidListingIds.length > 0) {
        return res.status(400).json({ error: 'Selected package requires vendor updates. Please choose another package.' });
      }
    }

    const updateData = {};
    if (data.projectName) updateData.projectName = data.projectName;
    if (data.weddingDate) updateData.weddingDate = new Date(data.weddingDate);
    if (data.eventStartTime !== undefined) updateData.eventStartTime = data.eventStartTime ? new Date(data.eventStartTime) : null;
    if (data.eventEndTime !== undefined) updateData.eventEndTime = data.eventEndTime ? new Date(data.eventEndTime) : null;
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
        basePackage: {
          include: BASE_PACKAGE_INCLUDE,
        },
      },
    });

    // If venue is being updated, also update the venueDesign venueName if it exists
    // and create/update venue expense in budget
    if (data.venueServiceListingId !== undefined) {
      if (project.venueServiceListing) {
      const venueDesign = await prisma.venueDesign.findUnique({
        where: { projectId: project.id },
      });
      
      if (venueDesign) {
        await prisma.venueDesign.update({
          where: { id: venueDesign.id },
          data: {
            venueName: project.venueServiceListing.name,
          },
        });
        }

        // Create or update venue expense in budget
        const budget = await prisma.budget.findUnique({
          where: { projectId: project.id },
        });

        if (budget) {
          const venuePrice = parseFloat(project.venueServiceListing.price || 0);
          
          if (venuePrice > 0) {
            // Find or create a "Venue" category
            let venueCategory = await prisma.budgetCategory.findFirst({
              where: {
                budgetId: budget.id,
                categoryName: 'Venue',
              },
            });

            if (!venueCategory) {
              venueCategory = await prisma.budgetCategory.create({
                data: {
                  budgetId: budget.id,
                  categoryName: 'Venue',
                },
              });
            }

            // Check if there's an existing venue expense for the old venue
            const oldVenueExpense = await prisma.expense.findFirst({
              where: {
                categoryId: venueCategory.id,
                from3DDesign: false,
                serviceListingId: { not: project.venueServiceListingId }, // Old venue
              },
            });

            // If venue changed and old expense exists (and not booked), update it
            // Otherwise, create a new expense for the new venue
            const venueChanged = existingProject.venueServiceListingId !== project.venueServiceListingId;
            if (oldVenueExpense && !oldVenueExpense.bookingId && venueChanged) {
              // Update existing expense to new venue
              await prisma.expense.update({
                where: { id: oldVenueExpense.id },
                data: {
                  expenseName: project.venueServiceListing.name || 'Venue',
                  estimatedCost: venuePrice,
                  serviceListingId: project.venueServiceListingId,
                },
              });
            } else {
              // Check if expense for new venue already exists
              const existingVenueExpense = await prisma.expense.findFirst({
                where: {
                  categoryId: venueCategory.id,
                  serviceListingId: project.venueServiceListingId,
                  from3DDesign: false,
                },
              });

              if (!existingVenueExpense) {
                // Create new expense for new venue
                await prisma.expense.create({
                  data: {
                    categoryId: venueCategory.id,
                    expenseName: project.venueServiceListing.name || 'Venue',
                    estimatedCost: venuePrice,
                    actualCost: null,
                    serviceListingId: project.venueServiceListingId,
                    from3DDesign: false,
                    placedElementId: null,
                    bookingId: null,
                  },
                });
              }
            }
          }
        }
      } else if (data.venueServiceListingId === null) {
        // Venue was removed - we could delete the expense, but it's safer to leave it
        // in case there's a booking linked to it
        // Just leave it as is for now
      }

      // Handle replacement venue logic for dependent bookings
      // (This was originally here, moved inside the venueServiceListing check)
      if (project.venueServiceListing && project.weddingDate) {
        const weddingDate = project.weddingDate instanceof Date ? project.weddingDate : new Date(project.weddingDate);
        const startOfDay = new Date(weddingDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(weddingDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Find active venue booking for the new venue
        // Only consider bookings that are accepted or later (pending_deposit_payment or later)
        // This is consistent with the venue-first rule: venue is "booked" when accepted
        // Note: Dependent bookings are primarily updated when venue booking is accepted (in status update route)
        // This check serves as a fallback in case project is updated after venue acceptance
        const newVenueBooking = await prisma.booking.findFirst({
          where: {
            projectId: project.id,
            reservedDate: {
              gte: startOfDay,
              lte: endOfDay,
            },
            status: {
              in: ['pending_deposit_payment', 'confirmed', 'pending_final_payment', 'completed'],
            },
            selectedServices: {
              some: {
                serviceListing: {
                  category: 'Venue',
              },
            },
            },
          },
          include: {
            selectedServices: {
              include: {
                serviceListing: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        // If there's an active venue booking, update dependent bookings
        if (newVenueBooking) {
          // Find all dependent bookings waiting for venue replacement
          const dependentBookings = await prisma.booking.findMany({
            where: {
              projectId: project.id,
              isPendingVenueReplacement: true,
              status: {
                notIn: ['cancelled_by_couple', 'cancelled_by_vendor', 'rejected', 'completed'],
              },
            },
            include: {
              vendor: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
              selectedServices: {
                include: {
                  serviceListing: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          });

          // Update each dependent booking
          for (const dependentBooking of dependentBookings) {
            const today = new Date();
            const weddingDateObj = weddingDate instanceof Date ? weddingDate : new Date(weddingDate);

            // Recalculate deposit due date
            let newDepositDueDate = null;
            if (dependentBooking.originalDepositDueDate && dependentBooking.venueCancellationDate) {
              const originalDepositDue = new Date(dependentBooking.originalDepositDueDate);
              const cancellationDate = new Date(dependentBooking.venueCancellationDate);
              
              // Calculate remaining days from cancellation to original due date
              const remainingDays = Math.ceil((originalDepositDue - cancellationDate) / (1000 * 60 * 60 * 24));
              
              // New due date = today + remaining days
              newDepositDueDate = new Date(today);
              newDepositDueDate.setDate(today.getDate() + remainingDays);
              
              // Cap at wedding date - 1 day
              const maxDepositDue = new Date(weddingDateObj);
              maxDepositDue.setDate(weddingDateObj.getDate() - 1);
              if (newDepositDueDate > maxDepositDue) {
                newDepositDueDate = maxDepositDue;
              }
            } else if (dependentBooking.depositDueDate) {
              // Fallback: use current deposit due date or set to standard policy
              newDepositDueDate = new Date(today);
              newDepositDueDate.setDate(today.getDate() + 7); // 7 days standard
            }

            // Recalculate final due date (always one week before wedding)
            let newFinalDueDate = new Date(weddingDateObj);
            newFinalDueDate.setDate(weddingDateObj.getDate() - 7);
            
            // If final due date already passed, set to wedding date - 1 day
            if (newFinalDueDate < today) {
              newFinalDueDate = new Date(weddingDateObj);
              newFinalDueDate.setDate(weddingDateObj.getDate() - 1);
            }

            // Update booking
            await prisma.booking.update({
              where: { id: dependentBooking.id },
              data: {
                isPendingVenueReplacement: false,
                dependsOnVenueBookingId: newVenueBooking.id,
                depositDueDate: newDepositDueDate,
                finalDueDate: newFinalDueDate,
                originalDepositDueDate: null,
                originalFinalDueDate: null,
                venueCancellationDate: null,
                gracePeriodEndDate: null,
              },
            });

            // Send notification to vendor
            notificationService.sendVenueReplacementFoundNotification(
              dependentBooking,
              newVenueBooking
            ).catch((err) => {
              console.error(`Error sending venue replacement notification to vendor for booking ${dependentBooking.id}:`, err);
            });
          }

          if (dependentBookings.length > 0) {
            console.log(`✅ Updated ${dependentBookings.length} dependent booking(s) with new venue booking ${newVenueBooking.id}`);
          }
        }
      }
    }

    if (data.basePackageId) {
      await applyPackageDesignToProject(prisma, data.basePackageId, project.id);
    }

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

    const project = await prisma.weddingProject.findFirst({
      where: {
        id: req.params.id,
        coupleId: req.user.sub,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if project has any bookings - projects with bookings cannot be deleted
    const bookingCount = await prisma.booking.count({
      where: {
        projectId: req.params.id,
      },
    });

    if (bookingCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete project with bookings. Projects with bookings are kept as records.',
      });
    }


    await prisma.weddingProject.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /projects/:projectId/services/:serviceListingId
 * Update quantity of a non-3D service (ProjectService) in a project, only if not booked.
 */
router.patch('/:projectId/services/:serviceListingId', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const { projectId, serviceListingId } = req.params;
    const { quantity } = req.body;

    if (typeof quantity !== 'number' || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be a positive integer' });
    }

    // Ensure project belongs to this couple
    const project = await prisma.weddingProject.findFirst({
      where: {
        id: projectId,
        coupleId: req.user.sub,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if project is completed or past wedding date
    if (project.status === 'completed') {
      return res.status(403).json({ error: 'Completed projects cannot be modified' });
    }
    
    if (project.weddingDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weddingDate = new Date(project.weddingDate);
      weddingDate.setHours(0, 0, 0, 0);
      
      if (weddingDate < today) {
        return res.status(403).json({ error: 'Projects past their wedding date cannot be modified' });
      }
    }

    const projectService = await prisma.projectService.findUnique({
      where: {
        projectId_serviceListingId: {
          projectId,
          serviceListingId,
        },
      },
    });

    if (!projectService) {
      return res.status(404).json({ error: 'Service not found in this project' });
    }

    if (projectService.isBooked) {
      return res.status(400).json({
        error:
          'This service is part of a booking and cannot be modified. Please contact your vendor if you need to change a booked service.',
      });
    }

    // Check if service is exclusive - exclusive services can only have quantity 1
    const serviceListing = await prisma.serviceListing.findUnique({
      where: { id: serviceListingId },
      select: { availabilityType: true },
    });

    if (serviceListing?.availabilityType === 'exclusive' && quantity !== 1) {
      return res.status(400).json({
        error: 'This is an exclusive service. Only one booking per day is allowed, so the quantity must be 1.',
      });
    }

    const updated = await prisma.projectService.update({
      where: {
        projectId_serviceListingId: {
          projectId,
          serviceListingId,
        },
      },
      data: {
        quantity,
      },
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
    });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /projects/:projectId/services/:serviceListingId
 * Remove a non-3D service (ProjectService) from a project, only if not booked.
 */
router.delete('/:projectId/services/:serviceListingId', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const { projectId, serviceListingId } = req.params;

    // Ensure project belongs to this couple
    const project = await prisma.weddingProject.findFirst({
      where: {
        id: projectId,
        coupleId: req.user.sub,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if project is completed or past wedding date
    if (project.status === 'completed') {
      return res.status(403).json({ error: 'Completed projects cannot be modified' });
    }
    
    if (project.weddingDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weddingDate = new Date(project.weddingDate);
      weddingDate.setHours(0, 0, 0, 0);
      
      if (weddingDate < today) {
        return res.status(403).json({ error: 'Projects past their wedding date cannot be modified' });
      }
    }

    const projectService = await prisma.projectService.findUnique({
      where: {
        projectId_serviceListingId: {
          projectId,
          serviceListingId,
        },
      },
    });

    if (!projectService) {
      return res.status(404).json({ error: 'Service not found in this project' });
    }

    if (projectService.isBooked) {
      return res.status(400).json({
        error:
          'This service is part of a booking and cannot be removed from the project. Please contact your vendor if you need to change a booked service.',
      });
    }

    await prisma.projectService.delete({
      where: {
        projectId_serviceListingId: {
          projectId,
          serviceListingId,
        },
      },
    });

    // Update planned spend in background (non-3D services affect budget)
    // Wait for update to complete so frontend gets fresh data
    const venueDesignRoutes = require('./venueDesign.routes');
    if (venueDesignRoutes.updatePlannedSpend) {
      await venueDesignRoutes.updatePlannedSpend(projectId);
    }

    return res.json({ message: 'Service removed from project successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

