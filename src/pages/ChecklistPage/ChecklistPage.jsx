import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  LinearProgress,
  Checkbox,
  IconButton,
  Drawer,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tabs,
  Tab,
  Fab,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  CalendarToday as CalendarIcon,
  Search as SearchIcon,
  Sort as SortIcon,
} from '@mui/icons-material';
import { apiFetch } from '../../lib/api';
import SuccessMessage from '../../components/SuccessMessage/SuccessMessage';
import './ChecklistPage.styles.css';

const ChecklistPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('projectId');

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(null);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');
  const [showNewSubtaskInput, setShowNewSubtaskInput] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('dueDate');
  const [activeFilter, setActiveFilter] = useState(null);
  const [editingSubtask, setEditingSubtask] = useState(null);
  const [editingTaskField, setEditingTaskField] = useState(null);
  const [editingTaskValue, setEditingTaskValue] = useState('');
  const [drawerTaskData, setDrawerTaskData] = useState(null);
  const [pendingTaskUpdates, setPendingTaskUpdates] = useState(new Set());
  const [drawerErrors, setDrawerErrors] = useState({
    taskName: '',
    description: '',
  });

  const [newTaskForm, setNewTaskForm] = useState({
    taskName: '',
    description: '',
    dueDate: '',
  });
  const [formErrors, setFormErrors] = useState({
    taskName: '',
    description: '',
  });
  const [successMessage, setSuccessMessage] = useState({
    open: false,
    message: '',
  });

  useEffect(() => {
    if (projectId) {
      fetchTasks();
    } else {
      fetchFirstProject();
    }
  }, [projectId]);

  const fetchFirstProject = async () => {
    try {
      const projects = await apiFetch('/projects');
      if (projects && projects.length > 0) {
        navigate(`/checklist?projectId=${projects[0].id}`, { replace: true });
      } else {
        setError('No projects found. Please create a project first.');
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to load projects');
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch(`/tasks/project/${projectId}`);
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load tasks');
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    // Initialize drawer data with current task data
    setDrawerTaskData({
      taskName: task.taskName,
      description: task.description || '',
      dueDate: task.dueDate || null,
      subtasks: task.subtasks ? task.subtasks.map(st => ({
        id: st.id,
        description: st.description || '',
        isCompleted: st.isCompleted,
      })) : [],
    });
    setDrawerErrors({ taskName: '', description: '' });
    setDrawerOpen(true);
  };

  const handleCloseDrawer = async () => {
    // Save all changes when closing drawer
    if (selectedTask && drawerTaskData) {
      // Validate before saving
      const taskNameError = validateTaskName(drawerTaskData.taskName);
      const descriptionError = validateDescription(drawerTaskData.description);
      
      if (taskNameError || descriptionError) {
        setDrawerErrors({
          taskName: taskNameError,
          description: descriptionError,
        });
        // Don't close drawer if there are validation errors
        return;
      }

      try {
        // Update main task fields
        const updateData = {};
        if (drawerTaskData.taskName !== selectedTask.taskName) {
          updateData.taskName = drawerTaskData.taskName.trim();
        }
        if (drawerTaskData.description !== (selectedTask.description || '')) {
          updateData.description = drawerTaskData.description?.trim() || null;
        }
        // Compare due dates properly (handle both string and Date formats)
        const drawerDueDate = drawerTaskData.dueDate ? (drawerTaskData.dueDate instanceof Date ? drawerTaskData.dueDate.toISOString().split('T')[0] : drawerTaskData.dueDate) : null;
        const originalDueDate = selectedTask.dueDate ? (selectedTask.dueDate instanceof Date ? selectedTask.dueDate.toISOString().split('T')[0] : new Date(selectedTask.dueDate).toISOString().split('T')[0]) : null;
        if (drawerDueDate !== originalDueDate) {
          updateData.dueDate = drawerTaskData.dueDate || null;
        }

        let hasChanges = false;

        if (Object.keys(updateData).length > 0) {
          await apiFetch(`/tasks/${selectedTask.id}`, {
            method: 'PATCH',
            body: JSON.stringify(updateData),
          });
          hasChanges = true;
        }

        // Update subtasks
        if (drawerTaskData.subtasks) {
          for (const drawerSubtask of drawerTaskData.subtasks) {
            const originalSubtask = selectedTask.subtasks?.find(st => st.id === drawerSubtask.id);
            if (originalSubtask) {
              // Update existing subtask if description changed
              if (drawerSubtask.description !== originalSubtask.description) {
                // Validate subtask description before updating
                const subtaskError = validateSubtaskDescription(drawerSubtask.description);
                if (subtaskError) {
                  alert(`Subtask validation error: ${subtaskError}`);
                  return; // Don't close drawer if validation fails
                }
                await apiFetch(`/tasks/${selectedTask.id}/subtasks/${drawerSubtask.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ description: drawerSubtask.description.trim() }),
                });
                hasChanges = true;
              }
            }
          }
        }

        // Only show notification if there were actual changes
        if (hasChanges) {
          setSuccessMessage({ open: true, message: 'Task updated successfully!' });
        }

        if (!pendingTaskUpdates.has(selectedTask.id)) {
          const updatedTask = await apiFetch(`/tasks/${selectedTask.id}`);
          setTasks(prevTasks =>
            prevTasks.map(task => task.id === selectedTask.id ? updatedTask : task)
          );
        }
      } catch (err) {
        console.error('Error saving changes:', err);
        alert('Failed to save changes');
      }
    }

    setDrawerOpen(false);
    setSelectedTask(null);
    setDrawerTaskData(null);
    setDrawerErrors({ taskName: '', description: '' });
    setNewSubtaskInput('');
    setShowNewSubtaskInput(false);
    setEditingTaskField(null);
    setEditingTaskValue('');
    setEditingSubtask(null);
  };

  const handleToggleTaskComplete = async (taskId, isCompleted, event) => {
    // Prevent drawer from opening
    if (event) {
      event.stopPropagation();
    }
    
    const newCompletedState = !isCompleted;
    
    // Mark this task as having a pending update
    setPendingTaskUpdates(prev => new Set(prev).add(taskId));
    
    // Update UI immediately for visual feedback
    setTasks(prevTasks =>
      prevTasks.map(task => task.id === taskId ? { ...task, isCompleted: newCompletedState } : task)
    );
    
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask({ ...selectedTask, isCompleted: newCompletedState });
    }
    
    // Wait 1 second before actually updating in backend
    setTimeout(async () => {
      try {
        const updatedTask = await apiFetch(`/tasks/${taskId}`, {
          method: 'PATCH',
          body: JSON.stringify({ isCompleted: newCompletedState }),
        });
        
        setTasks(prevTasks =>
          prevTasks.map(task => task.id === taskId ? updatedTask : task)
        );
        
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask(updatedTask);
        }
        
        // Remove from pending updates
        setPendingTaskUpdates(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
      } catch (err) {
        console.error('Error updating task:', err);
        alert('Failed to update task');
        // Revert on error
        setTasks(prevTasks =>
          prevTasks.map(task => task.id === taskId ? { ...task, isCompleted } : task)
        );
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask({ ...selectedTask, isCompleted });
        }
        
        // Remove from pending updates
        setPendingTaskUpdates(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
      }
    }, 1000);
  };

  const handleToggleSubtaskComplete = async (subtaskId, isCompleted) => {
    try {
      const updatedSubtask = await apiFetch(`/tasks/${selectedTask.id}/subtasks/${subtaskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isCompleted: !isCompleted }),
      });
      
      // Update drawer data
      setDrawerTaskData(prev => ({
        ...prev,
        subtasks: prev.subtasks.map(st => 
          st.id === subtaskId ? { ...st, isCompleted: !isCompleted } : st
        )
      }));
      
      // Refetch the task to get updated completion status
      const updatedTask = await apiFetch(`/tasks/${selectedTask.id}`);
      setSelectedTask(updatedTask);
    } catch (err) {
      console.error('Error updating subtask:', err);
      alert('Failed to update subtask');
    }
  };

  // Validation helper functions
  const validateTaskName = (taskName) => {
    if (!taskName || !taskName.trim()) {
      return 'Task name is required';
    }
    if (taskName.length > 100) {
      return 'Task name must be 100 characters or less';
    }
    // Check for SQL injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
      /(--|;|\/\*|\*\/|xp_|sp_)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(\b(OR|AND)\s+['"]\w+['"]\s*=\s*['"]\w+['"])/i,
    ];
    if (sqlPatterns.some(pattern => pattern.test(taskName))) {
      return 'Task name contains invalid characters';
    }
    return '';
  };

  const validateDescription = (description) => {
    if (!description) return '';
    if (description.length > 2000) {
      return 'Description must be 2000 characters or less';
    }
    // Check for SQL injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
      /(--|;|\/\*|\*\/|xp_|sp_)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(\b(OR|AND)\s+['"]\w+['"]\s*=\s*['"]\w+['"])/i,
    ];
    if (sqlPatterns.some(pattern => pattern.test(description))) {
      return 'Description contains invalid characters';
    }
    return '';
  };

  const handleAddTask = async () => {
    // Validate form
    const taskNameError = validateTaskName(newTaskForm.taskName);
    const descriptionError = validateDescription(newTaskForm.description);
    
    setFormErrors({
      taskName: taskNameError,
      description: descriptionError,
    });

    if (taskNameError || descriptionError) {
      return;
    }

    try {
      const newTask = await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          taskName: newTaskForm.taskName.trim(),
          description: newTaskForm.description?.trim() || null,
          dueDate: newTaskForm.dueDate || null,
        }),
      });
      
      setTasks(prevTasks => [...prevTasks, newTask]);
      setNewTaskForm({ taskName: '', description: '', dueDate: '' });
      setFormErrors({ taskName: '', description: '' });
      setShowAddTaskDialog(false);
      setSuccessMessage({ open: true, message: 'Task added successfully!' });
    } catch (err) {
      console.error('Error creating task:', err);
      const errorMessage = err.message || 'Failed to create task';
      if (err.issues && Array.isArray(err.issues)) {
        // Handle Zod validation errors from backend
        const taskNameIssue = err.issues.find(i => i.field === 'taskName');
        const descriptionIssue = err.issues.find(i => i.field === 'description');
        setFormErrors({
          taskName: taskNameIssue?.message || '',
          description: descriptionIssue?.message || '',
        });
      } else {
        alert(errorMessage);
      }
    }
  };

  const handleDeleteTask = async () => {
    if (!showDeleteDialog) return;

    try {
      await apiFetch(`/tasks/${showDeleteDialog.taskId}`, {
        method: 'DELETE',
      });
      
      setTasks(prevTasks => prevTasks.filter(task => task.id !== showDeleteDialog.taskId));
      setShowDeleteDialog(null);
      setSuccessMessage({ open: true, message: 'Task deleted successfully!' });
      
      if (selectedTask && selectedTask.id === showDeleteDialog.taskId) {
        handleCloseDrawer();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      alert('Failed to delete task');
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    try {
      await apiFetch(`/tasks/${selectedTask.id}/subtasks/${subtaskId}`, {
        method: 'DELETE',
      });
      setSuccessMessage({ open: true, message: 'Subtask deleted successfully!' });
      
      // Remove from drawer data
      setDrawerTaskData(prev => ({
        ...prev,
        subtasks: prev.subtasks.filter(st => st.id !== subtaskId)
      }));
      
      // Refetch the task
      const updatedTask = await apiFetch(`/tasks/${selectedTask.id}`);
      setSelectedTask(updatedTask);
    } catch (err) {
      console.error('Error deleting subtask:', err);
      alert('Failed to delete subtask');
    }
  };

  const validateSubtaskDescription = (description) => {
    if (!description || !description.trim()) {
      return 'Subtask description is required';
    }
    if (description.length > 1000) {
      return 'Subtask description must be 1000 characters or less';
    }
    // Check for SQL injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
      /(--|;|\/\*|\*\/|xp_|sp_)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(\b(OR|AND)\s+['"]\w+['"]\s*=\s*['"]\w+['"])/i,
    ];
    if (sqlPatterns.some(pattern => pattern.test(description))) {
      return 'Subtask description contains invalid characters';
    }
    return '';
  };

  const handleAddSubtask = async () => {
    const error = validateSubtaskDescription(newSubtaskInput);
    if (error) {
      alert(error);
      return;
    }

    try {
      const newSubtask = await apiFetch(`/tasks/${selectedTask.id}/subtasks`, {
        method: 'POST',
        body: JSON.stringify({
          description: newSubtaskInput.trim(),
        }),
      });
      
      // Add to drawer data
      setDrawerTaskData(prev => ({
        ...prev,
        subtasks: [...(prev.subtasks || []), {
          id: newSubtask.id,
          description: newSubtask.description || '',
          isCompleted: newSubtask.isCompleted,
        }]
      }));
      
      // Also update selectedTask for immediate UI update
      const updatedTask = await apiFetch(`/tasks/${selectedTask.id}`);
      setSelectedTask(updatedTask);
      setSuccessMessage({ open: true, message: 'Subtask added successfully!' });
      
      setNewSubtaskInput('');
      setShowNewSubtaskInput(false);
    } catch (err) {
      console.error('Error creating subtask:', err);
      alert('Failed to create subtask');
    }
  };

  // Calculate progress
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.isCompleted).length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Calculate stats - normalize dates to avoid timezone issues
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  today.setHours(0, 0, 0, 0);
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const monthFromNow = new Date(today);
  monthFromNow.setMonth(monthFromNow.getMonth() + 1);

  const incompleteTasks = tasks.filter(task => !task.isCompleted);
  const overdueCount = incompleteTasks.filter(task => {
    if (!task.dueDate) return false;
    return new Date(task.dueDate) < today;
  }).length;
  
  const dueThisWeekCount = incompleteTasks.filter(task => {
    if (!task.dueDate) return false;
    const dueDate = new Date(task.dueDate);
    return dueDate >= today && dueDate <= weekFromNow;
  }).length;
  
  const dueThisMonthCount = incompleteTasks.filter(task => {
    if (!task.dueDate) return false;
    const dueDate = new Date(task.dueDate);
    return dueDate >= today && dueDate <= monthFromNow;
  }).length;

  // Helper function to get days until/since due date - normalize dates properly
  const getDueDateInfo = (dueDate) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    // Normalize to date only (remove time component)
    const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    dueDateOnly.setHours(0, 0, 0, 0);
    
    const diffTime = dueDateOnly - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'day' : 'days'}`, color: '#c62828', isOverdue: true };
    } else if (diffDays === 0) {
      return { text: 'Due today', color: '#f57c00', isOverdue: false };
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', color: '#f57c00', isOverdue: false };
    } else if (diffDays <= 7) {
      return { text: `Due in ${diffDays} days`, color: '#f57c00', isOverdue: false };
    } else {
      return { text: `Due in ${diffDays} days`, color: '#666', isOverdue: false };
    }
  };

  // Filter tasks based on active tab
  let filteredTasks = activeTab === 0 
    ? tasks.filter(task => !task.isCompleted)
    : tasks.filter(task => task.isCompleted);

  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredTasks = filteredTasks.filter(task => 
      task.taskName.toLowerCase().includes(query) ||
      (task.description && task.description.toLowerCase().includes(query))
    );
  }

  // Apply quick filter
  if (activeFilter && activeTab === 0) {
    switch (activeFilter) {
      case 'overdue':
        filteredTasks = filteredTasks.filter(task => {
          if (!task.dueDate) return false;
          return new Date(task.dueDate) < today;
        });
        break;
      case 'thisWeek':
        filteredTasks = filteredTasks.filter(task => {
          if (!task.dueDate) return false;
          const dueDate = new Date(task.dueDate);
          return dueDate >= today && dueDate <= weekFromNow;
        });
        break;
      case 'thisMonth':
        filteredTasks = filteredTasks.filter(task => {
          if (!task.dueDate) return false;
          const dueDate = new Date(task.dueDate);
          return dueDate >= today && dueDate <= monthFromNow;
        });
        break;
      case 'noDueDate':
        filteredTasks = filteredTasks.filter(task => !task.dueDate);
        break;
      default:
        break;
    }
  }

  // Sort tasks
  filteredTasks = [...filteredTasks].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.taskName.localeCompare(b.taskName);
      case 'created':
        return new Date(b.createdAt) - new Date(a.createdAt);
      case 'dueDate':
      default:
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
    }
  });

  // Group tasks by month
  const groupTasksByMonth = (taskList) => {
    const groups = {};
    taskList.forEach(task => {
      if (!task.dueDate) {
        if (!groups['No Due Date']) {
          groups['No Due Date'] = [];
        }
        groups['No Due Date'].push(task);
        return;
      }
      const date = new Date(task.dueDate);
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(task);
    });
    
    // Sort groups by date
    const sortedGroups = {};
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'No Due Date') return 1;
      if (b === 'No Due Date') return -1;
      return new Date(groups[a][0].dueDate) - new Date(groups[b][0].dueDate);
    });
    
    sortedKeys.forEach(key => {
      sortedGroups[key] = groups[key].sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    });
    
    return sortedGroups;
  };

  const groupedTasks = groupTasksByMonth(filteredTasks);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <Typography>Loading checklist...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h5" color="error" gutterBottom>
            {error}
          </Typography>
          <Button component={Link} to="/projects" variant="contained" sx={{ mt: 2 }}>
            Back to Projects
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f6fa', pb: 6 }}>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, rgba(225, 103, 137, 0.15) 0%, rgba(171, 71, 188, 0.15) 100%)',
          paddingY: { xs: 4, md: 5 },
          paddingX: 2,
          marginBottom: 4,
        }}
      >
        <Container maxWidth="lg">
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Button
              component={Link}
              to={`/project-dashboard?projectId=${projectId}`}
              state={{ fromChecklist: true }}
              startIcon={<ArrowBackIcon />}
              sx={{
                color: '#666',
                textTransform: 'none',
                fontFamily: "'Literata', serif",
                '&:hover': { color: '#e16789', backgroundColor: 'rgba(225, 103, 137, 0.1)' },
              }}
            >
              Back to Dashboard
            </Button>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowAddTaskDialog(true)}
              sx={{
                border: '2px solid #e16789',
                color: '#e16789',
                textTransform: 'none',
                borderRadius: 1,
                fontFamily: "'Literata', serif",
                fontWeight: 600,
                px: 3,
                '&:hover': {
                  background: '#e16789',
                  border: '2px solid #e16789',
                  color: 'white',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(225, 103, 137, 0.3)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              Add New Task
            </Button>
          </Box>

          {/* Title */}
          <Typography
            variant="h2"
            sx={{
              fontFamily: "'Playfair Display', serif",
              fontSize: { xs: '2rem', md: '2.5rem' },
              fontWeight: 700,
              color: '#0f060d',
              mb: 1,
              lineHeight: 1.2,
            }}
          >
            Wedding Checklist
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 2, px: { xs: 2, md: 3 } }}>

        {/* Progress Bar */}
        <Card
          sx={{
            borderRadius: 1,
            padding: 2.5,
            mb: 2,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 1) 100%)',
            border: '1px solid rgba(225, 103, 137, 0.1)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography
              variant="h6"
              sx={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 600,
                fontSize: { xs: '1rem', md: '1.25rem' },
              }}
            >
              Overall Progress
            </Typography>
            <Box sx={{ 
              background: '#e16789',
              color: 'white',
              px: 2,
              py: 0.5,
              borderRadius: 1,
            }}>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 700,
                  fontSize: { xs: '1.25rem', md: '1.5rem' },
                }}
              >
                {Math.round(progress)}%
              </Typography>
            </Box>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 12,
              borderRadius: 1,
              backgroundColor: '#f0f0f0',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(90deg, #e16789 0%, #ab47bc 100%)',
                borderRadius: 1,
                boxShadow: '0 2px 8px rgba(225, 103, 137, 0.4)',
              },
            }}
          />
          <Typography
            variant="body2"
            sx={{
              mt: 1.5,
              color: '#666',
              fontFamily: "'Literata', serif",
            }}
          >
            {completedTasks} of {totalTasks} tasks completed
          </Typography>
        </Card>

        {/* Quick Stats Cards */}
        {activeTab === 0 ? (
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            {overdueCount > 0 && (
              <Card
                onClick={() => setActiveFilter(activeFilter === 'overdue' ? null : 'overdue')}
                sx={{
                  flex: { xs: '1 1 100%', sm: '1 1 calc(33.333% - 16px)', md: '1 1 calc(25% - 12px)' },
                  padding: 2,
                  borderRadius: 1,
                  cursor: 'pointer',
                  border: activeFilter === 'overdue' ? '2px solid #c62828' : '1px solid rgba(198, 40, 40, 0.2)',
                  background: activeFilter === 'overdue' 
                    ? 'linear-gradient(135deg, rgba(198, 40, 40, 0.1) 0%, rgba(255, 255, 255, 1) 100%)'
                    : 'white',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(198, 40, 40, 0.2)',
                  },
                }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 700,
                    color: '#c62828',
                    mb: 0.5,
                  }}
                >
                  {overdueCount}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: "'Literata', serif",
                    color: '#666',
                    fontSize: '0.875rem',
                  }}
                >
                  Overdue
                </Typography>
              </Card>
            )}
            {dueThisWeekCount > 0 && (
              <Card
                onClick={() => setActiveFilter(activeFilter === 'thisWeek' ? null : 'thisWeek')}
                sx={{
                  flex: { xs: '1 1 100%', sm: '1 1 calc(33.333% - 16px)', md: '1 1 calc(25% - 12px)' },
                  padding: 2,
                  borderRadius: 1,
                  cursor: 'pointer',
                  border: activeFilter === 'thisWeek' ? '2px solid #f57c00' : '1px solid rgba(245, 124, 0, 0.2)',
                  background: activeFilter === 'thisWeek' 
                    ? 'linear-gradient(135deg, rgba(245, 124, 0, 0.1) 0%, rgba(255, 255, 255, 1) 100%)'
                    : 'white',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(245, 124, 0, 0.2)',
                  },
                }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 700,
                    color: '#f57c00',
                    mb: 0.5,
                  }}
                >
                  {dueThisWeekCount}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: "'Literata', serif",
                    color: '#666',
                    fontSize: '0.875rem',
                  }}
                >
                  Due This Week
                </Typography>
              </Card>
            )}
            {dueThisMonthCount > 0 && (
              <Card
                onClick={() => setActiveFilter(activeFilter === 'thisMonth' ? null : 'thisMonth')}
                sx={{
                  flex: { xs: '1 1 100%', sm: '1 1 calc(33.333% - 16px)', md: '1 1 calc(25% - 12px)' },
                  padding: 2,
                  borderRadius: 1,
                  cursor: 'pointer',
                  border: activeFilter === 'thisMonth' ? '2px solid #e16789' : '1px solid rgba(225, 103, 137, 0.2)',
                  background: activeFilter === 'thisMonth' 
                    ? 'linear-gradient(135deg, rgba(225, 103, 137, 0.1) 0%, rgba(255, 255, 255, 1) 100%)'
                    : 'white',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(225, 103, 137, 0.2)',
                  },
                }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 700,
                    color: '#e16789',
                    mb: 0.5,
                  }}
                >
                  {dueThisMonthCount}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: "'Literata', serif",
                    color: '#666',
                    fontSize: '0.875rem',
                  }}
                >
                  Due This Month
                </Typography>
              </Card>
            )}
          </Box>
        ) : (
          <Box sx={{ mb: 2 }} />
        )}

        {/* Search and Sort Bar */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: '#999', mr: 1, fontSize: '1.2rem' }} />,
            }}
            sx={{
              flex: { xs: '1 1 100%', sm: '1 1 auto' },
              minWidth: { sm: '250px' },
              '& .MuiOutlinedInput-root': {
                fontFamily: "'Literata', serif",
                borderRadius: 1,
                backgroundColor: 'white',
              },
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SortIcon sx={{ color: '#666', fontSize: '1.2rem' }} />
            <Button
              variant={sortBy === 'dueDate' ? 'contained' : 'outlined'}
              onClick={() => setSortBy('dueDate')}
              size="small"
              sx={{
                textTransform: 'none',
                fontFamily: "'Literata', serif",
                borderRadius: 1,
                backgroundColor: sortBy === 'dueDate' ? '#e16789' : 'transparent',
                borderColor: '#e16789',
                color: sortBy === 'dueDate' ? 'white' : '#e16789',
                '&:hover': {
                  backgroundColor: sortBy === 'dueDate' ? '#d1537a' : 'rgba(225, 103, 137, 0.1)',
                  borderColor: '#e16789',
                },
              }}
            >
              Due Date
            </Button>
            <Button
              variant={sortBy === 'name' ? 'contained' : 'outlined'}
              onClick={() => setSortBy('name')}
              size="small"
              sx={{
                textTransform: 'none',
                fontFamily: "'Literata', serif",
                borderRadius: 1,
                backgroundColor: sortBy === 'name' ? '#e16789' : 'transparent',
                borderColor: '#e16789',
                color: sortBy === 'name' ? 'white' : '#e16789',
                '&:hover': {
                  backgroundColor: sortBy === 'name' ? '#d1537a' : 'rgba(225, 103, 137, 0.1)',
                  borderColor: '#e16789',
                },
              }}
            >
              Name
            </Button>
            <Button
              variant={sortBy === 'created' ? 'contained' : 'outlined'}
              onClick={() => setSortBy('created')}
              size="small"
              sx={{
                textTransform: 'none',
                fontFamily: "'Literata', serif",
                borderRadius: 1,
                backgroundColor: sortBy === 'created' ? '#e16789' : 'transparent',
                borderColor: '#e16789',
                color: sortBy === 'created' ? 'white' : '#e16789',
                '&:hover': {
                  backgroundColor: sortBy === 'created' ? '#d1537a' : 'rgba(225, 103, 137, 0.1)',
                  borderColor: '#e16789',
                },
              }}
            >
              Created
            </Button>
          </Box>
        </Box>

        {/* Quick Filters */}
        {activeTab === 0 && (
          <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
            <Chip
              label="All"
              onClick={() => setActiveFilter(null)}
              sx={{
                backgroundColor: activeFilter === null ? '#e16789' : 'rgba(225, 103, 137, 0.1)',
                color: activeFilter === null ? 'white' : '#e16789',
                fontFamily: "'Literata', serif",
                fontWeight: 600,
                borderRadius: 1,
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: activeFilter === null ? '#d1537a' : 'rgba(225, 103, 137, 0.2)',
                },
              }}
            />
            {overdueCount > 0 && (
              <Chip
                label={`Overdue (${overdueCount})`}
                onClick={() => setActiveFilter(activeFilter === 'overdue' ? null : 'overdue')}
                sx={{
                  backgroundColor: activeFilter === 'overdue' ? '#c62828' : 'rgba(198, 40, 40, 0.1)',
                  color: activeFilter === 'overdue' ? 'white' : '#c62828',
                  fontFamily: "'Literata', serif",
                  fontWeight: 600,
                  borderRadius: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: activeFilter === 'overdue' ? '#b71c1c' : 'rgba(198, 40, 40, 0.2)',
                  },
                }}
              />
            )}
            {dueThisWeekCount > 0 && (
              <Chip
                label={`This Week (${dueThisWeekCount})`}
                onClick={() => setActiveFilter(activeFilter === 'thisWeek' ? null : 'thisWeek')}
                sx={{
                  backgroundColor: activeFilter === 'thisWeek' ? '#f57c00' : 'rgba(245, 124, 0, 0.1)',
                  color: activeFilter === 'thisWeek' ? 'white' : '#f57c00',
                  fontFamily: "'Literata', serif",
                  fontWeight: 600,
                  borderRadius: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: activeFilter === 'thisWeek' ? '#e65100' : 'rgba(245, 124, 0, 0.2)',
                  },
                }}
              />
            )}
            {dueThisMonthCount > 0 && (
              <Chip
                label={`This Month (${dueThisMonthCount})`}
                onClick={() => setActiveFilter(activeFilter === 'thisMonth' ? null : 'thisMonth')}
                sx={{
                  backgroundColor: activeFilter === 'thisMonth' ? '#e16789' : 'rgba(225, 103, 137, 0.1)',
                  color: activeFilter === 'thisMonth' ? 'white' : '#e16789',
                  fontFamily: "'Literata', serif",
                  fontWeight: 600,
                  borderRadius: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: activeFilter === 'thisMonth' ? '#d1537a' : 'rgba(225, 103, 137, 0.2)',
                  },
                }}
              />
            )}
            {incompleteTasks.filter(t => !t.dueDate).length > 0 && (
              <Chip
                label={`No Due Date (${incompleteTasks.filter(t => !t.dueDate).length})`}
                onClick={() => setActiveFilter(activeFilter === 'noDueDate' ? null : 'noDueDate')}
                sx={{
                  backgroundColor: activeFilter === 'noDueDate' ? '#666' : 'rgba(102, 102, 102, 0.1)',
                  color: activeFilter === 'noDueDate' ? 'white' : '#666',
                  fontFamily: "'Literata', serif",
                  fontWeight: 600,
                  borderRadius: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: activeFilter === 'noDueDate' ? '#555' : 'rgba(102, 102, 102, 0.2)',
                  },
                }}
              />
            )}
          </Box>
        )}

        {/* Tabs */}
        <Box sx={{ mb: 4 }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            sx={{
              '& .MuiTabs-indicator': {
                background: activeTab === 0 ? '#e16789' : '#66bb6a',
                height: 3,
                borderRadius: '3px 3px 0 0',
              },
            }}
          >
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontFamily: "'Literata', serif", fontWeight: 600 }}>
                    Incomplete
                  </Typography>
                  <Chip
                    label={tasks.filter(t => !t.isCompleted).length}
                    size="small"
                    sx={{
                      backgroundColor: activeTab === 0 ? '#e16789' : 'rgba(225, 103, 137, 0.2)',
                      color: activeTab === 0 ? 'white' : '#e16789',
                      fontFamily: "'Literata', serif",
                      fontWeight: 600,
                      borderRadius: 1,
                      minWidth: 32,
                      height: 24,
                    }}
                  />
                </Box>
              }
              sx={{
                textTransform: 'none',
                fontFamily: "'Literata', serif",
                fontWeight: 600,
                fontSize: '1rem',
                color: activeTab === 0 ? '#e16789' : '#666',
                '&.Mui-selected': {
                  color: '#e16789',
                },
              }}
            />
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontFamily: "'Literata', serif", fontWeight: 600 }}>
                    Completed
                  </Typography>
                  <Chip
                    label={tasks.filter(t => t.isCompleted).length}
                    size="small"
                    sx={{
                      backgroundColor: activeTab === 1 ? '#66bb6a' : 'rgba(102, 187, 106, 0.2)',
                      color: activeTab === 1 ? 'white' : '#66bb6a',
                      fontFamily: "'Literata', serif",
                      fontWeight: 600,
                      borderRadius: 1,
                      minWidth: 32,
                      height: 24,
                    }}
                  />
                </Box>
              }
              sx={{
                textTransform: 'none',
                fontFamily: "'Literata', serif",
                fontWeight: 600,
                fontSize: '1rem',
                color: activeTab === 1 ? '#66bb6a' : '#666',
                '&.Mui-selected': {
                  color: '#66bb6a',
                },
              }}
            />
          </Tabs>
        </Box>

        {/* Task List */}
        {Object.keys(groupedTasks).length === 0 ? (
          <Card
            sx={{
              borderRadius: 1,
              padding: 6,
              textAlign: 'center',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 248, 250, 1) 100%)',
              border: '1px solid rgba(225, 103, 137, 0.2)',
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontFamily: "'Playfair Display', serif",
                mb: 2,
                color: '#666',
              }}
            >
              {activeTab === 0 ? 'No incomplete tasks' : 'No completed tasks yet'}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: "'Literata', serif",
                color: '#999',
                mb: 3,
              }}
            >
              {activeTab === 0 
                ? 'All tasks are completed! Great job!' 
                : 'Complete some tasks to see them here.'}
            </Typography>
            {activeTab === 0 && (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setShowAddTaskDialog(true)}
                sx={{
                  border: '2px solid #e16789',
                  color: '#e16789',
                  textTransform: 'none',
                  borderRadius: 1,
                  fontFamily: "'Literata', serif",
                  fontWeight: 600,
                  '&:hover': {
                    background: '#e16789',
                    border: '2px solid #e16789',
                    color: 'white',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(225, 103, 137, 0.3)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                Add Your First Task
              </Button>
            )}
          </Card>
        ) : (
          <Box>
            {Object.entries(groupedTasks).map(([monthYear, monthTasks]) => (
              <Box key={monthYear} sx={{ mb: 4 }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: { xs: '1.5rem', md: '1.75rem' },
                    fontWeight: 600,
                    color: '#0f060d',
                    mb: 2,
                  }}
                >
                  {monthYear}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {monthTasks.map(task => (
                    <Card
                      key={task.id}
                      onClick={(e) => {
                        // Don't open drawer if clicking on checkbox
                        if (e.target.closest('.MuiCheckbox-root')) {
                          return;
                        }
                        handleTaskClick(task);
                      }}
                      sx={{
                        borderRadius: 1,
                        padding: 2,
                        cursor: 'pointer',
                        boxShadow: task.isCompleted 
                          ? '0 2px 8px rgba(102, 187, 106, 0.15)' 
                          : '0 4px 16px rgba(225, 103, 137, 0.15)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        border: task.isCompleted 
                          ? '1px solid rgba(102, 187, 106, 0.3)' 
                          : '1px solid rgba(225, 103, 137, 0.3)',
                        background: task.isCompleted
                          ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(240, 255, 240, 1) 100%)'
                          : 'linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(255, 248, 250, 1) 100%)',
                        position: 'relative',
                        overflow: 'hidden',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 4,
                          background: task.isCompleted ? '#66bb6a' : '#e16789',
                          opacity: 1,
                        },
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: task.isCompleted
                            ? '0 8px 24px rgba(102, 187, 106, 0.25)'
                            : '0 12px 32px rgba(225, 103, 137, 0.25)',
                          borderColor: task.isCompleted ? '#66bb6a' : '#e16789',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <Checkbox
                          checked={task.isCompleted}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleTaskComplete(task.id, task.isCompleted, e);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          sx={{
                            color: task.isCompleted ? '#66bb6a' : '#e16789',
                            '&.Mui-checked': {
                              color: task.isCompleted ? '#66bb6a' : '#e16789',
                            },
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="h6"
                            sx={{
                              fontFamily: "'Playfair Display', serif",
                              fontWeight: 600,
                              textDecoration: task.isCompleted ? 'line-through' : 'none',
                              color: task.isCompleted ? '#999' : '#0f060d',
                              mb: 0.5,
                              fontSize: { xs: '1rem', md: '1.125rem' },
                            }}
                          >
                            {task.taskName}
                          </Typography>
                          {task.description && (
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: "'Literata', serif",
                                color: '#666',
                                mb: 1,
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                fontSize: '0.875rem',
                              }}
                            >
                              {task.description}
                            </Typography>
                          )}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 0.5 }}>
                            {task.dueDate && (() => {
                              const dueInfo = getDueDateInfo(task.dueDate);
                              return dueInfo ? (
                                <Chip
                                  icon={<CalendarIcon sx={{ fontSize: '0.875rem !important', color: dueInfo.color }} />}
                                  label={dueInfo.text}
                                  size="small"
                                  sx={{
                                    backgroundColor: dueInfo.isOverdue ? '#ffebee' : dueInfo.color === '#f57c00' ? '#fff3e0' : 'rgba(225, 103, 137, 0.1)',
                                    color: dueInfo.color,
                                    fontFamily: "'Literata', serif",
                                    borderRadius: 1,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    height: 24,
                                    '& .MuiChip-icon': {
                                      color: dueInfo.color,
                                    },
                                  }}
                                />
                              ) : null;
                            })()}
                            {task.subtasks && task.subtasks.length > 0 && (
                              <Typography
                                variant="body2"
                                sx={{
                                  fontFamily: "'Literata', serif",
                                  color: '#666',
                                  fontSize: '0.75rem',
                                }}
                              >
                                {task.subtasks.filter(st => st.isCompleted).length} / {task.subtasks.length} subtasks
                              </Typography>
                            )}
                            {task.isCompleted && (
                              <Chip
                                label="Completed"
                                size="small"
                                sx={{
                                  backgroundColor: 'rgba(102, 187, 106, 0.15)',
                                  color: '#66bb6a',
                                  fontFamily: "'Literata', serif",
                                  borderRadius: 1,
                                  fontSize: '0.75rem',
                                  height: 24,
                                  fontWeight: 600,
                                }}
                              />
                            )}
                          </Box>
                        </Box>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteDialog({ type: 'task', taskId: task.id, name: task.taskName });
                          }}
                          sx={{
                            color: '#999',
                            '&:hover': { color: '#e16789' },
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Card>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {/* Task Detail Drawer */}
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={handleCloseDrawer}
          PaperProps={{
            sx: {
              width: { xs: '100%', sm: '50%', md: '50%' },
              maxWidth: { md: '800px' },
              padding: 0,
              background: '#f5f6fa',
            },
          }}
        >
          {selectedTask && (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Drawer Header */}
              <Box
                sx={{
                  background: 'linear-gradient(135deg, rgba(225, 103, 137, 0.15) 0%, rgba(171, 71, 188, 0.15) 100%)',
                  padding: 3,
                  borderBottom: '1px solid rgba(225, 103, 137, 0.2)',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Checkbox
                        checked={selectedTask.isCompleted}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleTaskComplete(selectedTask.id, selectedTask.isCompleted);
                        }}
                        sx={{
                          color: selectedTask.isCompleted ? '#66bb6a' : '#e16789',
                          '&.Mui-checked': {
                            color: selectedTask.isCompleted ? '#66bb6a' : '#e16789',
                          },
                        }}
                      />
                      {editingTaskField === 'name' ? (
                        <TextField
                          value={editingTaskValue}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value.length <= 100) {
                              setEditingTaskValue(value);
                              setDrawerTaskData(prev => ({ ...prev, taskName: value }));
                              // Clear error when user starts typing
                              if (drawerErrors.taskName) {
                                setDrawerErrors({ ...drawerErrors, taskName: '' });
                              }
                            }
                          }}
                          onBlur={() => {
                            const error = validateTaskName(editingTaskValue);
                            setDrawerErrors({ ...drawerErrors, taskName: error });
                            if (!error) {
                              setEditingTaskField(null);
                            }
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              const error = validateTaskName(editingTaskValue);
                              if (!error) {
                                setEditingTaskField(null);
                              } else {
                                setDrawerErrors({ ...drawerErrors, taskName: error });
                              }
                            } else if (e.key === 'Escape') {
                              setEditingTaskField(null);
                              setEditingTaskValue(drawerTaskData?.taskName || selectedTask.taskName);
                              setDrawerErrors({ ...drawerErrors, taskName: '' });
                            }
                          }}
                          autoFocus
                          disabled={selectedTask.isCompleted}
                          variant="standard"
                          error={!!drawerErrors.taskName}
                          helperText={drawerErrors.taskName || `${editingTaskValue.length}/100 characters`}
                          inputProps={{ maxLength: 100 }}
                          sx={{
                            flex: 1,
                            '& .MuiInput-root': {
                              fontFamily: "'Playfair Display', serif",
                              fontWeight: 700,
                              fontSize: '1.5rem',
                              '&::before': {
                                borderBottom: '2px solid #e16789',
                              },
                              '&:hover:not(.Mui-disabled):before': {
                                borderBottom: '2px solid #e16789',
                              },
                            },
                            '& .MuiInput-input': {
                              padding: 0,
                            },
                          }}
                        />
                      ) : (
                        <Typography
                          variant="h4"
                          onClick={() => {
                            if (!selectedTask.isCompleted) {
                              setEditingTaskField('name');
                              setEditingTaskValue(drawerTaskData?.taskName || selectedTask.taskName);
                            }
                          }}
                          sx={{
                            fontFamily: "'Playfair Display', serif",
                            fontWeight: 700,
                            textDecoration: selectedTask.isCompleted ? 'line-through' : 'none',
                            color: selectedTask.isCompleted ? '#999' : '#0f060d',
                            flex: 1,
                            cursor: selectedTask.isCompleted ? 'default' : 'pointer',
                            '&:hover': selectedTask.isCompleted ? {} : { 
                              color: '#e16789',
                              borderBottom: '2px dashed #e16789',
                            },
                            borderBottom: '2px solid transparent',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {drawerTaskData?.taskName || selectedTask.taskName}
                        </Typography>
                      )}
                      <IconButton
                        onClick={() => setShowDeleteDialog({ type: 'task', taskId: selectedTask.id, name: selectedTask.taskName })}
                        sx={{
                          color: '#999',
                          '&:hover': { 
                            color: '#e16789',
                            backgroundColor: 'rgba(225, 103, 137, 0.1)',
                          },
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1, 
                      mb: 2,
                      padding: 1.5,
                      borderRadius: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.7)',
                      border: '1px solid rgba(225, 103, 137, 0.2)',
                    }}>
                      <CalendarIcon sx={{ color: '#e16789', fontSize: '1.5rem' }} />
                      {editingTaskField === 'dueDate' ? (
                        <TextField
                          type="date"
                          value={editingTaskValue}
                          onChange={(e) => {
                            setEditingTaskValue(e.target.value);
                            setDrawerTaskData(prev => ({ ...prev, dueDate: e.target.value || null }));
                          }}
                          onBlur={() => {
                            setEditingTaskField(null);
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' || e.key === 'Escape') {
                              setEditingTaskField(null);
                            }
                          }}
                          autoFocus
                          disabled={selectedTask.isCompleted}
                          InputLabelProps={{ shrink: true }}
                          variant="standard"
                          sx={{
                            flex: 1,
                            '& .MuiInput-root': {
                              fontFamily: "'Literata', serif",
                              '&::before': {
                                borderBottom: '2px solid #e16789',
                              },
                              '&:hover:not(.Mui-disabled):before': {
                                borderBottom: '2px solid #e16789',
                              },
                            },
                          }}
                        />
                      ) : (
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography
                            onClick={() => {
                              if (!selectedTask.isCompleted) {
                                setEditingTaskField('dueDate');
                                const currentDueDate = drawerTaskData?.dueDate || selectedTask.dueDate;
                                setEditingTaskValue(currentDueDate ? new Date(currentDueDate).toISOString().split('T')[0] : '');
                              }
                            }}
                            variant="body1"
                            sx={{
                              fontFamily: "'Literata', serif",
                              color: (drawerTaskData?.dueDate || selectedTask.dueDate) ? '#666' : '#999',
                              fontWeight: 500,
                              cursor: selectedTask.isCompleted ? 'default' : 'pointer',
                              fontStyle: (drawerTaskData?.dueDate || selectedTask.dueDate) ? 'normal' : 'italic',
                              '&:hover': selectedTask.isCompleted ? {} : { 
                                color: '#e16789',
                                borderBottom: '2px dashed #e16789',
                              },
                              borderBottom: '2px solid transparent',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {(drawerTaskData?.dueDate || selectedTask.dueDate)
                              ? `Due: ${new Date(drawerTaskData?.dueDate || selectedTask.dueDate).toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}`
                              : 'No due date (click to set)'}
                          </Typography>
                          {(drawerTaskData?.dueDate || selectedTask.dueDate) && (() => {
                            const dueInfo = getDueDateInfo(drawerTaskData?.dueDate || selectedTask.dueDate);
                            return dueInfo && !selectedTask.isCompleted && (
                              <Chip
                                label={dueInfo.text}
                                size="small"
                                sx={{
                                  backgroundColor: dueInfo.isOverdue ? '#ffebee' : dueInfo.color === '#f57c00' ? '#fff3e0' : 'rgba(225, 103, 137, 0.1)',
                                  color: dueInfo.color,
                                  fontFamily: "'Literata', serif",
                                  borderRadius: 1,
                                  fontWeight: 600,
                                }}
                              />
                            );
                          })()}
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Box>
              </Box>

              {/* Description */}
              <Box sx={{ mb: 3, padding: 3 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 600,
                    mb: 2,
                    color: '#0f060d',
                  }}
                >
                  Description
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={drawerTaskData?.description || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 2000) {
                      setDrawerTaskData(prev => ({ ...prev, description: value }));
                      // Clear error when user starts typing
                      if (drawerErrors.description) {
                        setDrawerErrors({ ...drawerErrors, description: '' });
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const error = validateDescription(e.target.value);
                    setDrawerErrors({ ...drawerErrors, description: error });
                  }}
                  disabled={selectedTask.isCompleted}
                  placeholder="Add a description..."
                  variant="standard"
                  error={!!drawerErrors.description}
                  helperText={drawerErrors.description || `${(drawerTaskData?.description || '').length}/2000 characters`}
                  inputProps={{ maxLength: 2000 }}
                  sx={{
                    '& .MuiInput-root': {
                      fontFamily: "'Literata', serif",
                      '&::before': {
                        borderBottom: '2px solid #e16789',
                      },
                      '&:hover:not(.Mui-disabled):before': {
                        borderBottom: '2px solid #e16789',
                      },
                    },
                    '& .MuiInputBase-input': {
                      padding: '8px 0',
                    },
                  }}
                />
              </Box>

              {/* Subtasks */}
              <Box sx={{ flex: 1, overflow: 'auto', mb: 3, paddingX: 3 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 600,
                    mb: 2,
                    color: '#0f060d',
                  }}
                >
                  Subtasks
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {(drawerTaskData?.subtasks || selectedTask.subtasks || []).length > 0 ? (
                    (drawerTaskData?.subtasks || selectedTask.subtasks || []).map(subtask => {
                      // Find the original subtask to check if it exists in backend
                      const originalSubtask = selectedTask.subtasks?.find(st => st.id === subtask.id);
                      return (
                        <Box
                          key={subtask.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            padding: 2,
                            borderRadius: 1,
                            border: subtask.isCompleted 
                              ? '1px solid rgba(225, 103, 137, 0.2)' 
                              : '1px solid rgba(225, 103, 137, 0.3)',
                            backgroundColor: subtask.isCompleted 
                              ? 'linear-gradient(135deg, rgba(250, 250, 250, 1) 0%, rgba(255, 255, 255, 1) 100%)'
                              : 'linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(255, 248, 250, 1) 100%)',
                            boxShadow: subtask.isCompleted 
                              ? '0 2px 4px rgba(0, 0, 0, 0.04)' 
                              : '0 2px 8px rgba(225, 103, 137, 0.1)',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              transform: 'translateX(4px)',
                              boxShadow: '0 4px 12px rgba(225, 103, 137, 0.2)',
                              borderColor: '#e16789',
                            },
                          }}
                        >
                          <Checkbox
                            checked={subtask.isCompleted}
                            onChange={() => {
                              if (originalSubtask) {
                                handleToggleSubtaskComplete(subtask.id, subtask.isCompleted);
                              } else {
                                // New subtask not yet saved
                                setDrawerTaskData(prev => ({
                                  ...prev,
                                  subtasks: prev.subtasks.map(st => 
                                    st.id === subtask.id ? { ...st, isCompleted: !st.isCompleted } : st
                                  )
                                }));
                              }
                            }}
                            disabled={selectedTask.isCompleted}
                            sx={{
                              color: '#e16789',
                              '&.Mui-checked': {
                                color: '#e16789',
                              },
                            }}
                          />
                        {editingSubtask === subtask.id ? (
                          <TextField
                            value={editingTaskValue}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value.length <= 1000) {
                                setEditingTaskValue(value);
                                setDrawerTaskData(prev => ({
                                  ...prev,
                                  subtasks: prev.subtasks.map(st => 
                                    st.id === subtask.id ? { ...st, description: value } : st
                                  )
                                }));
                              }
                            }}
                            onBlur={() => {
                              const error = validateSubtaskDescription(editingTaskValue);
                              if (!error) {
                                setEditingSubtask(null);
                              } else {
                                alert(error);
                                // Revert to original value on error
                                const drawerSubtask = drawerTaskData?.subtasks?.find(st => st.id === subtask.id);
                                setEditingTaskValue(drawerSubtask?.description || subtask.description || '');
                              }
                            }}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                const error = validateSubtaskDescription(editingTaskValue);
                                if (!error) {
                                  setEditingSubtask(null);
                                } else {
                                  alert(error);
                                  const drawerSubtask = drawerTaskData?.subtasks?.find(st => st.id === subtask.id);
                                  setEditingTaskValue(drawerSubtask?.description || subtask.description || '');
                                }
                              } else if (e.key === 'Escape') {
                                setEditingSubtask(null);
                                const drawerSubtask = drawerTaskData?.subtasks?.find(st => st.id === subtask.id);
                                setEditingTaskValue(drawerSubtask?.description || subtask.description || '');
                              }
                            }}
                            autoFocus
                            disabled={selectedTask.isCompleted}
                            fullWidth
                            variant="standard"
                            inputProps={{ maxLength: 1000 }}
                            helperText={`${editingTaskValue.length}/1000 characters`}
                            sx={{
                              flex: 1,
                              '& .MuiInput-root': {
                                fontFamily: "'Literata', serif",
                                '&::before': {
                                  borderBottom: '2px solid #e16789',
                                },
                                '&:hover:not(.Mui-disabled):before': {
                                  borderBottom: '2px solid #e16789',
                                },
                              },
                              '& .MuiInput-input': {
                                padding: '4px 0',
                              },
                            }}
                          />
                        ) : (
                          <Typography
                            onClick={() => {
                              if (!selectedTask.isCompleted) {
                                setEditingSubtask(subtask.id);
                                const drawerSubtask = drawerTaskData?.subtasks?.find(st => st.id === subtask.id);
                                setEditingTaskValue(drawerSubtask?.description || subtask.description || '');
                              }
                            }}
                            sx={{
                              flex: 1,
                              fontFamily: "'Literata', serif",
                              textDecoration: subtask.isCompleted ? 'line-through' : 'none',
                              color: subtask.isCompleted ? '#999' : '#0f060d',
                              cursor: selectedTask.isCompleted ? 'default' : 'pointer',
                              '&:hover': selectedTask.isCompleted ? {} : { 
                                color: '#e16789',
                                borderBottom: '2px dashed #e16789',
                              },
                              borderBottom: '2px solid transparent',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {drawerTaskData?.subtasks?.find(st => st.id === subtask.id)?.description || subtask.description}
                          </Typography>
                        )}
                        <IconButton
                          onClick={() => {
                            if (originalSubtask) {
                              handleDeleteSubtask(subtask.id);
                            } else {
                              // Remove from drawer data if not yet saved
                              setDrawerTaskData(prev => ({
                                ...prev,
                                subtasks: prev.subtasks.filter(st => st.id !== subtask.id)
                              }));
                            }
                          }}
                          disabled={selectedTask.isCompleted}
                          sx={{
                            color: '#999',
                            '&:hover': { color: '#e16789' },
                            '&:disabled': { opacity: 0.3 },
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    );
                    })
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: "'Literata', serif",
                        color: '#999',
                        fontStyle: 'italic',
                      }}
                    >
                      No subtasks yet
                    </Typography>
                  )}
                </Box>

                {/* Add Subtask Input */}
                {!selectedTask.isCompleted && (
                  <Box sx={{ mt: 2 }}>
                    {showNewSubtaskInput ? (
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField
                          fullWidth
                          placeholder="Enter subtask description..."
                          value={newSubtaskInput}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value.length <= 1000) {
                              setNewSubtaskInput(value);
                            }
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleAddSubtask();
                            }
                          }}
                          autoFocus
                          inputProps={{ maxLength: 1000 }}
                          helperText={`${newSubtaskInput.length}/1000 characters`}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              fontFamily: "'Literata', serif",
                              borderRadius: 1,
                            },
                          }}
                        />
                        <Button
                          variant="outlined"
                          onClick={handleAddSubtask}
                          sx={{
                            border: '2px solid #e16789',
                            color: '#e16789',
                            textTransform: 'none',
                            borderRadius: 1,
                            fontFamily: "'Literata', serif",
                            fontWeight: 600,
                            minWidth: 'auto',
                            px: 2,
                            '&:hover': {
                              background: '#e16789',
                              border: '2px solid #e16789',
                              color: 'white',
                            },
                          }}
                        >
                          Add
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => {
                            setShowNewSubtaskInput(false);
                            setNewSubtaskInput('');
                          }}
                          sx={{
                            color: '#666',
                            textTransform: 'none',
                            fontFamily: "'Literata', serif",
                            minWidth: 'auto',
                          }}
                        >
                          Cancel
                        </Button>
                      </Box>
                    ) : (
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => setShowNewSubtaskInput(true)}
                        fullWidth
                        sx={{
                          border: '2px solid #e16789',
                          color: '#e16789',
                          textTransform: 'none',
                          borderRadius: 1,
                          fontFamily: "'Literata', serif",
                          fontWeight: 600,
                          '&:hover': {
                            background: '#e16789',
                            border: '2px solid #e16789',
                            color: 'white',
                          },
                        }}
                      >
                        Add Subtask
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </Drawer>

        {/* Add Task Dialog */}
        <Dialog
          open={showAddTaskDialog}
          onClose={() => setShowAddTaskDialog(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 1,
            },
          }}
        >
          <DialogTitle
            sx={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 600,
            }}
          >
            Add New Task
          </DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Task Name *"
              value={newTaskForm.taskName}
              onChange={(e) => {
                const value = e.target.value;
                setNewTaskForm({ ...newTaskForm, taskName: value });
                // Clear error when user starts typing
                if (formErrors.taskName) {
                  setFormErrors({ ...formErrors, taskName: '' });
                }
              }}
              onBlur={(e) => {
                const error = validateTaskName(e.target.value);
                setFormErrors({ ...formErrors, taskName: error });
              }}
              error={!!formErrors.taskName}
              helperText={formErrors.taskName || `${newTaskForm.taskName.length}/100 characters`}
              inputProps={{ maxLength: 100 }}
              margin="normal"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: "'Literata', serif",
                  borderRadius: 1,
                },
                '& .MuiInputLabel-root': {
                  fontFamily: "'Literata', serif",
                },
              }}
            />
            <TextField
              fullWidth
              label="Description"
              value={newTaskForm.description}
              onChange={(e) => {
                const value = e.target.value;
                setNewTaskForm({ ...newTaskForm, description: value });
                // Clear error when user starts typing
                if (formErrors.description) {
                  setFormErrors({ ...formErrors, description: '' });
                }
              }}
              onBlur={(e) => {
                const error = validateDescription(e.target.value);
                setFormErrors({ ...formErrors, description: error });
              }}
              error={!!formErrors.description}
              helperText={formErrors.description || `${newTaskForm.description.length}/2000 characters`}
              inputProps={{ maxLength: 2000 }}
              margin="normal"
              multiline
              rows={4}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: "'Literata', serif",
                  borderRadius: 1,
                },
                '& .MuiInputLabel-root': {
                  fontFamily: "'Literata', serif",
                },
              }}
            />
            <TextField
              fullWidth
              label="Due Date"
              type="date"
              value={newTaskForm.dueDate}
              onChange={(e) => setNewTaskForm({ ...newTaskForm, dueDate: e.target.value })}
              margin="normal"
              InputLabelProps={{
                shrink: true,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: "'Literata', serif",
                  borderRadius: 1,
                },
                '& .MuiInputLabel-root': {
                  fontFamily: "'Literata', serif",
                },
              }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => {
                setShowAddTaskDialog(false);
                setNewTaskForm({ taskName: '', description: '', dueDate: '' });
              }}
              sx={{
                color: '#666',
                textTransform: 'none',
                fontFamily: "'Literata', serif",
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddTask}
              variant="outlined"
              sx={{
                border: '2px solid #e16789',
                color: '#e16789',
                textTransform: 'none',
                borderRadius: 1,
                fontFamily: "'Literata', serif",
                fontWeight: 600,
                '&:hover': {
                  background: '#e16789',
                  border: '2px solid #e16789',
                  color: 'white',
                },
              }}
            >
              Add Task
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={!!showDeleteDialog}
          onClose={() => setShowDeleteDialog(null)}
          PaperProps={{
            sx: {
              borderRadius: 1,
            },
          }}
        >
          <DialogTitle
            sx={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 600,
            }}
          >
            Confirm Deletion
          </DialogTitle>
          <DialogContent>
            <Typography
              sx={{
                fontFamily: "'Literata', serif",
              }}
            >
              Are you sure you want to delete {showDeleteDialog?.type === 'task' ? `the task "${showDeleteDialog?.name}"` : 'this subtask'}?
              {showDeleteDialog?.type === 'task' && ' This will also delete all its subtasks.'}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setShowDeleteDialog(null)}
              sx={{
                color: '#666',
                textTransform: 'none',
                fontFamily: "'Literata', serif",
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteTask}
              variant="outlined"
              sx={{
                border: '2px solid #c62828',
                color: '#c62828',
                textTransform: 'none',
                borderRadius: 1,
                fontFamily: "'Literata', serif",
                fontWeight: 600,
                '&:hover': {
                  background: '#c62828',
                  border: '2px solid #c62828',
                  color: 'white',
                },
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Success Message */}
        <SuccessMessage
          open={successMessage.open}
          onClose={() => setSuccessMessage({ ...successMessage, open: false })}
          message={successMessage.message}
        />

        {/* Floating Action Button for adding tasks */}
        <Fab
          color="primary"
          aria-label="add task"
          onClick={() => setShowAddTaskDialog(true)}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            backgroundColor: '#e16789',
            color: 'white',
            '&:hover': {
              backgroundColor: '#d1567a',
              transform: 'scale(1.05)',
            },
            boxShadow: '0 4px 12px rgba(225, 103, 137, 0.4)',
            transition: 'all 0.2s ease',
            zIndex: 1000,
          }}
        >
          <AddIcon />
        </Fab>
      </Container>
    </Box>
  );
};

export default ChecklistPage;

