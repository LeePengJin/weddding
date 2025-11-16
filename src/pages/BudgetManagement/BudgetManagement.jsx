import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  LinearProgress,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Drawer,
  CircularProgress,
  Divider,
  Chip,
  Menu,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Savings as BudgetIcon,
  Close as CloseIcon,
  ChevronRight as ChevronRightIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
  Sort as SortIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { apiFetch } from '../../lib/api';
import ConfirmationDialog from '../../components/ConfirmationDialog/ConfirmationDialog';
import SuccessMessage from '../../components/SuccessMessage/SuccessMessage';
import './BudgetManagement.styles.css';

// Color palette for categories
const CATEGORY_COLORS = [
  '#e16789', '#ab47bc', '#f57c00', '#10b981', '#3b82f6',
  '#f97316', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16',
  '#f43f5e', '#f59e0b', '#6366f1', '#14b8a6', '#a855f7',
];

// Circular Progress Chart Component
const CircularProgressChart = ({ value, maxValue, size = 120, strokeWidth = 10 }) => {
  const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const getColor = () => {
    if (percentage > 100) return '#c62828';
    if (percentage > 80) return '#f57c00';
    return '#10b981';
  };

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f0f0f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        <Typography
          sx={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.5rem',
            fontWeight: 700,
            color: getColor(),
            lineHeight: 1,
          }}
        >
          {Math.round(percentage)}%
        </Typography>
      </Box>
    </Box>
  );
};

// Bar Chart Component for Estimated vs Actual
const BarChart = ({ data, maxValue }) => {
  if (!data || data.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <Typography sx={{ fontFamily: "'Literata', serif", color: '#999', fontStyle: 'italic' }}>
          No data available
        </Typography>
      </Box>
    );
  }

  const maxBarValue = maxValue || Math.max(...data.map(d => Math.max(d.estimated, d.actual)));
  const barHeight = 200;
  const barWidth = Math.max(300 / data.length, 40);

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: barHeight + 40, px: 1 }}>
      {data.map((item, index) => {
        const estimatedHeight = (item.estimated / maxBarValue) * barHeight;
        const actualHeight = (item.actual / maxBarValue) * barHeight;
        const isOverBudget = item.actual > item.estimated;

        return (
          <Box
            key={index}
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              minWidth: 60,
            }}
          >
            <Box sx={{ position: 'relative', width: '100%', height: barHeight, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {/* Estimated bar (background) */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  width: '60%',
                  height: `${estimatedHeight}px`,
                  backgroundColor: 'rgba(225, 103, 137, 0.2)',
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.3s ease',
                }}
              />
              {/* Actual bar (foreground) */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  width: '60%',
                  height: `${actualHeight}px`,
                  backgroundColor: isOverBudget ? '#f57c00' : '#e16789',
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.3s ease',
                  zIndex: 1,
                }}
              />
            </Box>
            <Typography
              sx={{
                fontFamily: "'Literata', serif",
                fontSize: '0.75rem',
                color: '#666',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
                maxWidth: barWidth,
              }}
            >
              {item.name}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

// Pie Chart Component
const PieChart = ({ data, onSegmentClick, hoveredSegment, onSegmentHover }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 280 }}>
        <Typography sx={{ fontFamily: "'Literata', serif", color: '#999', fontStyle: 'italic' }}>
          No expenses allocated yet
        </Typography>
      </Box>
    );
  }

  let cumulativePercentage = 0;
  const radius = 80;
  const centerX = 100;
  const centerY = 100;
  const circumference = 2 * Math.PI * radius;

  return (
    <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', py: 2 }}>
      <svg viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)', width: '100%', maxWidth: 280 }}>
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
          const strokeDashoffset = -(cumulativePercentage / 100) * circumference;
          cumulativePercentage += percentage;

          return (
            <circle
              key={index}
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={25}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              style={{
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                opacity: hoveredSegment === null || hoveredSegment === index ? 1 : 0.4,
                strokeWidth: hoveredSegment === index ? 30 : 25,
              }}
              onClick={() => onSegmentClick && onSegmentClick(item)}
              onMouseEnter={() => onSegmentHover && onSegmentHover(index)}
              onMouseLeave={() => onSegmentHover && onSegmentHover(null)}
            />
          );
        })}
      </svg>
      {hoveredSegment !== null && data[hoveredSegment] && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: 1,
            padding: 2,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            minWidth: 120,
          }}
        >
          <Typography
            sx={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 600,
              fontSize: '0.875rem',
              color: '#0f060d',
              mb: 0.5,
            }}
          >
            {data[hoveredSegment].name}
          </Typography>
          <Typography
            sx={{
              fontFamily: "'Literata', serif",
              fontSize: '1rem',
              fontWeight: 600,
              color: '#e16789',
            }}
          >
            RM {data[hoveredSegment].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Typography>
          <Typography
            sx={{
              fontFamily: "'Literata', serif",
              fontSize: '0.75rem',
              color: '#999',
              mt: 0.5,
            }}
          >
            {Math.round((data[hoveredSegment].value / total) * 100)}%
          </Typography>
        </Box>
      )}
    </Box>
  );
};

const BudgetManagement = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('projectId');

  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [editingBudgetValue, setEditingBudgetValue] = useState('');

  // Dialogs
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [showAddExpenseDialog, setShowAddExpenseDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(null);
  const [showEditExpenseDialog, setShowEditExpenseDialog] = useState(null);

  // Form states
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newExpense, setNewExpense] = useState({
    expenseName: '',
    estimatedCost: '',
    actualCost: '',
    remark: '',
  });
  const [editingExpense, setEditingExpense] = useState(null);

  // Search and sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name', 'estimated', 'actual', 'spent'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc', 'desc'
  const [sortMenuAnchor, setSortMenuAnchor] = useState(null);
  
  // Edit category state
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  
  // Form validation errors
  const [formErrors, setFormErrors] = useState({
    categoryName: '',
    expenseName: '',
    estimatedCost: '',
    actualCost: '',
    budget: '',
    remark: '',
  });

  // Success message state
  const [successMessage, setSuccessMessage] = useState({
    open: false,
    message: '',
  });

  useEffect(() => {
    if (projectId) {
      fetchBudget();
    } else {
      fetchFirstProject();
    }
  }, [projectId]);

  const fetchFirstProject = async () => {
    try {
      const projects = await apiFetch('/projects');
      if (projects && projects.length > 0) {
        navigate(`/budget?projectId=${projects[0].id}`, { replace: true });
      } else {
        setError('No projects found. Please create a project first.');
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to load projects');
      setLoading(false);
    }
  };

  const fetchBudget = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch(`/budgets/project/${projectId}`);
      setBudget(data);
    } catch (err) {
      setError(err.message || 'Failed to load budget');
      console.error('Error fetching budget:', err);
    } finally {
      setLoading(false);
    }
  };

  // SQL Injection protection
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

  // Validation functions
  const validateBudget = (value) => {
    if (!value) {
      return 'Budget is required';
    }
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      return 'Budget must be a positive number';
    }
    if (num > 10000000) {
      return 'Budget cannot exceed RM 10,000,000';
    }
    return '';
  };

  const validateExpenseName = (value) => {
    if (!value.trim()) {
      return 'Expense name is required';
    }
    if (value.trim().length > 200) {
      return 'Expense name must be 200 characters or less';
    }
    if (containsSQLInjection(value)) {
      return 'Expense name contains invalid characters';
    }
    return '';
  };

  const validateCost = (value, fieldName) => {
    if (!value) {
      if (fieldName === 'estimatedCost') {
        return 'Estimated cost is required';
      }
      return '';
    }
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      return 'Cost must be a positive number';
    }
    if (num > 10000000) {
      return 'Cost cannot exceed RM 10,000,000';
    }
    return '';
  };

  const validateCategoryName = (value) => {
    if (!value.trim()) {
      return 'Category name is required';
    }
    if (value.trim().length > 100) {
      return 'Category name must be 100 characters or less';
    }
    if (containsSQLInjection(value)) {
      return 'Category name contains invalid characters';
    }
    return '';
  };

  const validateRemark = (value) => {
    if (value && value.length > 500) {
      return 'Remark must be 500 characters or less';
    }
    if (value && containsSQLInjection(value)) {
      return 'Remark contains invalid characters';
    }
    return '';
  };

  const handleUpdateBudget = async () => {
    if (!budget) return;
    
    const error = validateBudget(editingBudgetValue);
    if (error) {
      setFormErrors(prev => ({ ...prev, budget: error }));
      return;
    }

    try {
      const totalBudget = parseFloat(editingBudgetValue);
      const updated = await apiFetch(`/budgets/${budget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ totalBudget }),
      });
      setBudget(updated);
      setIsEditingBudget(false);
      setEditingBudgetValue('');
      setFormErrors(prev => ({ ...prev, budget: '' }));
      setSuccessMessage({ open: true, message: 'Budget updated successfully!' });
    } catch (err) {
      console.error('Error updating budget:', err);
      alert('Failed to update budget');
    }
  };

  const handleAddCategory = async () => {
    if (!budget) return;
    
    const error = validateCategoryName(newCategoryName);
    if (error) {
      setFormErrors(prev => ({ ...prev, categoryName: error }));
      return;
    }

    try {
      const newCategory = await apiFetch(`/budgets/${budget.id}/categories`, {
        method: 'POST',
        body: JSON.stringify({ categoryName: newCategoryName.trim() }),
      });
      setBudget(prev => ({
        ...prev,
        categories: [...(prev.categories || []), newCategory],
      }));
      setNewCategoryName('');
      setShowAddCategoryDialog(false);
      setFormErrors(prev => ({ ...prev, categoryName: '' }));
      setSuccessMessage({ open: true, message: 'Category added successfully!' });
    } catch (err) {
      console.error('Error adding category:', err);
      alert('Failed to add category');
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategoryId || !budget) return;
    
    const error = validateCategoryName(editingCategoryName);
    if (error) {
      setFormErrors(prev => ({ ...prev, categoryName: error }));
      return;
    }

    try {
      const updated = await apiFetch(`/budgets/${budget.id}/categories/${editingCategoryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ categoryName: editingCategoryName.trim() }),
      });
      setBudget(prev => ({
        ...prev,
        categories: prev.categories.map(cat => cat.id === editingCategoryId ? updated : cat),
      }));
      if (selectedCategory?.id === editingCategoryId) {
        setSelectedCategory(updated);
      }
      setEditingCategoryId(null);
      setEditingCategoryName('');
      setFormErrors(prev => ({ ...prev, categoryName: '' }));
      setSuccessMessage({ open: true, message: 'Category updated successfully!' });
    } catch (err) {
      console.error('Error updating category:', err);
      alert('Failed to update category');
    }
  };

  const handleDeleteCategory = async () => {
    if (!showDeleteDialog || !budget) return;
    try {
      await apiFetch(`/budgets/${budget.id}/categories/${showDeleteDialog.id}`, {
        method: 'DELETE',
      });
      setBudget(prev => ({
        ...prev,
        categories: prev.categories.filter(cat => cat.id !== showDeleteDialog.id),
      }));
      if (selectedCategory?.id === showDeleteDialog.id) {
        setSelectedCategory(null);
      }
      setShowDeleteDialog(null);
      await fetchBudget();
      setSuccessMessage({ open: true, message: 'Category deleted successfully!' });
    } catch (err) {
      console.error('Error deleting category:', err);
      alert('Failed to delete category');
    }
  };

  const handleAddExpense = async () => {
    if (!selectedCategory || !budget) return;
    
    const nameError = validateExpenseName(newExpense.expenseName);
    const estimatedError = validateCost(newExpense.estimatedCost, 'estimatedCost');
    const actualError = newExpense.actualCost ? validateCost(newExpense.actualCost, 'actualCost') : '';
    const remarkError = validateRemark(newExpense.remark);
    
    if (nameError || estimatedError || actualError || remarkError) {
      setFormErrors(prev => ({
        ...prev,
        expenseName: nameError,
        estimatedCost: estimatedError,
        actualCost: actualError,
        remark: remarkError,
      }));
      return;
    }

    try {
      await apiFetch(`/budgets/${budget.id}/categories/${selectedCategory.id}/expenses`, {
        method: 'POST',
        body: JSON.stringify({
          expenseName: newExpense.expenseName.trim(),
          estimatedCost: parseFloat(newExpense.estimatedCost),
          actualCost: newExpense.actualCost ? parseFloat(newExpense.actualCost) : null,
          remark: newExpense.remark.trim() || null,
        }),
      });
      await fetchBudget();
      const updatedBudget = await apiFetch(`/budgets/project/${projectId}`);
      setSelectedCategory(updatedBudget.categories.find(cat => cat.id === selectedCategory.id));
      setNewExpense({ expenseName: '', estimatedCost: '', actualCost: '', remark: '' });
      setShowAddExpenseDialog(false);
      setFormErrors(prev => ({ ...prev, expenseName: '', estimatedCost: '', actualCost: '', remark: '' }));
      setSuccessMessage({ open: true, message: 'Expense added successfully!' });
    } catch (err) {
      console.error('Error adding expense:', err);
      alert('Failed to add expense');
    }
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense || !selectedCategory || !budget) return;
    
    const nameError = validateExpenseName(editingExpense.expenseName);
    const estimatedError = validateCost(editingExpense.estimatedCost, 'estimatedCost');
    const actualError = editingExpense.actualCost ? validateCost(editingExpense.actualCost, 'actualCost') : '';
    const remarkError = validateRemark(editingExpense.remark);
    
    if (nameError || estimatedError || actualError || remarkError) {
      setFormErrors(prev => ({
        ...prev,
        expenseName: nameError,
        estimatedCost: estimatedError,
        actualCost: actualError,
        remark: remarkError,
      }));
      return;
    }

    try {
      await apiFetch(`/budgets/${budget.id}/categories/${selectedCategory.id}/expenses/${editingExpense.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          expenseName: editingExpense.expenseName.trim(),
          estimatedCost: parseFloat(editingExpense.estimatedCost),
          actualCost: editingExpense.actualCost ? parseFloat(editingExpense.actualCost) : null,
          remark: editingExpense.remark.trim() || null,
        }),
      });
      await fetchBudget();
      const updatedBudget = await apiFetch(`/budgets/project/${projectId}`);
      setSelectedCategory(updatedBudget.categories.find(cat => cat.id === selectedCategory.id));
      setShowEditExpenseDialog(null);
      setEditingExpense(null);
      setFormErrors(prev => ({ ...prev, expenseName: '', estimatedCost: '', actualCost: '', remark: '' }));
      setSuccessMessage({ open: true, message: 'Expense updated successfully!' });
    } catch (err) {
      console.error('Error updating expense:', err);
      alert('Failed to update expense');
    }
  };

  const handleDeleteExpense = async () => {
    if (!showDeleteDialog || !selectedCategory || !budget) return;
    try {
      await apiFetch(`/budgets/${budget.id}/categories/${selectedCategory.id}/expenses/${showDeleteDialog.id}`, {
        method: 'DELETE',
      });
      await fetchBudget();
      const updatedBudget = await apiFetch(`/budgets/project/${projectId}`);
      setSelectedCategory(updatedBudget.categories.find(cat => cat.id === selectedCategory.id));
      setShowDeleteDialog(null);
      setSuccessMessage({ open: true, message: 'Expense deleted successfully!' });
    } catch (err) {
      console.error('Error deleting expense:', err);
      alert('Failed to delete expense');
    }
  };

  // Filter and sort categories
  const filteredAndSortedCategories = useMemo(() => {
    if (!budget?.categories) return [];
    
    let filtered = budget.categories;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(cat =>
        cat.categoryName.toLowerCase().includes(query)
      );
    }
    
    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      const aEstimated = a.expenses?.reduce((sum, exp) => sum + parseFloat(exp.estimatedCost || 0), 0) || 0;
      const aActual = a.expenses?.reduce((sum, exp) => sum + parseFloat(exp.actualCost || 0), 0) || 0;
      const bEstimated = b.expenses?.reduce((sum, exp) => sum + parseFloat(exp.estimatedCost || 0), 0) || 0;
      const bActual = b.expenses?.reduce((sum, exp) => sum + parseFloat(exp.actualCost || 0), 0) || 0;
      
      let result = 0;
      switch (sortBy) {
        case 'name':
          result = a.categoryName.localeCompare(b.categoryName);
          break;
        case 'estimated':
          result = aEstimated - bEstimated;
          break;
        case 'actual':
          result = aActual - bActual;
          break;
        case 'spent':
          result = aActual - bActual;
          break;
        default:
          result = a.categoryName.localeCompare(b.categoryName);
      }
      
      return sortDirection === 'desc' ? -result : result;
    });
    
    return sorted;
  }, [budget?.categories, searchQuery, sortBy, sortDirection]);

  // Calculate pie chart data
  const pieChartData = budget?.categories
    ?.filter(cat => {
      const estimatedTotal = cat.expenses?.reduce((sum, exp) => sum + parseFloat(exp.estimatedCost || 0), 0) || 0;
      return estimatedTotal > 0;
    })
    .map((cat, index) => {
      const estimatedTotal = cat.expenses?.reduce((sum, exp) => sum + parseFloat(exp.estimatedCost || 0), 0) || 0;
      return {
        name: cat.categoryName,
        value: estimatedTotal,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        category: cat,
      };
    }) || [];

  // Calculate totals
  const totalBudget = budget ? parseFloat(budget.totalBudget || 0) : 0;
  const totalSpent = budget ? parseFloat(budget.totalSpent || 0) : 0;
  const totalRemaining = budget ? parseFloat(budget.totalRemaining || 0) : 0;

  // Calculate statistics
  const totalCategories = budget?.categories?.length || 0;
  const totalExpenses = budget?.categories?.reduce((sum, cat) => sum + (cat.expenses?.length || 0), 0) || 0;
  const totalEstimated = budget?.categories?.reduce((sum, cat) => {
    return sum + (cat.expenses?.reduce((expSum, exp) => expSum + parseFloat(exp.estimatedCost || 0), 0) || 0);
  }, 0) || 0;
  const averageExpensePerCategory = totalCategories > 0 ? totalExpenses / totalCategories : 0;
  const budgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const overBudgetCategories = budget?.categories?.filter(cat => {
    const estimatedTotal = cat.expenses?.reduce((sum, exp) => sum + parseFloat(exp.estimatedCost || 0), 0) || 0;
    const actualTotal = cat.expenses?.reduce((sum, exp) => sum + parseFloat(exp.actualCost || 0), 0) || 0;
    return estimatedTotal > 0 && actualTotal > estimatedTotal;
  }).length || 0;
  
  // Top spending categories (by actual cost)
  const topSpendingCategories = budget?.categories
    ?.map(cat => {
      const actualTotal = cat.expenses?.reduce((sum, exp) => sum + parseFloat(exp.actualCost || 0), 0) || 0;
      return { name: cat.categoryName, amount: actualTotal };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3) || [];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress sx={{ color: '#e16789' }} />
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
    <Box sx={{ backgroundColor: '#f5f6fa', display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <Box
        sx={{
          width: { xs: 0, md: 320 },
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          backgroundColor: 'white',
          borderRight: '1px solid rgba(225, 103, 137, 0.1)',
        }}
      >
        <Box sx={{ p: 3, borderBottom: '1px solid rgba(225, 103, 137, 0.1)' }}>
          <Button
            component={Link}
            to={`/project-dashboard?projectId=${projectId}`}
            startIcon={<ArrowBackIcon />}
            sx={{
              color: '#666',
              textTransform: 'none',
              fontFamily: "'Literata', serif",
              mb: 2,
              '&:hover': { color: '#e16789', backgroundColor: 'rgba(225, 103, 137, 0.1)' },
            }}
          >
            Back
          </Button>
          <Typography
            variant="h5"
            sx={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 700,
              color: '#0f060d',
              mb: 1,
            }}
          >
            Budget Management
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setShowAddCategoryDialog(true)}
            fullWidth
            sx={{
              border: '2px solid #e16789',
              color: '#e16789',
              textTransform: 'none',
              borderRadius: 0.5,
              fontFamily: "'Literata', serif",
              fontWeight: 600,
              mt: 2,
              '&:hover': {
                background: '#e16789',
                border: '2px solid #e16789',
                color: 'white',
              },
            }}
          >
            New Category
          </Button>
        </Box>

        {/* Search and Sort */}
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(225, 103, 137, 0.1)' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#999', fontSize: '1.2rem' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                fontFamily: "'Literata', serif",
                borderRadius: 0.5,
              },
            }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<SortIcon />}
              onClick={(e) => setSortMenuAnchor(e.currentTarget)}
              sx={{
                border: '1px solid rgba(225, 103, 137, 0.3)',
                color: '#666',
                textTransform: 'none',
                fontFamily: "'Literata', serif",
                justifyContent: 'flex-start',
                flex: 1,
                '&:hover': {
                  borderColor: '#e16789',
                  backgroundColor: 'rgba(225, 103, 137, 0.05)',
                },
              }}
            >
              {sortBy === 'name' ? 'Name' : sortBy === 'estimated' ? 'Estimated' : sortBy === 'actual' ? 'Actual' : 'Spent'}
            </Button>
            <IconButton
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              sx={{
                border: '1px solid rgba(225, 103, 137, 0.3)',
                color: '#666',
                '&:hover': {
                  borderColor: '#e16789',
                  backgroundColor: 'rgba(225, 103, 137, 0.05)',
                },
              }}
            >
              {sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Menu
            anchorEl={sortMenuAnchor}
            open={Boolean(sortMenuAnchor)}
            onClose={() => setSortMenuAnchor(null)}
          >
            <MenuItem onClick={() => { setSortBy('name'); setSortMenuAnchor(null); }}>Name</MenuItem>
            <MenuItem onClick={() => { setSortBy('estimated'); setSortMenuAnchor(null); }}>Estimated Cost</MenuItem>
            <MenuItem onClick={() => { setSortBy('actual'); setSortMenuAnchor(null); }}>Actual Cost</MenuItem>
            <MenuItem onClick={() => { setSortBy('spent'); setSortMenuAnchor(null); }}>Amount Spent</MenuItem>
          </Menu>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
          {filteredAndSortedCategories.length > 0 ? (
            filteredAndSortedCategories.map((category, index) => {
              const estimatedTotal = category.expenses?.reduce(
                (sum, exp) => sum + parseFloat(exp.estimatedCost || 0),
                0
              ) || 0;
              const actualTotal = category.expenses?.reduce(
                (sum, exp) => sum + parseFloat(exp.actualCost || 0),
                0
              ) || 0;
              const isOverBudget = estimatedTotal > 0 && actualTotal > estimatedTotal;

              return (
                <Card
                  key={category.id}
                  onClick={() => setSelectedCategory(category)}
                  sx={{
                    p: 2,
                    mb: 1.5,
                    cursor: 'pointer',
                    border: selectedCategory?.id === category.id
                      ? '2px solid #e16789'
                      : isOverBudget
                      ? '2px solid #f57c00'
                      : '1px solid rgba(225, 103, 137, 0.2)',
                    backgroundColor: selectedCategory?.id === category.id
                      ? 'rgba(225, 103, 137, 0.05)'
                      : isOverBudget && selectedCategory?.id !== category.id
                      ? 'rgba(245, 124, 0, 0.05)'
                      : 'white',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateX(4px)',
                      borderColor: selectedCategory?.id === category.id ? '#e16789' : isOverBudget ? '#f57c00' : '#e16789',
                      boxShadow: '0 4px 12px rgba(225, 103, 137, 0.15)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      {editingCategoryId === category.id ? (
                        <TextField
                          value={editingCategoryName}
                          onChange={(e) => {
                            setEditingCategoryName(e.target.value);
                            setFormErrors(prev => ({ ...prev, categoryName: '' }));
                          }}
                          onBlur={() => {
                            if (editingCategoryName.trim() && editingCategoryName !== category.categoryName) {
                              handleUpdateCategory();
                            } else {
                              setEditingCategoryId(null);
                              setEditingCategoryName('');
                            }
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              if (editingCategoryName.trim() && editingCategoryName !== category.categoryName) {
                                handleUpdateCategory();
                              } else {
                                setEditingCategoryId(null);
                                setEditingCategoryName('');
                              }
                            } else if (e.key === 'Escape') {
                              setEditingCategoryId(null);
                              setEditingCategoryName('');
                            }
                          }}
                          error={!!formErrors.categoryName}
                          helperText={formErrors.categoryName}
                          autoFocus
                          size="small"
                          sx={{
                            flex: 1,
                            '& .MuiOutlinedInput-root': {
                              fontFamily: "'Playfair Display', serif",
                              fontWeight: 600,
                              fontSize: '1rem',
                            },
                          }}
                        />
                      ) : (
                        <>
                          <Typography
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCategoryId(category.id);
                              setEditingCategoryName(category.categoryName);
                            }}
                            sx={{
                              fontFamily: "'Playfair Display', serif",
                              fontWeight: 600,
                              fontSize: '1rem',
                              color: '#0f060d',
                              cursor: 'pointer',
                              '&:hover': {
                                color: '#e16789',
                                textDecoration: 'underline',
                              },
                            }}
                          >
                            {category.categoryName}
                          </Typography>
                          {isOverBudget && (
                            <Chip
                              icon={<WarningIcon sx={{ fontSize: '0.875rem !important' }} />}
                              label="Over Budget"
                              size="small"
                              sx={{
                                backgroundColor: '#fff3e0',
                                color: '#f57c00',
                                fontFamily: "'Literata', serif",
                                fontSize: '0.75rem',
                                height: 20,
                                '& .MuiChip-icon': {
                                  color: '#f57c00',
                                },
                              }}
                            />
                          )}
                        </>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {editingCategoryId !== category.id && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategoryId(category.id);
                            setEditingCategoryName(category.categoryName);
                          }}
                          sx={{
                            color: '#999',
                            '&:hover': { color: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)' },
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteDialog({ type: 'category', id: category.id, name: category.categoryName });
                        }}
                        sx={{
                          color: '#999',
                          '&:hover': { color: '#e16789', backgroundColor: 'rgba(225, 103, 137, 0.1)' },
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                      <ChevronRightIcon sx={{ fontSize: '1.2rem', color: '#999', ml: 0.5 }} />
                    </Box>
                  </Box>
                  <Typography
                    sx={{
                      fontFamily: "'Literata', serif",
                      fontSize: '0.875rem',
                      color: '#666',
                      mb: 1,
                    }}
                  >
                    Estimated: RM {estimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: "'Literata', serif",
                      fontSize: '0.875rem',
                      color: isOverBudget ? '#f57c00' : '#e16789',
                      fontWeight: 600,
                    }}
                  >
                    Spent: RM {actualTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  {estimatedTotal > 0 && (
                    <LinearProgress
                      variant="determinate"
                      value={Math.min((actualTotal / estimatedTotal) * 100, 100)}
                      sx={{
                        height: 6,
                        borderRadius: 0.5,
                        mt: 1.5,
                        backgroundColor: '#f0f0f0',
                        '& .MuiLinearProgress-bar': {
                          background: isOverBudget
                            ? 'linear-gradient(90deg, #f57c00 0%, #ff9800 100%)'
                            : 'linear-gradient(90deg, #e16789 0%, #ab47bc 100%)',
                          borderRadius: 0.5,
                        },
                      }}
                    />
                  )}
                </Card>
              );
            })
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography
                sx={{
                  fontFamily: "'Literata', serif",
                  color: '#999',
                  fontStyle: 'italic',
                }}
              >
                {searchQuery ? 'No categories found' : 'No categories yet'}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, minHeight: '100vh' }}>
        {/* Mobile Header */}
        <Box
          sx={{
            display: { xs: 'block', md: 'none' },
            p: 2,
            backgroundColor: 'white',
            borderBottom: '1px solid rgba(225, 103, 137, 0.1)',
          }}
        >
          <Button
            component={Link}
            to={`/project-dashboard?projectId=${projectId}`}
            startIcon={<ArrowBackIcon />}
            sx={{
              color: '#666',
              textTransform: 'none',
              fontFamily: "'Literata', serif",
              mb: 2,
            }}
          >
            Back
          </Button>
          <Typography
            variant="h5"
            sx={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 700,
              color: '#0f060d',
            }}
          >
            Budget Management
          </Typography>
        </Box>

        {!selectedCategory ? (
          // Overview Page
          <Container maxWidth="lg" sx={{ py: 4, px: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3, mb: 4 }}>
              {/* Budget Section */}
              <Card
                sx={{
                  borderRadius: 0.5,
                  padding: 4,
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 1) 100%)',
                  border: '1px solid rgba(225, 103, 137, 0.1)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 0.5,
                      background: 'transparent',
                      border: '2px solid #e16789',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#e16789',
                    }}
                  >
                    <BudgetIcon sx={{ fontSize: '1.5rem' }} />
                  </Box>
                  <Typography
                    variant="h5"
                    sx={{
                      fontFamily: "'Playfair Display', serif",
                      fontWeight: 600,
                    }}
                  >
                    Total Budget
                  </Typography>
                </Box>

                {isEditingBudget ? (
                  <Box>
                    <TextField
                      fullWidth
                      type="number"
                      value={editingBudgetValue}
                      onChange={(e) => {
                        setEditingBudgetValue(e.target.value);
                        setFormErrors(prev => ({ ...prev, budget: '' }));
                      }}
                      placeholder="Enter total budget"
                      error={!!formErrors.budget}
                      helperText={formErrors.budget}
                      InputProps={{
                        startAdornment: <Typography sx={{ mr: 1, fontFamily: "'Literata', serif" }}>RM</Typography>,
                      }}
                      sx={{
                        mb: 2,
                        '& .MuiOutlinedInput-root': {
                          fontFamily: "'Literata', serif",
                          fontSize: '1.5rem',
                          fontWeight: 600,
                        },
                      }}
                      autoFocus
                    />
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setIsEditingBudget(false);
                          setEditingBudgetValue('');
                          setFormErrors(prev => ({ ...prev, budget: '' }));
                        }}
                        fullWidth
                        sx={{
                          textTransform: 'none',
                          fontFamily: "'Literata', serif",
                          borderColor: '#e16789',
                          color: '#e16789',
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleUpdateBudget}
                        fullWidth
                        sx={{
                          textTransform: 'none',
                          fontFamily: "'Literata', serif",
                          background: '#e16789',
                          '&:hover': { background: '#d1537a' },
                        }}
                      >
                        Save
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 1,
                        mb: 4,
                        cursor: 'pointer',
                        '&:hover': { opacity: 0.8 },
                      }}
                      onClick={() => {
                        setIsEditingBudget(true);
                        setEditingBudgetValue(totalBudget.toString());
                      }}
                    >
                      <Typography
                        sx={{
                          fontFamily: "'Literata', serif",
                          fontSize: '1rem',
                          color: '#666',
                          fontWeight: 500,
                        }}
                      >
                        RM
                      </Typography>
                      <Typography
                        sx={{
                          fontFamily: "'Playfair Display', serif",
                          fontSize: '3rem',
                          fontWeight: 700,
                          color: '#0f060d',
                        }}
                      >
                        {totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                      <EditIcon sx={{ fontSize: '1.2rem', color: '#999', ml: 1 }} />
                    </Box>

                    {/* Budget Utilization Circular Progress */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                      <CircularProgressChart value={totalSpent} maxValue={totalBudget} size={120} />
                      <Box sx={{ flex: 1, minWidth: 200 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                          <Typography sx={{ fontFamily: "'Literata', serif", fontSize: '0.875rem', color: '#666' }}>
                            Total Spent
                          </Typography>
                          <Typography sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, color: '#e16789' }}>
                            RM {totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography sx={{ fontFamily: "'Literata', serif", fontSize: '0.875rem', color: '#666' }}>
                            Remaining
                          </Typography>
                          <Typography
                            sx={{
                              fontFamily: "'Playfair Display', serif",
                              fontWeight: 600,
                              color: totalRemaining >= 0 ? '#10b981' : '#c62828',
                            }}
                          >
                            RM {Math.abs(totalRemaining).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                )}
              </Card>

              {/* Pie Chart Section */}
              <Card
                sx={{
                  borderRadius: 0.5,
                  padding: 4,
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 1) 100%)',
                  border: '1px solid rgba(225, 103, 137, 0.1)',
                }}
              >
                <Typography
                  variant="h5"
                  sx={{
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 600,
                    mb: 3,
                  }}
                >
                  Budget Allocation
                </Typography>

                <PieChart
                  data={pieChartData}
                  onSegmentClick={(item) => setSelectedCategory(item.category)}
                  hoveredSegment={hoveredSegment}
                  onSegmentHover={setHoveredSegment}
                />

                {/* Legend - 2 per row */}
                {pieChartData.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                      {pieChartData.map((item, index) => (
                        <Box
                          key={index}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            padding: 1.5,
                            borderRadius: 0.5,
                            cursor: 'pointer',
                            transition: 'background-color 0.2s ease',
                            backgroundColor: hoveredSegment === index ? 'rgba(225, 103, 137, 0.1)' : 'transparent',
                          }}
                          onClick={() => setSelectedCategory(item.category)}
                          onMouseEnter={() => setHoveredSegment(index)}
                          onMouseLeave={() => setHoveredSegment(null)}
                        >
                          <Box
                            sx={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              backgroundColor: item.color,
                              flexShrink: 0,
                            }}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              sx={{
                                fontFamily: "'Playfair Display', serif",
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.name}
                            </Typography>
                            <Typography
                              sx={{
                                fontFamily: "'Literata', serif",
                                fontSize: '0.75rem',
                                color: '#666',
                              }}
                            >
                              RM {item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Card>
            </Box>

            {/* Budget Statistics Section */}
            <Box sx={{ mt: 4 }}>
              <Typography
                variant="h5"
                sx={{
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 600,
                  mb: 3,
                  color: '#0f060d',
                }}
              >
                Budget Overview
              </Typography>

              {/* Estimated vs Actual Comparison Chart */}
              {budget?.categories && budget.categories.length > 0 && (
                <Card
                  sx={{
                    borderRadius: 0.5,
                    padding: 3,
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 1) 100%)',
                    border: '1px solid rgba(225, 103, 137, 0.1)',
                    mb: 2,
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: "'Playfair Display', serif",
                      fontWeight: 600,
                      fontSize: '1.125rem',
                      mb: 3,
                      color: '#0f060d',
                    }}
                  >
                    Estimated vs Actual by Category
                  </Typography>
                  <BarChart
                    data={budget.categories
                      .filter(cat => {
                        const estimated = cat.expenses?.reduce((sum, exp) => sum + parseFloat(exp.estimatedCost || 0), 0) || 0;
                        const actual = cat.expenses?.reduce((sum, exp) => sum + parseFloat(exp.actualCost || 0), 0) || 0;
                        return estimated > 0 || actual > 0;
                      })
                      .map(cat => ({
                        name: cat.categoryName,
                        estimated: cat.expenses?.reduce((sum, exp) => sum + parseFloat(exp.estimatedCost || 0), 0) || 0,
                        actual: cat.expenses?.reduce((sum, exp) => sum + parseFloat(exp.actualCost || 0), 0) || 0,
                      }))}
                    maxValue={Math.max(totalEstimated, totalSpent)}
                  />
                  <Box sx={{ display: 'flex', gap: 3, mt: 2, justifyContent: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 16, height: 16, backgroundColor: 'rgba(225, 103, 137, 0.2)', borderRadius: 0.5 }} />
                      <Typography sx={{ fontFamily: "'Literata', serif", fontSize: '0.875rem', color: '#666' }}>
                        Estimated
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 16, height: 16, backgroundColor: '#e16789', borderRadius: 0.5 }} />
                      <Typography sx={{ fontFamily: "'Literata', serif", fontSize: '0.875rem', color: '#666' }}>
                        Actual
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 16, height: 16, backgroundColor: '#f57c00', borderRadius: 0.5 }} />
                      <Typography sx={{ fontFamily: "'Literata', serif", fontSize: '0.875rem', color: '#666' }}>
                        Over Budget
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              )}

              {/* Top Spending Categories */}
              {topSpendingCategories.length > 0 && (
                <Card
                  sx={{
                    borderRadius: 0.5,
                    padding: 2.5,
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 1) 100%)',
                    border: '1px solid rgba(225, 103, 137, 0.1)',
                    mt: 2,
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: "'Playfair Display', serif",
                      fontWeight: 600,
                      fontSize: '1.125rem',
                      mb: 2,
                      color: '#0f060d',
                    }}
                  >
                    Top Spending Categories
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {topSpendingCategories.map((cat, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          p: 1.5,
                          borderRadius: 0.5,
                          backgroundColor: index === 0 ? 'rgba(225, 103, 137, 0.05)' : 'transparent',
                          border: index === 0 ? '1px solid rgba(225, 103, 137, 0.2)' : 'none',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              backgroundColor: index === 0 ? '#e16789' : index === 1 ? '#ab47bc' : '#f57c00',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontFamily: "'Playfair Display', serif",
                              fontWeight: 700,
                              fontSize: '0.875rem',
                            }}
                          >
                            {index + 1}
                          </Box>
                          <Typography
                            sx={{
                              fontFamily: "'Playfair Display', serif",
                              fontWeight: 600,
                              fontSize: '1rem',
                              color: '#0f060d',
                            }}
                          >
                            {cat.name}
                          </Typography>
                        </Box>
                        <Typography
                          sx={{
                            fontFamily: "'Literata', serif",
                            fontWeight: 600,
                            fontSize: '1rem',
                            color: '#e16789',
                          }}
                        >
                          RM {cat.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Card>
              )}
            </Box>
          </Container>
        ) : (
          // Category Detail View
          <Container maxWidth="lg" sx={{ py: 4, px: { xs: 2, md: 3 } }}>
            <Card
              sx={{
                borderRadius: 0.5,
                padding: 4,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 1) 100%)',
                border: '1px solid rgba(225, 103, 137, 0.1)',
                mb: 3,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography
                  variant="h4"
                  sx={{
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 700,
                  }}
                >
                  {selectedCategory.categoryName}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setNewExpense({ expenseName: '', estimatedCost: '', actualCost: '', remark: '' });
                      setShowAddExpenseDialog(true);
                    }}
                    sx={{
                      border: '2px solid #e16789',
                      color: '#e16789',
                      textTransform: 'none',
                      fontFamily: "'Literata', serif",
                      fontWeight: 600,
                      '&:hover': {
                        background: '#e16789',
                        border: '2px solid #e16789',
                        color: 'white',
                      },
                    }}
                  >
                    Add Expense
                  </Button>
                  <IconButton
                    onClick={() => setSelectedCategory(null)}
                    sx={{
                      color: '#999',
                      '&:hover': { color: '#e16789' },
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Box>
              </Box>

              {/* Progress Bar */}
              {(() => {
                const estimatedTotal = selectedCategory.expenses?.reduce(
                  (sum, exp) => sum + parseFloat(exp.estimatedCost || 0),
                  0
                ) || 0;
                const actualTotal = selectedCategory.expenses?.reduce(
                  (sum, exp) => sum + parseFloat(exp.actualCost || 0),
                  0
                ) || 0;
                const progress = estimatedTotal > 0 ? Math.min((actualTotal / estimatedTotal) * 100, 100) : 0;
                const isOverBudget = estimatedTotal > 0 && actualTotal > estimatedTotal;

                return (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                      <Typography
                        sx={{
                          fontFamily: "'Literata', serif",
                          fontSize: '0.875rem',
                          color: '#666',
                        }}
                      >
                        Estimated: RM {estimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isOverBudget && (
                          <Chip
                            icon={<WarningIcon sx={{ fontSize: '0.875rem !important' }} />}
                            label="Over Budget"
                            size="small"
                            sx={{
                            backgroundColor: '#fff3e0',
                            color: '#f57c00',
                              fontFamily: "'Literata', serif",
                              fontSize: '0.75rem',
                              height: 24,
                              '& .MuiChip-icon': {
                                color: '#f57c00',
                              },
                            }}
                          />
                        )}
                        <Typography
                          sx={{
                            fontFamily: "'Literata', serif",
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: isOverBudget ? '#f57c00' : '#e16789',
                          }}
                        >
                          Actual: RM {actualTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      </Box>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        height: 12,
                        borderRadius: 0.5,
                        backgroundColor: '#f0f0f0',
                        '& .MuiLinearProgress-bar': {
                          background: isOverBudget
                            ? 'linear-gradient(90deg, #f57c00 0%, #ff9800 100%)'
                            : 'linear-gradient(90deg, #e16789 0%, #ab47bc 100%)',
                          borderRadius: 0.5,
                        },
                      }}
                    />
                  </Box>
                );
              })()}
            </Card>

            {/* Expenses Table */}
            <Card
              sx={{
                borderRadius: 0.5,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 1) 100%)',
                border: '1px solid rgba(225, 103, 137, 0.1)',
                overflow: 'hidden',
              }}
            >
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'rgba(225, 103, 137, 0.05)' }}>
                      <TableCell sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: '0.875rem', textAlign: 'center' }}>Name</TableCell>
                      <TableCell sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: '0.875rem', textAlign: 'center' }}>Estimated Cost</TableCell>
                      <TableCell sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: '0.875rem', textAlign: 'center' }}>Actual Cost</TableCell>
                      <TableCell sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: '0.875rem', textAlign: 'center' }}>Note</TableCell>
                      <TableCell sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: '0.875rem', textAlign: 'center' }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedCategory.expenses && selectedCategory.expenses.length > 0 ? (
                      <>
                        {selectedCategory.expenses.map((expense) => (
                          <TableRow
                            key={expense.id}
                            className="expense-table-row"
                          >
                            <TableCell sx={{ fontFamily: "'Literata', serif" }}>{expense.expenseName}</TableCell>
                            <TableCell sx={{ fontFamily: "'Literata', serif", textAlign: 'center' }}>
                              RM {parseFloat(expense.estimatedCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell sx={{ fontFamily: "'Literata', serif", textAlign: 'center' }}>
                              {expense.actualCost
                                ? `RM ${parseFloat(expense.actualCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '-'}
                            </TableCell>
                            <TableCell sx={{ fontFamily: "'Literata', serif", color: '#666', maxWidth: 200 }}>
                              {expense.remark || '-'}
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditingExpense({
                                      id: expense.id,
                                      expenseName: expense.expenseName,
                                      estimatedCost: expense.estimatedCost?.toString() || '',
                                      actualCost: expense.actualCost?.toString() || '',
                                      remark: expense.remark || '',
                                    });
                                    setShowEditExpenseDialog(expense.id);
                                  }}
                                  sx={{
                                    color: '#666',
                                    '&:hover': { color: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)' },
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => setShowDeleteDialog({ type: 'expense', id: expense.id, name: expense.expenseName })}
                                  sx={{
                                    color: '#666',
                                    '&:hover': { color: '#e16789', backgroundColor: 'rgba(225, 103, 137, 0.1)' },
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow sx={{ backgroundColor: 'rgba(225, 103, 137, 0.05)' }}>
                          <TableCell sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>Total</TableCell>
                          <TableCell sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, textAlign: 'center' }}>
                            RM {selectedCategory.expenses
                              .reduce((sum, exp) => sum + parseFloat(exp.estimatedCost || 0), 0)
                              .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, textAlign: 'center' }}>
                            RM {selectedCategory.expenses
                              .reduce((sum, exp) => sum + parseFloat(exp.actualCost || 0), 0)
                              .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                          <Typography
                            sx={{
                              fontFamily: "'Literata', serif",
                              color: '#999',
                              fontStyle: 'italic',
                            }}
                          >
                            No expenses yet. Click "Add Expense" to get started.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Container>
        )}
      </Box>

      {/* Add Category Dialog */}
      <Dialog
        open={showAddCategoryDialog}
        onClose={() => {
          setShowAddCategoryDialog(false);
          setNewCategoryName('');
          setFormErrors(prev => ({ ...prev, categoryName: '' }));
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <DialogTitle sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>
          Add New Category
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Category Name"
            value={newCategoryName}
            onChange={(e) => {
              setNewCategoryName(e.target.value);
              setFormErrors(prev => ({ ...prev, categoryName: '' }));
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && newCategoryName.trim()) {
                handleAddCategory();
              }
            }}
            error={!!formErrors.categoryName}
            helperText={formErrors.categoryName}
            sx={{
              mt: 2,
              '& .MuiOutlinedInput-root': {
                fontFamily: "'Literata', serif",
                borderRadius: 0.5,
              },
            }}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setShowAddCategoryDialog(false);
              setNewCategoryName('');
              setFormErrors(prev => ({ ...prev, categoryName: '' }));
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
            onClick={handleAddCategory}
            variant="outlined"
            disabled={!newCategoryName.trim()}
            sx={{
              border: '2px solid #e16789',
              color: '#e16789',
              textTransform: 'none',
              borderRadius: 0.5,
              fontFamily: "'Literata', serif",
              fontWeight: 600,
              '&:hover': {
                background: '#e16789',
                border: '2px solid #e16789',
                color: 'white',
              },
              '&:disabled': {
                borderColor: '#ccc',
                color: '#ccc',
              },
            }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog
        open={showAddExpenseDialog}
        onClose={() => {
          setShowAddExpenseDialog(false);
          setNewExpense({ expenseName: '', estimatedCost: '', actualCost: '', remark: '' });
          setFormErrors(prev => ({ ...prev, expenseName: '', estimatedCost: '', actualCost: '' }));
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <DialogTitle sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>
          Add New Expense
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Expense Name *"
            value={newExpense.expenseName}
            onChange={(e) => {
              setNewExpense({ ...newExpense, expenseName: e.target.value });
              setFormErrors(prev => ({ ...prev, expenseName: '' }));
            }}
            margin="normal"
            error={!!formErrors.expenseName}
            helperText={formErrors.expenseName}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: "'Literata', serif",
                borderRadius: 0.5,
              },
            }}
          />
          <TextField
            fullWidth
            label="Estimated Cost *"
            type="number"
            value={newExpense.estimatedCost}
            onChange={(e) => {
              setNewExpense({ ...newExpense, estimatedCost: e.target.value });
              setFormErrors(prev => ({ ...prev, estimatedCost: '' }));
            }}
            margin="normal"
            error={!!formErrors.estimatedCost}
            helperText={formErrors.estimatedCost}
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1, fontFamily: "'Literata', serif" }}>RM</Typography>,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: "'Literata', serif",
                borderRadius: 0.5,
              },
            }}
          />
          <TextField
            fullWidth
            label="Actual Cost"
            type="number"
            value={newExpense.actualCost}
            onChange={(e) => {
              setNewExpense({ ...newExpense, actualCost: e.target.value });
              setFormErrors(prev => ({ ...prev, actualCost: '' }));
            }}
            margin="normal"
            error={!!formErrors.actualCost}
            helperText={formErrors.actualCost}
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1, fontFamily: "'Literata', serif" }}>RM</Typography>,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: "'Literata', serif",
                borderRadius: 0.5,
              },
            }}
          />
          <TextField
            fullWidth
            label="Note/Remark"
            value={newExpense.remark}
            onChange={(e) => {
              setNewExpense({ ...newExpense, remark: e.target.value });
              setFormErrors(prev => ({ ...prev, remark: '' }));
            }}
            margin="normal"
            multiline
            rows={3}
            error={!!formErrors.remark}
            helperText={formErrors.remark}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: "'Literata', serif",
                borderRadius: 0.5,
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setShowAddExpenseDialog(false);
              setNewExpense({ expenseName: '', estimatedCost: '', actualCost: '', remark: '' });
              setFormErrors(prev => ({ ...prev, expenseName: '', estimatedCost: '', actualCost: '' }));
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
            onClick={handleAddExpense}
            variant="outlined"
            disabled={!newExpense.expenseName.trim() || !newExpense.estimatedCost}
            sx={{
              border: '2px solid #e16789',
              color: '#e16789',
              textTransform: 'none',
              borderRadius: 0.5,
              fontFamily: "'Literata', serif",
              fontWeight: 600,
              '&:hover': {
                background: '#e16789',
                border: '2px solid #e16789',
                color: 'white',
              },
              '&:disabled': {
                borderColor: '#ccc',
                color: '#ccc',
              },
            }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog
        open={!!showEditExpenseDialog}
        onClose={() => {
          setShowEditExpenseDialog(null);
          setEditingExpense(null);
          setFormErrors(prev => ({ ...prev, expenseName: '', estimatedCost: '', actualCost: '', remark: '' }));
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <DialogTitle sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>
          Edit Expense
        </DialogTitle>
        <DialogContent>
          {editingExpense && (
            <>
              <TextField
                fullWidth
                label="Expense Name *"
                value={editingExpense.expenseName}
                onChange={(e) => {
                  setEditingExpense({ ...editingExpense, expenseName: e.target.value });
                  setFormErrors(prev => ({ ...prev, expenseName: '' }));
                }}
                margin="normal"
                error={!!formErrors.expenseName}
                helperText={formErrors.expenseName}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontFamily: "'Literata', serif",
                    borderRadius: 0.5,
                  },
                }}
              />
              <TextField
                fullWidth
                label="Estimated Cost *"
                type="number"
                value={editingExpense.estimatedCost}
                onChange={(e) => {
                  setEditingExpense({ ...editingExpense, estimatedCost: e.target.value });
                  setFormErrors(prev => ({ ...prev, estimatedCost: '' }));
                }}
                margin="normal"
                error={!!formErrors.estimatedCost}
                helperText={formErrors.estimatedCost}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1, fontFamily: "'Literata', serif" }}>RM</Typography>,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontFamily: "'Literata', serif",
                    borderRadius: 0.5,
                  },
                }}
              />
              <TextField
                fullWidth
                label="Actual Cost"
                type="number"
                value={editingExpense.actualCost}
                onChange={(e) => {
                  setEditingExpense({ ...editingExpense, actualCost: e.target.value });
                  setFormErrors(prev => ({ ...prev, actualCost: '' }));
                }}
                margin="normal"
                error={!!formErrors.actualCost}
                helperText={formErrors.actualCost}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1, fontFamily: "'Literata', serif" }}>RM</Typography>,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontFamily: "'Literata', serif",
                    borderRadius: 0.5,
                  },
                }}
              />
              <TextField
                fullWidth
                label="Note/Remark"
                value={editingExpense.remark}
                onChange={(e) => {
                  setEditingExpense({ ...editingExpense, remark: e.target.value });
                  setFormErrors(prev => ({ ...prev, remark: '' }));
                }}
                margin="normal"
                multiline
                rows={3}
                error={!!formErrors.remark}
                helperText={formErrors.remark}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontFamily: "'Literata', serif",
                    borderRadius: 0.5,
                  },
                }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setShowEditExpenseDialog(null);
              setEditingExpense(null);
              setFormErrors(prev => ({ ...prev, expenseName: '', estimatedCost: '', actualCost: '', remark: '' }));
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
            onClick={handleUpdateExpense}
            variant="outlined"
            disabled={!editingExpense?.expenseName?.trim() || !editingExpense?.estimatedCost}
            sx={{
              border: '2px solid #e16789',
              color: '#e16789',
              textTransform: 'none',
              borderRadius: 0.5,
              fontFamily: "'Literata', serif",
              fontWeight: 600,
              '&:hover': {
                background: '#e16789',
                border: '2px solid #e16789',
                color: 'white',
              },
              '&:disabled': {
                borderColor: '#ccc',
                color: '#ccc',
              },
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={!!showDeleteDialog}
        onClose={() => setShowDeleteDialog(null)}
        onConfirm={showDeleteDialog?.type === 'category' ? handleDeleteCategory : handleDeleteExpense}
        title="Confirm Deletion"
        description={
          showDeleteDialog?.type === 'category'
            ? `Are you sure you want to delete the category "${showDeleteDialog?.name}"? This will also delete all expenses in this category.`
            : `Are you sure you want to delete the expense "${showDeleteDialog?.name}"?`
        }
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Success Message */}
      <SuccessMessage
        open={successMessage.open}
        onClose={() => setSuccessMessage({ ...successMessage, open: false })}
        message={successMessage.message}
      />
    </Box>
  );
};

export default BudgetManagement;
