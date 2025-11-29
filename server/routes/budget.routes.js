const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

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

  const totalRemaining = parseFloat(budget.totalBudget) - totalSpent;

  await prisma.budget.update({
    where: { id: budgetId },
    data: {
      totalSpent: totalSpent,
      totalRemaining: totalRemaining,
    },
  });

  return { totalSpent, totalRemaining };
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

    const data = updateBudgetSchema.parse(req.body);
    const updateData = {};
    
    if (data.totalBudget !== undefined) {
      updateData.totalBudget = data.totalBudget;
      // Recalculate totals
      const totals = await calculateBudgetTotals(req.params.id);
      updateData.totalSpent = totals.totalSpent;
      updateData.totalRemaining = totals.totalRemaining;
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

    await prisma.expense.delete({
      where: { id: req.params.expenseId },
    });

    // Recalculate budget totals
    await calculateBudgetTotals(req.params.budgetId);

    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

