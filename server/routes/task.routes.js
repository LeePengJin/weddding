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

// Helper function to check for SQL injection patterns
const containsSQLInjection = (str) => {
  if (!str) return false;
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
    /(--|;|\/\*|\*\/|xp_|sp_)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\s+['"]\w+['"]\s*=\s*['"]\w+['"])/i,
  ];
  return sqlPatterns.some(pattern => pattern.test(str));
};

// Validation schemas
const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  taskName: z.string()
    .min(1, 'Task name is required')
    .max(100, 'Task name must be 100 characters or less')
    .refine((val) => !containsSQLInjection(val), {
      message: 'Task name contains invalid characters',
    }),
  description: z.string()
    .max(2000, 'Description must be 2000 characters or less')
    .refine((val) => !val || !containsSQLInjection(val), {
      message: 'Description contains invalid characters',
    })
    .optional()
    .nullable(),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
});

const updateTaskSchema = z.object({
  taskName: z.string()
    .min(1, 'Task name is required')
    .max(100, 'Task name must be 100 characters or less')
    .refine((val) => !containsSQLInjection(val), {
      message: 'Task name contains invalid characters',
    })
    .optional(),
  description: z.string()
    .max(2000, 'Description must be 2000 characters or less')
    .refine((val) => !val || !containsSQLInjection(val), {
      message: 'Description contains invalid characters',
    })
    .optional()
    .nullable(),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
  isCompleted: z.boolean().optional(),
});

const createSubtaskSchema = z.object({
  taskId: z.string().uuid(),
  description: z.string()
    .min(1, 'Subtask description is required')
    .max(1000, 'Subtask description must be 1000 characters or less')
    .refine((val) => !containsSQLInjection(val), {
      message: 'Subtask description contains invalid characters',
    }),
});

const updateSubtaskSchema = z.object({
  description: z.string()
    .min(1, 'Subtask description is required')
    .max(1000, 'Subtask description must be 1000 characters or less')
    .refine((val) => !containsSQLInjection(val), {
      message: 'Subtask description contains invalid characters',
    })
    .optional(),
  isCompleted: z.boolean().optional(),
});

/**
 * GET /tasks/project/:projectId
 * Get all tasks for a specific project
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

    const tasks = await prisma.task.findMany({
      where: { projectId: req.params.projectId },
      include: {
        subtasks: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /tasks/:id
 * Get a specific task with subtasks
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const task = await prisma.task.findFirst({
      where: { id: req.params.id },
      include: {
        project: {
          select: { coupleId: true },
        },
        subtasks: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify task belongs to couple's project
    if (task.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Remove project info from response
    const { project, ...taskData } = task;
    res.json(taskData);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /tasks
 * Create a new task
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const data = createTaskSchema.parse(req.body);

    const project = await prisma.weddingProject.findFirst({
      where: {
        id: data.projectId,
        coupleId: req.user.sub,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if project can be modified (not completed and not past wedding date)
    await checkProjectCanBeModified(data.projectId, req.user.sub);

    const task = await prisma.task.create({
      data: {
        projectId: data.projectId,
        taskName: data.taskName,
        description: data.description || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        isCompleted: false,
      },
      include: {
        subtasks: true,
      },
    });

    res.status(201).json(task);
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
 * PATCH /tasks/:id
 * Update a task
 */
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const task = await prisma.task.findFirst({
      where: { id: req.params.id },
      include: {
        project: {
          select: { coupleId: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify task belongs to couple's project
    if (task.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if project can be modified (not completed and not past wedding date)
    await checkProjectCanBeModified(task.projectId, req.user.sub);

    const data = updateTaskSchema.parse(req.body);
    const updateData = {};
    
    if (data.taskName !== undefined) updateData.taskName = data.taskName;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.isCompleted !== undefined) {
      updateData.isCompleted = data.isCompleted;
      
      // If marking task as complete, mark all subtasks as complete
      // If marking task as incomplete, unmark all subtasks
      await prisma.subtask.updateMany({
        where: { taskId: req.params.id },
        data: { isCompleted: data.isCompleted },
      });
    }

    const updatedTask = await prisma.task.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        subtasks: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    res.json(updatedTask);
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
 * DELETE /tasks/:id
 * Delete a task (cascades to subtasks)
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const task = await prisma.task.findFirst({
      where: { id: req.params.id },
      include: {
        project: {
          select: { coupleId: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify task belongs to couple's project
    if (task.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if project can be modified (not completed and not past wedding date)
    await checkProjectCanBeModified(task.projectId, req.user.sub);

    // Delete task (subtasks will be deleted automatically due to cascade)
    await prisma.task.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /tasks/:taskId/subtasks
 * Create a new subtask
 */
router.post('/:taskId/subtasks', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const task = await prisma.task.findFirst({
      where: { id: req.params.taskId },
      include: {
        project: {
          select: { coupleId: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify task belongs to couple's project
    if (task.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if project can be modified (not completed and not past wedding date)
    await checkProjectCanBeModified(task.projectId, req.user.sub);

    const data = createSubtaskSchema.parse({ ...req.body, taskId: req.params.taskId });

    const subtask = await prisma.subtask.create({
      data: {
        taskId: data.taskId,
        description: data.description,
        isCompleted: false,
      },
    });

    // Check if all subtasks are now complete, and update task if so
    const allSubtasks = await prisma.subtask.findMany({
      where: { taskId: req.params.taskId },
    });
    
    const allComplete = allSubtasks.length > 0 && allSubtasks.every(st => st.isCompleted);
    if (allComplete && !task.isCompleted) {
      await prisma.task.update({
        where: { id: req.params.taskId },
        data: { isCompleted: true },
      });
    }

    res.status(201).json(subtask);
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
 * PATCH /tasks/:taskId/subtasks/:subtaskId
 * Update a subtask
 */
router.patch('/:taskId/subtasks/:subtaskId', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const task = await prisma.task.findFirst({
      where: { id: req.params.taskId },
      include: {
        project: {
          select: { coupleId: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify task belongs to couple's project
    if (task.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if project can be modified (not completed and not past wedding date)
    await checkProjectCanBeModified(task.projectId, req.user.sub);

    const subtask = await prisma.subtask.findFirst({
      where: {
        id: req.params.subtaskId,
        taskId: req.params.taskId,
      },
    });

    if (!subtask) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    const data = updateSubtaskSchema.parse(req.body);
    const updateData = {};
    
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isCompleted !== undefined) updateData.isCompleted = data.isCompleted;

    const updatedSubtask = await prisma.subtask.update({
      where: { id: req.params.subtaskId },
      data: updateData,
    });

    // Check if all subtasks are complete, and update task accordingly
    const allSubtasks = await prisma.subtask.findMany({
      where: { taskId: req.params.taskId },
    });
    
    const allComplete = allSubtasks.length > 0 && allSubtasks.every(st => st.isCompleted);
    if (allComplete !== task.isCompleted) {
      await prisma.task.update({
        where: { id: req.params.taskId },
        data: { isCompleted: allComplete },
      });
    }

    res.json(updatedSubtask);
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
 * DELETE /tasks/:taskId/subtasks/:subtaskId
 * Delete a subtask
 */
router.delete('/:taskId/subtasks/:subtaskId', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'couple') {
      return res.status(403).json({ error: 'Couple access required' });
    }

    const task = await prisma.task.findFirst({
      where: { id: req.params.taskId },
      include: {
        project: {
          select: { coupleId: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify task belongs to couple's project
    if (task.project.coupleId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if project can be modified (not completed and not past wedding date)
    await checkProjectCanBeModified(task.projectId, req.user.sub);

    const subtask = await prisma.subtask.findFirst({
      where: {
        id: req.params.subtaskId,
        taskId: req.params.taskId,
      },
    });

    if (!subtask) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    await prisma.subtask.delete({
      where: { id: req.params.subtaskId },
    });

    // Check if task should be marked as incomplete if it was complete
    if (task.isCompleted) {
      const remainingSubtasks = await prisma.subtask.findMany({
        where: { taskId: req.params.taskId },
      });
      
      const allComplete = remainingSubtasks.length > 0 && remainingSubtasks.every(st => st.isCompleted);
      if (!allComplete) {
        await prisma.task.update({
          where: { id: req.params.taskId },
          data: { isCompleted: false },
        });
      }
    }

    res.json({ message: 'Subtask deleted successfully' });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;

