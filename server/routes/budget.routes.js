const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

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

  // Check if project is completed
  if (project.status === 'completed') {
    const error = new Error('Completed projects cannot be modified');
    error.statusCode = 403;
    throw error;
  }

  // Check if wedding date has passed
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

// Validation schemas
const createBudgetSchema = z.object({
  projectId: z.string().uuid(),
  totalBudget: z.number().positive('Total budget must be positive'),
});

const updateBudgetSchema = z.object({
  totalBudget: z.number().positive('Total budget must be positive').optional(),
});

const createCategorySchema = z.object({
  budgetId: z.string().uuid(),
  categoryName: z.string().min(1, 'Category name is required').max(100, 'Category name is too long'),
});

const updateCategorySchema = z.object({
  categoryName: z.string().min(1).max(100).optional(),
});

const createExpenseSchema = z.object({
  categoryId: z.string().uuid(),
  expenseName: z.string().min(1, 'Expense name is required').max(200, 'Expense name is too long'),
  estimatedCost: z.number().nonnegative('Estimated cost must be non-negative'),
  actualCost: z.number().nonnegative('Actual cost must be non-negative').optional().nullable(),
  remark: z.string().max(500, 'Remark is too long').optional().nullable(),
});

const updateExpenseSchema = z.object({
  expenseName: z.string().min(1).max(200).optional(),
  estimatedCost: z.number().nonnegative().optional(),
  actualCost: z.number().nonnegative().optional().nullable(),
  remark: z.string().max(500).optional().nullable(),
  categoryId: z.string().uuid().optional(), // Allow moving expense to different category
});

// Helper function to calculate budget totals
const calculateBudgetTotals = async (budgetId) => {
  const categories = await prisma.budgetCategory.findMany({
    where: { budgetId },
    include: {
      expenses: true,
    },
  });

  let totalSpent = 0;
  categories.forEach(category => {
    category.expenses.forEach(expense => {
      if (expense.actualCost) {
        totalSpent += parseFloat(expense.actualCost);
      }
    });
  });

  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
  });

  // Calculate remaining: totalBudget - totalSpent - plannedSpend
  const plannedSpend = parseFloat(budget.plannedSpend || 0);
  const totalRemaining = parseFloat(budget.totalBudget) - totalSpent - plannedSpend;

  await prisma.budget.update({
    where: { id: budgetId },
    data: {
      totalSpent: totalSpent,
      totalRemaining: totalRemaining,
    },
  });

  return { totalSpent, plannedSpend, totalRemaining };
};

/**
 * GET /budgets/project/:projectId
 * Get budget for a specific project
 */
router.get('/project/:projectId', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    // Verify project belongs to couple
    const project = await prisma.weddingProject.findFirst({
      where: {
        id: req.params.projectId,
        coupleId: req.user.sub,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // First, get the budget to ensure it exists and belongs to the project
    let budget = await prisma.budget.findUnique({
      where: { projectId: req.params.projectId },
    });

    // If budget exists, verify it belongs to the correct project and fetch categories
    if (budget) {
      // Double-check: ensure budget's projectId matches the requested projectId
      if (budget.projectId !== req.params.projectId) {
        console.error(`Budget data integrity error: Budget ${budget.id} has projectId ${budget.projectId} but was queried for projectId ${req.params.projectId}`);
        return res.status(500).json({ error: 'Data integrity error detected' });
      }

      // Fetch categories explicitly filtered by budgetId to ensure data isolation
      const categories = await prisma.budgetCategory.findMany({
        where: { 
          budgetId: budget.id, // Explicitly filter by the budget's ID to ensure isolation
        },
        include: {
          expenses: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
      
      // Verify all categories belong to this budget
      const invalidCategories = categories.filter(cat => cat.budgetId !== budget.id);
      if (invalidCategories.length > 0) {
        console.error(`Data integrity error: Found ${invalidCategories.length} categories that don't belong to budget ${budget.id}`);
        // Filter out invalid categories
        budget = { ...budget, categories: categories.filter(cat => cat.budgetId === budget.id) };
      } else {
        budget = { ...budget, categories };
      }
    }

    // Create budget if it doesn't exist
    if (!budget) {
      budget = await prisma.budget.create({
        data: {
          projectId: req.params.projectId,
          totalBudget: 0,
          totalSpent: 0,
          totalRemaining: 0,
        },
        include: {
          categories: {
            include: {
              expenses: {
                orderBy: { createdAt: 'asc' },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    res.json(budget);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /budgets/:id
 * Update budget
 */
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const budget = await prisma.budget.findUnique({
      where: { id: req.params.id },
      include: {
        project: {
          select: { coupleId: true },
        },
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Verify budget belongs to couple's project
    if (budget.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if project can be modified (not completed and not past wedding date)
    await checkProjectCanBeModified(budget.projectId, req.user.sub);

    const data = updateBudgetSchema.parse(req.body);
    const updateData = {};
    
    if (data.totalBudget !== undefined) {
      updateData.totalBudget = data.totalBudget;
      // Recalculate totals
      const totals = await calculateBudgetTotals(req.params.id);
      updateData.totalSpent = totals.totalSpent;
      // Calculate totalRemaining using the NEW totalBudget value (not the old one from DB)
      const newTotalBudget = parseFloat(data.totalBudget);
      const currentPlannedSpend = parseFloat(budget.plannedSpend || 0);
      updateData.totalRemaining = newTotalBudget - totals.totalSpent - currentPlannedSpend;
    }

    const updatedBudget = await prisma.budget.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        categories: {
          include: {
            expenses: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    res.json(updatedBudget);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /budgets/:budgetId/categories
 * Create a new category
 */
router.post('/:budgetId/categories', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const budget = await prisma.budget.findUnique({
      where: { id: req.params.budgetId },
      include: {
        project: {
          select: { coupleId: true },
        },
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Verify budget belongs to couple's project
    if (budget.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if project can be modified (not completed and not past wedding date)
    await checkProjectCanBeModified(budget.projectId, req.user.sub);

    const data = createCategorySchema.parse({ ...req.body, budgetId: req.params.budgetId });

    const category = await prisma.budgetCategory.create({
      data: {
        budgetId: data.budgetId,
        categoryName: data.categoryName,
      },
      include: {
        expenses: true,
      },
    });

    res.status(201).json(category);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * PATCH /budgets/:budgetId/categories/:categoryId
 * Update a category
 */
router.patch('/:budgetId/categories/:categoryId', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const budget = await prisma.budget.findUnique({
      where: { id: req.params.budgetId },
      include: {
        project: {
          select: { coupleId: true },
        },
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Verify budget belongs to couple's project
    if (budget.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if project can be modified (not completed and not past wedding date)
    await checkProjectCanBeModified(budget.projectId, req.user.sub);

    const category = await prisma.budgetCategory.findFirst({
      where: {
        id: req.params.categoryId,
        budgetId: req.params.budgetId,
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const data = updateCategorySchema.parse(req.body);
    const updateData = {};
    
    if (data.categoryName !== undefined) updateData.categoryName = data.categoryName;

    const updatedCategory = await prisma.budgetCategory.update({
      where: { id: req.params.categoryId },
      data: updateData,
      include: {
        expenses: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    res.json(updatedCategory);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * DELETE /budgets/:budgetId/categories/:categoryId
 * Delete a category (cascades to expenses)
 */
router.delete('/:budgetId/categories/:categoryId', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const budget = await prisma.budget.findUnique({
      where: { id: req.params.budgetId },
      include: {
        project: {
          select: { coupleId: true },
        },
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Verify budget belongs to couple's project
    if (budget.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const category = await prisma.budgetCategory.findFirst({
      where: {
        id: req.params.categoryId,
        budgetId: req.params.budgetId,
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Delete category (expenses will be deleted automatically due to cascade)
    await prisma.budgetCategory.delete({
      where: { id: req.params.categoryId },
    });

    // Recalculate budget totals
    await calculateBudgetTotals(req.params.budgetId);

    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /budgets/:budgetId/categories/:categoryId/expenses
 * Create a new expense
 */
router.post('/:budgetId/categories/:categoryId/expenses', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const budget = await prisma.budget.findUnique({
      where: { id: req.params.budgetId },
      include: {
        project: {
          select: { coupleId: true },
        },
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Verify budget belongs to couple's project
    if (budget.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if project can be modified (not completed and not past wedding date)
    await checkProjectCanBeModified(budget.projectId, req.user.sub);

    const category = await prisma.budgetCategory.findFirst({
      where: {
        id: req.params.categoryId,
        budgetId: req.params.budgetId,
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const data = createExpenseSchema.parse({ ...req.body, categoryId: req.params.categoryId });

    const expense = await prisma.expense.create({
      data: {
        categoryId: data.categoryId,
        expenseName: data.expenseName,
        estimatedCost: data.estimatedCost,
        actualCost: data.actualCost || null,
        remark: data.remark || null,
      },
    });

    // Recalculate budget totals
    await calculateBudgetTotals(req.params.budgetId);

    res.status(201).json(expense);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * PATCH /budgets/:budgetId/categories/:categoryId/expenses/:expenseId
 * Update an expense
 */
router.patch('/:budgetId/categories/:categoryId/expenses/:expenseId', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const budget = await prisma.budget.findUnique({
      where: { id: req.params.budgetId },
      include: {
        project: {
          select: { coupleId: true },
        },
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Verify budget belongs to couple's project
    if (budget.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if project can be modified (not completed and not past wedding date)
    await checkProjectCanBeModified(budget.projectId, req.user.sub);

    const category = await prisma.budgetCategory.findFirst({
      where: {
        id: req.params.categoryId,
        budgetId: req.params.budgetId,
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const expense = await prisma.expense.findFirst({
      where: {
        id: req.params.expenseId,
        categoryId: req.params.categoryId,
      },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const data = updateExpenseSchema.parse(req.body);
    const updateData = {};
    
    if (data.expenseName !== undefined) updateData.expenseName = data.expenseName;
    if (data.estimatedCost !== undefined) updateData.estimatedCost = data.estimatedCost;
    if (data.actualCost !== undefined) updateData.actualCost = data.actualCost || null;
    if (data.remark !== undefined) updateData.remark = data.remark || null;
    
    // Handle category change (moving expense to different category)
    if (data.categoryId !== undefined && data.categoryId !== req.params.categoryId) {
      // Verify new category exists and belongs to same budget
      const newCategory = await prisma.budgetCategory.findFirst({
        where: {
          id: data.categoryId,
          budgetId: req.params.budgetId,
        },
      });
      
      if (!newCategory) {
        return res.status(404).json({ error: 'Target category not found' });
      }
      
      updateData.categoryId = data.categoryId;
    }

    const updatedExpense = await prisma.expense.update({
      where: { id: req.params.expenseId },
      data: updateData,
    });

    // Recalculate budget totals
    await calculateBudgetTotals(req.params.budgetId);

    res.json(updatedExpense);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * DELETE /budgets/:budgetId/categories/:categoryId/expenses/:expenseId
 * Delete an expense
 */
router.delete('/:budgetId/categories/:categoryId/expenses/:expenseId', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const budget = await prisma.budget.findUnique({
      where: { id: req.params.budgetId },
      include: {
        project: {
          select: { coupleId: true },
        },
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Verify budget belongs to couple's project
    if (budget.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if project can be modified (not completed and not past wedding date)
    await checkProjectCanBeModified(budget.projectId, req.user.sub);

    const category = await prisma.budgetCategory.findFirst({
      where: {
        id: req.params.categoryId,
        budgetId: req.params.budgetId,
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const expense = await prisma.expense.findFirst({
      where: {
        id: req.params.expenseId,
        categoryId: req.params.categoryId,
      },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Prevent deletion of expenses from 3D design if still in design or booked
    if (expense.from3DDesign) {
      // Check if placed element still exists in 3D design
      if (expense.placedElementId) {
        const placedElement = await prisma.placedElement.findUnique({
          where: { id: expense.placedElementId },
        });

        if (placedElement) {
          return res.status(400).json({
            error: 'Cannot delete expense linked to 3D design. Remove the service from 3D design first.',
          });
        }
      }

      // Check if booking exists and is not cancelled
      if (expense.bookingId && expense.booking) {
        const cancelledStatuses = ['cancelled_by_couple', 'cancelled_by_vendor', 'rejected'];
        if (!cancelledStatuses.includes(expense.booking.status)) {
          return res.status(400).json({
            error: 'Cannot delete expense linked to active booking. Cancel the booking first.',
          });
        }
      }
    }

    await prisma.expense.delete({
      where: { id: req.params.expenseId },
    });

    // Recalculate budget totals
    await calculateBudgetTotals(req.params.budgetId);

    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * PATCH /budgets/:budgetId/planned-spend
 * Update planned spend (from 3D design)
 */
router.patch('/:budgetId/planned-spend', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const budget = await prisma.budget.findUnique({
      where: { id: req.params.budgetId },
      include: {
        project: {
          select: { coupleId: true },
        },
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Verify budget belongs to couple's project
    if (budget.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { plannedSpend } = z.object({
      plannedSpend: z.number().min(0),
    }).parse(req.body);

    const updatedBudget = await prisma.budget.update({
      where: { id: req.params.budgetId },
      data: {
        plannedSpend: plannedSpend,
        totalRemaining: parseFloat(budget.totalBudget) - parseFloat(budget.totalSpent) - plannedSpend,
      },
    });

    res.json(updatedBudget);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', issues: err.issues });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /budgets/:budgetId/move-from-3d
 * Move a 3D design item to a budget category
 */
router.post('/:budgetId/move-from-3d', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const budget = await prisma.budget.findUnique({
      where: { id: req.params.budgetId },
      include: {
        project: {
          select: { coupleId: true },
        },
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Verify budget belongs to couple's project
    if (budget.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if project can be modified
    await checkProjectCanBeModified(budget.projectId, req.user.sub);

    const schema = z.object({
      categoryId: z.string().min(1),
      placedElementId: z.string().nullable().optional(), // Nullable for per-table services
      placedElementIds: z.array(z.string()).optional(), // All placement IDs for grouped items
      serviceListingId: z.string().min(1),
      expenseName: z.string().min(1),
      estimatedCost: z.number().min(0),
      actualCost: z.number().min(0).nullable().optional(),
      markAsPaid: z.boolean().optional().default(false),
    });

    const data = schema.parse(req.body);

    // Verify category exists and belongs to this budget
    const category = await prisma.budgetCategory.findFirst({
      where: {
        id: data.categoryId,
        budgetId: req.params.budgetId,
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // For per-table services, placedElementId might be null
    // Verify placed element exists (if provided)
    let placedElement = null;
    if (data.placedElementId) {
      placedElement = await prisma.placedElement.findUnique({
        where: { id: data.placedElementId },
        include: {
          venueDesign: {
            include: {
              project: {
                select: { id: true },
              },
            },
          },
        },
      });

      if (!placedElement) {
        return res.status(404).json({ error: 'Placed element not found' });
      }

      // Verify placed element belongs to this project
      if (placedElement.venueDesign.project.id !== budget.projectId) {
        return res.status(403).json({ error: 'Placed element does not belong to this project' });
      }
    }
    
    // For per-table services (no placedElementId), verify serviceListingId exists and belongs to project
    if (!data.placedElementId && data.serviceListingId) {
      const serviceListing = await prisma.serviceListing.findFirst({
        where: {
          id: data.serviceListingId,
          pricingPolicy: 'per_table',
        },
      });
      
      if (!serviceListing) {
        return res.status(404).json({ error: 'Per-table service listing not found' });
      }
    }

    // Check if booking exists for this service
    let bookingId = null;
    if (data.serviceListingId) {
      const booking = await prisma.booking.findFirst({
        where: {
          projectId: budget.projectId,
          selectedServices: {
            some: {
              serviceListingId: data.serviceListingId,
            },
          },
        },
        select: { id: true },
      });
      bookingId = booking?.id || null;
    }

    // Check if there's already an expense for this service in this category
    // This allows grouping multiple instances of the same service into one expense
    const existingExpense = await prisma.expense.findFirst({
      where: {
        categoryId: data.categoryId,
        serviceListingId: data.serviceListingId,
        from3DDesign: true,
        // Only group if they're in the same category and from 3D design
      },
      include: {
        category: true,
      },
    });

    let expense;
    let estimatedCostChange = data.estimatedCost;
    let actualCostChange = 0;

    if (existingExpense) {
      // Update existing expense: merge costs and update name
      const newEstimatedCost = parseFloat(existingExpense.estimatedCost || 0) + parseFloat(data.estimatedCost);
      const newActualCost = data.markAsPaid
        ? parseFloat(existingExpense.actualCost || 0) + parseFloat(data.actualCost || data.estimatedCost)
        : parseFloat(existingExpense.actualCost || 0);

      // Update expense name to reflect quantity (extract number if present, increment)
      const nameMatch = existingExpense.expenseName.match(/^(.+?)(\s*\((\d+)\))?$/);
      const baseName = nameMatch ? nameMatch[1] : existingExpense.expenseName;
      const currentQuantity = nameMatch && nameMatch[3] ? parseInt(nameMatch[3], 10) : 1;
      const newQuantity = currentQuantity + 1;
      const updatedName = newQuantity > 1 ? `${baseName} (${newQuantity})` : baseName;

      // Merge placement IDs when updating existing expense
      let existingPlacementIds = [existingExpense.placedElementId].filter(Boolean);
      // Check placedElementIds JSON field first, then fall back to remark (for migration)
      if (existingExpense.placedElementIds && Array.isArray(existingExpense.placedElementIds)) {
        existingPlacementIds = existingExpense.placedElementIds;
      } else {
        // Fallback: check remark field for old data
        try {
          if (existingExpense.remark) {
            const remarkData = JSON.parse(existingExpense.remark);
            if (remarkData.placedElementIds && Array.isArray(remarkData.placedElementIds)) {
              existingPlacementIds = remarkData.placedElementIds;
            }
          }
        } catch (e) {
          // If remark is not JSON, ignore and use placedElementId only
        }
      }
      
      const newPlacementIds = data.placedElementIds && data.placedElementIds.length > 0
        ? data.placedElementIds
        : [data.placedElementId];
      const mergedPlacementIds = [...new Set([...existingPlacementIds, ...newPlacementIds])];
      
      // Clean up remark field if it contains placement IDs (migrate old data)
      let cleanedRemark = existingExpense.remark;
      try {
        if (existingExpense.remark) {
          const remarkData = JSON.parse(existingExpense.remark);
          if (remarkData.placedElementIds) {
            // Remove placement IDs from remark since they're now in placedElementIds field
            delete remarkData.placedElementIds;
            // If remark only had placement IDs, clear it; otherwise keep other data
            if (Object.keys(remarkData).length === 0) {
              cleanedRemark = null;
            } else {
              cleanedRemark = JSON.stringify(remarkData);
            }
          }
        }
      } catch (e) {
        // Not JSON, keep remark as is
      }
      
      expense = await prisma.expense.update({
        where: { id: existingExpense.id },
        data: {
          expenseName: updatedName,
          estimatedCost: newEstimatedCost,
          actualCost: newActualCost > 0 ? newActualCost : null,
          placedElementIds: mergedPlacementIds, // Store all placement IDs in proper JSON field
          remark: cleanedRemark, // Clean up remark field
        },
      });

      // Calculate changes for budget update
      estimatedCostChange = data.estimatedCost; // Still need to remove from plannedSpend
      actualCostChange = data.markAsPaid ? parseFloat(data.actualCost || data.estimatedCost) : 0;
    } else {
      // Create new expense
      // Store all placement IDs in the proper placedElementIds JSON field
      const placementIds = data.placedElementIds && data.placedElementIds.length > 0 
        ? data.placedElementIds 
        : [data.placedElementId];
      
      expense = await prisma.expense.create({
        data: {
          categoryId: data.categoryId,
          expenseName: data.expenseName,
          estimatedCost: data.estimatedCost,
          actualCost: data.markAsPaid ? (data.actualCost || data.estimatedCost) : null,
          from3DDesign: true,
          placedElementId: data.placedElementId, // Keep first one for backward compatibility
          placedElementIds: placementIds, // Store all placement IDs in proper JSON field
          serviceListingId: data.serviceListingId,
          bookingId: bookingId,
          remark: null, // Don't store placement IDs in remark
        },
      });

      estimatedCostChange = data.estimatedCost;
      actualCostChange = data.markAsPaid ? parseFloat(data.actualCost || data.estimatedCost) : 0;
    }

    // Update planned spend (remove from planned, add to spent if marked as paid)
    const newPlannedSpend = Math.max(0, parseFloat(budget.plannedSpend || 0) - estimatedCostChange);
    const newTotalSpent = actualCostChange > 0
      ? parseFloat(budget.totalSpent || 0) + actualCostChange
      : parseFloat(budget.totalSpent || 0);

    await prisma.budget.update({
      where: { id: req.params.budgetId },
      data: {
        plannedSpend: newPlannedSpend,
        totalSpent: newTotalSpent,
        totalRemaining: parseFloat(budget.totalBudget) - newTotalSpent - newPlannedSpend,
      },
    });

    // Recalculate budget totals to ensure consistency
    await calculateBudgetTotals(req.params.budgetId);

    res.json(expense);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', issues: err.issues });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * GET /budgets/:budgetId/expenses/:expenseId/payments
 * Get payment breakdown for an expense (if linked to booking)
 */
router.get('/:budgetId/expenses/:expenseId/payments', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const budget = await prisma.budget.findUnique({
      where: { id: req.params.budgetId },
      include: {
        project: {
          select: { coupleId: true },
        },
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Verify budget belongs to couple's project
    if (budget.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const expense = await prisma.expense.findFirst({
      where: {
        id: req.params.expenseId,
        category: {
          budgetId: req.params.budgetId,
        },
      },
      include: {
        booking: {
          include: {
            payments: {
              orderBy: { paymentDate: 'asc' },
              select: {
                id: true,
                paymentType: true,
                amount: true,
                paymentDate: true,
                paymentMethod: true,
                receipt: true,
              },
            },
          },
        },
      },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    if (expense.bookingId && expense.booking) {
      // Map payment fields to match frontend expectations
      const payments = expense.booking.payments.map((p) => ({
        id: p.id,
        type: p.paymentType, // Map paymentType to type for frontend
        amount: p.amount,
        createdAt: p.paymentDate, // Map paymentDate to createdAt for frontend
        paymentMethod: p.paymentMethod,
        receipt: p.receipt,
      }));
      
      res.json({
        payments,
        totalPaid: payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0),
      });
    } else {
      res.json({
        payments: [],
        totalPaid: expense.actualCost ? parseFloat(expense.actualCost) : 0,
      });
    }
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;

