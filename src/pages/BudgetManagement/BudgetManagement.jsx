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
  Snackbar,
  Alert,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
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
import { FormControlLabel, Checkbox } from '@mui/material';
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

// Bar Chart Component for Estimated vs Actual (Stacked Bar Chart)
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
  const barWidth = 60;

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: barHeight + 60, px: 2, py: 2 }}>
      {data.map((item, index) => {
        const estimatedHeight = (item.estimated / maxBarValue) * barHeight;
        const actualHeight = (item.actual / maxBarValue) * barHeight;
        const isOverBudget = item.actual > item.estimated;
        const overBudgetAmount = isOverBudget ? item.actual - item.estimated : 0;
        const overBudgetHeight = (overBudgetAmount / maxBarValue) * barHeight;

        return (
          <Box
            key={index}
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              minWidth: 80,
            }}
          >
            {/* Stacked bar container - single bar per category */}
            <Box 
              sx={{ 
                position: 'relative', 
                width: barWidth, 
                height: barHeight, 
                display: 'flex', 
                alignItems: 'flex-end',
                justifyContent: 'center',
              }}
            >
              {/* Over Budget segment (back layer, z-index: 1) - shows excess above estimated when over budget */}
              {isOverBudget && (
                <Tooltip
                  title={`Over Budget: RM ${overBudgetAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  arrow
                  placement="top"
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: estimatedHeight,
                      left: 0,
                      right: 0,
                      height: `${overBudgetHeight}px`,
                      backgroundColor: '#f57c00',
                      borderRadius: '4px 4px 0 0',
                      transition: 'all 0.3s ease',
                      zIndex: 1,
                      cursor: 'pointer',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      '&:hover': {
                        opacity: 0.85,
                        borderColor: 'rgba(0, 0, 0, 0.2)',
                      },
                    }}
                  />
                </Tooltip>
              )}
              
              {/* Estimated segment (middle layer, z-index: 2) - always visible as base */}
              <Tooltip
                title={`Estimated: RM ${item.estimated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                arrow
                placement="top"
              >
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${estimatedHeight}px`,
                    backgroundColor: 'rgba(225, 103, 137, 0.2)',
                    borderRadius: isOverBudget ? '0' : '4px 4px 0 0',
                    transition: 'all 0.3s ease',
                    zIndex: 2,
                    cursor: 'pointer',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    '&:hover': {
                      opacity: 0.85,
                      borderColor: 'rgba(0, 0, 0, 0.2)',
                    },
                  }}
                />
              </Tooltip>
              
              {/* Actual segment (front layer, z-index: 3) - shows actual up to estimated height */}
              <Tooltip
                title={`Actual: RM ${item.actual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                arrow
                placement="top"
              >
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${Math.min(actualHeight, estimatedHeight)}px`,
                    backgroundColor: '#e16789',
                    borderRadius: isOverBudget ? '0' : '4px 4px 0 0',
                    transition: 'all 0.3s ease',
                    zIndex: 3,
                    cursor: 'pointer',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    '&:hover': {
                      opacity: 0.85,
                      borderColor: 'rgba(0, 0, 0, 0.2)',
                    },
                  }}
                />
              </Tooltip>
            </Box>
            
            {/* Category name below the bar */}
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
                fontWeight: 500,
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
  const [toast, setToast] = useState({ open: false, message: '', severity: 'error' });
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
  const [designItems, setDesignItems] = useState([]); // 3D design items
  const [loadingDesignItems, setLoadingDesignItems] = useState(false);
  const [showMoveToCategoryDialog, setShowMoveToCategoryDialog] = useState(null); // { item, categoryId, markAsPaid, createNew, newCategoryName }
  const [showPaymentBreakdown, setShowPaymentBreakdown] = useState(null); // expenseId
  const [showMoveExpenseDialog, setShowMoveExpenseDialog] = useState(null); // { expense, categoryId, createNew, newCategoryName }
  
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
    // Clear all state when projectId changes
    setBudget(null);
    setSelectedCategory(null);
    setHoveredSegment(null);
    setIsEditingBudget(false);
    setEditingBudgetValue('');
    setNewCategoryName('');
    setNewExpense({ expenseName: '', estimatedCost: '', actualCost: '', remark: '' });
    setEditingExpense(null);
    setSearchQuery('');
    setEditingCategoryId(null);
    setEditingCategoryName('');
    setFormErrors({
      categoryName: '',
      expenseName: '',
      estimatedCost: '',
      actualCost: '',
      budget: '',
      remark: '',
    });
    setDesignItems([]);
    setShowMoveToCategoryDialog(null);
    setShowPaymentBreakdown(null);
    setShowMoveExpenseDialog(null);
    setFormErrors(prev => ({ ...prev, categoryName: '' }));
    
    if (projectId) {
      fetchBudget();
    } else {
      fetchFirstProject();
    }
  }, [projectId]);

  // Fetch design items when budget is loaded (so we can filter out moved items)
  useEffect(() => {
    const currentProjectId = searchParams.get('projectId');
    if (budget && currentProjectId) {
      fetchDesignItems(currentProjectId);
    }
  }, [budget, searchParams]);

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
      // Ensure we're using the current projectId from URL
      const currentProjectId = searchParams.get('projectId');
      if (!currentProjectId) {
        setError('Project ID is required');
        setLoading(false);
        return;
      }
      const data = await apiFetch(`/budgets/project/${currentProjectId}`);
      // Double-check that the returned budget belongs to the current project
      if (data && data.projectId !== currentProjectId) {
        console.error('Budget data mismatch: returned budget does not belong to current project');
        setError('Budget data mismatch. Please refresh the page.');
        setBudget(null);
      } else {
        setBudget(data);
      }
      // Also fetch 3D design items (after budget is set so we can filter moved items)
      // fetchDesignItems will use the budget state to filter out moved items
    } catch (err) {
      setError(err.message || 'Failed to load budget');
      console.error('Error fetching budget:', err);
      setBudget(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchDesignItems = async (projectId) => {
    try {
      setLoadingDesignItems(true);
      const data = await apiFetch(`/venue-designs/${projectId}`);
      
      console.log('Fetched venue design data:', {
        hasDesign: !!data.design,
        placedElementsCount: data.design?.placedElements?.length || 0,
        projectServicesCount: data.projectServices?.length || 0,
      });
      
      if (!data.design || !data.design.placedElements) {
        setDesignItems([]);
        return;
      }

      const layoutData = data.design.layoutData || {};
      const placementsMeta = layoutData.placementsMeta || {};

      // Get all placement IDs that have been moved to expenses
      // We track by placedElementId to know exactly which placements have been moved
      // Also track per-table services by serviceListingId (they don't have placedElementId)
      const movedPlacementIds = new Set();
      const movedPerTableServiceIds = new Set();
      if (budget && budget.categories) {
        budget.categories.forEach(category => {
          if (category.expenses) {
            category.expenses.forEach(expense => {
              if (expense.from3DDesign) {
                // Check placedElementIds JSON field first (new approach)
                if (expense.placedElementIds && Array.isArray(expense.placedElementIds)) {
                  expense.placedElementIds.forEach(id => movedPlacementIds.add(id));
                } else if (expense.placedElementId) {
                  // Fallback: use placedElementId for single items or old data
                  movedPlacementIds.add(expense.placedElementId);
                }
                // Also check remark field for backward compatibility (old data migration)
                if (expense.remark && !expense.placedElementIds) {
                  try {
                    const remarkData = JSON.parse(expense.remark);
                    if (remarkData.placedElementIds && Array.isArray(remarkData.placedElementIds)) {
                      remarkData.placedElementIds.forEach(id => movedPlacementIds.add(id));
                    }
                  } catch (e) {
                    // If remark is not JSON, ignore
                  }
                }
                
                // Track per-table services and project services (no placedElementId, tracked by serviceListingId)
                if (!expense.placedElementId && expense.serviceListingId) {
                  movedPerTableServiceIds.add(expense.serviceListingId);
                }
              }
            });
          }
        });
      }

      // Group placements by bundleId (for bundles) or serviceListingId (for non-bundled items)
      const bundleGroups = new Map(); // bundleId -> { serviceListingId, serviceListing, unitPrice, placements[] }
      const serviceGroups = new Map(); // serviceListingId -> { serviceListing, unitPrice, placements[] }

      data.design.placedElements
        .filter(placement => !placement.isBooked) // Only non-booked items
        .forEach(placement => {
          const meta = placementsMeta[placement.id];
          if (!meta?.serviceListingId) return;

          // Get service listing from placement (already included by API)
          const serviceListing = placement.serviceListing || null;
          const bundleId = meta.bundleId;
          const serviceListingId = meta.serviceListingId;
          const unitPrice = parseFloat(meta.unitPrice || serviceListing?.price || 0);
          
          // Skip if this specific placement has been moved to expenses
          if (movedPlacementIds.has(placement.id)) {
            return;
          }
          
          if (bundleId) {
            // For bundles, group by bundleId (one bundle = one price, regardless of number of elements)
            if (!bundleGroups.has(bundleId)) {
              bundleGroups.set(bundleId, {
                bundleId,
                serviceListingId,
                serviceListing,
                unitPrice, // This is the bundle price, not per-element
                placements: [placement],
              });
            } else {
              // Add placement to existing bundle group (but don't change the price - it's per bundle)
              bundleGroups.get(bundleId).placements.push(placement);
            }
          } else {
            // For non-bundled items, group by serviceListingId
            if (!serviceGroups.has(serviceListingId)) {
              serviceGroups.set(serviceListingId, {
                serviceListingId,
                serviceListing,
                unitPrice,
                placements: [placement],
              });
            } else {
              // Add placement to existing service group
              serviceGroups.get(serviceListingId).placements.push(placement);
            }
          }
        });

      // Convert groups to items array
      const items = [];

      // Add bundle items (one item per bundle, with quantity = 1, price = bundle price)
      bundleGroups.forEach(bundle => {
        items.push({
          placementId: bundle.placements[0].id, // Use first placement ID as identifier
          bundleId: bundle.bundleId,
          serviceListingId: bundle.serviceListingId,
          serviceListing: bundle.serviceListing,
          unitPrice: bundle.unitPrice, // Bundle price (not per element)
          quantity: 1, // Bundles are counted as 1, regardless of number of elements
          placements: bundle.placements,
        });
      });

      // Add non-bundled service items (grouped by serviceListingId)
      serviceGroups.forEach(service => {
        items.push({
          placementId: service.placements[0].id, // Use first placement ID as identifier
          serviceListingId: service.serviceListingId,
          serviceListing: service.serviceListing,
          unitPrice: service.unitPrice,
          quantity: service.placements.length, // Count of placements for this service
          placements: service.placements,
        });
      });

      // Add per-table services (services tagged on tables via serviceListingIds array)
      // Get all tables and their tagged per-table services
      // Tables can be identified by elementType on placement OR designElement.elementType
      const allPlacementsForDebug = data.design.placedElements.map(p => ({
        id: p.id,
        elementType: p.elementType,
        designElementType: p.designElement?.elementType,
        designElementName: p.designElement?.name,
        serviceListingIds: p.serviceListingIds,
        isBooked: p.isBooked,
      }));
      console.log('All placements for debugging:', allPlacementsForDebug);
      
      const tablePlacements = data.design.placedElements.filter(p => {
        const isTable = p.elementType === 'table' || 
                       p.designElement?.elementType === 'table' ||
                       (p.designElement?.name && p.designElement.name.toLowerCase().includes('table'));
        const hasServiceIds = p.serviceListingIds && 
                             Array.isArray(p.serviceListingIds) &&
                             p.serviceListingIds.length > 0;
        
        if (isTable) {
          console.log('Found table placement:', {
            id: p.id,
            elementType: p.elementType,
            designElementType: p.designElement?.elementType,
            serviceListingIds: p.serviceListingIds,
            isBooked: p.isBooked,
            hasServiceIds,
          });
        }
        
        return isTable && !p.isBooked && hasServiceIds;
      });

      console.log('Table placements with serviceListingIds:', tablePlacements.length, tablePlacements);

      // Group per-table services by serviceListingId
      const perTableServiceGroups = new Map(); // serviceListingId -> { serviceListing, taggedTableCount, tablePlacements[] }
      
      tablePlacements.forEach(table => {
        if (table.serviceListingIds && Array.isArray(table.serviceListingIds)) {
          table.serviceListingIds.forEach(serviceListingId => {
            if (!perTableServiceGroups.has(serviceListingId)) {
              perTableServiceGroups.set(serviceListingId, {
                serviceListingId,
                serviceListing: null, // Will be fetched separately
                taggedTableCount: 0,
                tablePlacements: [],
                unitPrice: 0,
              });
            }
            perTableServiceGroups.get(serviceListingId).taggedTableCount += 1;
            perTableServiceGroups.get(serviceListingId).tablePlacements.push(table);
          });
        }
      });

      console.log('Per-table service groups:', Array.from(perTableServiceGroups.keys()));

      // Get service listing details from the venue design response
      // The API now includes per-table services in the serviceMap
      const perTableServiceIds = Array.from(perTableServiceGroups.keys());
      console.log('Getting per-table service details for:', perTableServiceIds);
      
      if (perTableServiceIds.length > 0) {
        // First, try to get from serviceMap (API includes per-table services now)
        if (data.serviceMap) {
          console.log('Using serviceMap from API response');
          perTableServiceIds.forEach(serviceListingId => {
            const service = data.serviceMap[serviceListingId];
            if (service && service.pricingPolicy === 'per_table') {
              const group = perTableServiceGroups.get(serviceListingId);
              if (group) {
                group.serviceListing = service;
                group.unitPrice = parseFloat(service.price || 0);
                console.log(`Added per-table service from serviceMap: ${service.name}, price: ${group.unitPrice}, count: ${group.taggedTableCount}`);
              }
            }
          });
        }

        // Also try to get from projectServices (fallback)
        const remainingServiceIds = perTableServiceIds.filter(id => {
          const group = perTableServiceGroups.get(id);
          return !group?.serviceListing;
        });

        if (remainingServiceIds.length > 0 && data.projectServices) {
          console.log('Trying to get remaining per-table services from projectServices:', remainingServiceIds);
          const perTableServicesFromProject = data.projectServices.filter(ps => 
            ps.serviceListing && 
            remainingServiceIds.includes(ps.serviceListingId) &&
            ps.serviceListing.pricingPolicy === 'per_table'
          );

          perTableServicesFromProject.forEach(ps => {
            const serviceListingId = ps.serviceListingId;
            const group = perTableServiceGroups.get(serviceListingId);
            if (group && ps.serviceListing) {
              group.serviceListing = ps.serviceListing;
              group.unitPrice = parseFloat(ps.serviceListing.price || 0);
              console.log(`Added per-table service from projectServices: ${ps.serviceListing.name}, price: ${group.unitPrice}, count: ${group.taggedTableCount}`);
            }
          });
        }
      }

      // Add per-table service items to the list
      perTableServiceGroups.forEach((group, serviceListingId) => {
        console.log(`Processing per-table service group: ${serviceListingId}`, {
          serviceListing: group.serviceListing,
          taggedTableCount: group.taggedTableCount,
          unitPrice: group.unitPrice,
          hasBeenMoved: movedPerTableServiceIds.has(serviceListingId),
        });
        
        if (group.serviceListing && group.taggedTableCount > 0) {
          // Check if this per-table service has already been moved to expenses
          if (!movedPerTableServiceIds.has(serviceListingId)) {
            console.log(`Adding per-table service to items: ${group.serviceListing.name}`);
            items.push({
              placementId: `per-table-${serviceListingId}`, // Special identifier for per-table services
              serviceListingId: serviceListingId,
              serviceListing: group.serviceListing,
              unitPrice: group.unitPrice,
              quantity: group.taggedTableCount, // Number of tables tagged
              placements: group.tablePlacements,
              isPerTableService: true, // Flag to identify per-table services
            });
          } else {
            console.log(`Per-table service ${serviceListingId} already moved, skipping`);
          }
        } else {
          console.log(`Skipping per-table service ${serviceListingId}:`, {
            hasServiceListing: !!group.serviceListing,
            taggedTableCount: group.taggedTableCount,
          });
        }
      });

      console.log('Final design items:', items.length, items);

      // Also check projectServices for non-3D services that might not have placements
      // BUT exclude per-table services (they should be handled via table tagging above)
      if (data.projectServices && Array.isArray(data.projectServices)) {
        console.log('Checking projectServices for non-3D services:', data.projectServices.length);
        
        data.projectServices
          .filter(ps => !ps.isBooked && ps.serviceListing) // Only non-booked services with listing
          .forEach(ps => {
            // Skip per-table services - they should be handled via table tagging
            if (ps.serviceListing.pricingPolicy === 'per_table') {
              console.log(`Skipping per-table service from projectServices: ${ps.serviceListing.name} (should be handled via table tagging)`);
              return;
            }
            
            // Check if this project service has already been moved to expenses
            const hasBeenMoved = movedPerTableServiceIds.has(ps.serviceListingId) || 
              (budget && budget.categories && budget.categories.some(category =>
                category.expenses && category.expenses.some(expense =>
                  expense.from3DDesign &&
                  expense.serviceListingId === ps.serviceListingId &&
                  !expense.placedElementId // Project services don't have placedElementId
                )
              ));

            if (!hasBeenMoved && ps.serviceListing) {
              // Check if it's not already in items (might have a placement)
              const alreadyInItems = items.some(item => 
                item.serviceListingId === ps.serviceListingId
              );

              if (!alreadyInItems) {
                console.log(`Adding non-3D service to items: ${ps.serviceListing.name}`);
                items.push({
                  placementId: `project-service-${ps.serviceListingId}`, // Special identifier
                  serviceListingId: ps.serviceListingId,
                  serviceListing: ps.serviceListing,
                  unitPrice: parseFloat(ps.serviceListing.price || 0),
                  quantity: ps.quantity || 1,
                  placements: [], // No placements for non-3D services
                  isProjectService: true, // Flag to identify project services
                });
              }
            }
          });
      }

      console.log('Final design items after projectServices:', items.length, items);

      setDesignItems(items);
    } catch (err) {
      console.error('Error fetching design items:', err);
      setDesignItems([]);
    } finally {
      setLoadingDesignItems(false);
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
    
    // Verify budget belongs to current project
    const currentProjectId = searchParams.get('projectId');
    if (!currentProjectId || budget.projectId !== currentProjectId) {
      setError('Budget does not belong to current project. Please refresh the page.');
      await fetchBudget();
      return;
    }
    
    const error = validateBudget(editingBudgetValue);
    if (error) {
      setFormErrors(prev => ({ ...prev, budget: error }));
      return;
    }

    try {
      const totalBudget = parseFloat(editingBudgetValue);
      await apiFetch(`/budgets/${budget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ totalBudget }),
      });
      // Refetch budget to ensure we have the latest data
      await fetchBudget();
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
    
    // Verify budget belongs to current project
    const currentProjectId = searchParams.get('projectId');
    if (!currentProjectId || budget.projectId !== currentProjectId) {
      setError('Budget does not belong to current project. Please refresh the page.');
      await fetchBudget();
      return;
    }
    
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
      // Refetch budget to ensure we have the latest data
      await fetchBudget();
      setNewCategoryName('');
      setShowAddCategoryDialog(false);
      setFormErrors(prev => ({ ...prev, categoryName: '' }));
      setSuccessMessage({ open: true, message: 'Category added successfully!' });
    } catch (err) {
      console.error('Error adding category:', err);
      setToast({ open: true, message: err.message || 'Failed to add category', severity: 'error' });
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategoryId || !budget) return;
    
    // Verify budget belongs to current project
    const currentProjectId = searchParams.get('projectId');
    if (!currentProjectId || budget.projectId !== currentProjectId) {
      setError('Budget does not belong to current project. Please refresh the page.');
      await fetchBudget();
      return;
    }
    
    const error = validateCategoryName(editingCategoryName);
    if (error) {
      setFormErrors(prev => ({ ...prev, categoryName: error }));
      return;
    }

    try {
      await apiFetch(`/budgets/${budget.id}/categories/${editingCategoryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ categoryName: editingCategoryName.trim() }),
      });
      // Refetch budget to ensure we have the latest data
      await fetchBudget();
      if (selectedCategory?.id === editingCategoryId) {
        const updatedBudget = await apiFetch(`/budgets/project/${currentProjectId}`);
        const updatedCategory = updatedBudget.categories.find(cat => cat.id === editingCategoryId);
        if (updatedCategory) {
          setSelectedCategory(updatedCategory);
        }
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
      setToast({ open: true, message: err.message || 'Failed to delete category', severity: 'error' });
    }
  };

  const handleAddExpense = async () => {
    if (!selectedCategory || !budget) return;
    
    // Verify budget belongs to current project
    const currentProjectId = searchParams.get('projectId');
    if (!currentProjectId || budget.projectId !== currentProjectId) {
      setError('Budget does not belong to current project. Please refresh the page.');
      await fetchBudget();
      return;
    }
    
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
      // Refetch budget to ensure we have the latest data
      await fetchBudget();
      const updatedBudget = await apiFetch(`/budgets/project/${currentProjectId}`);
      const updatedCategory = updatedBudget.categories.find(cat => cat.id === selectedCategory.id);
      if (updatedCategory) {
        setSelectedCategory(updatedCategory);
      }
      setNewExpense({ expenseName: '', estimatedCost: '', actualCost: '', remark: '' });
      setShowAddExpenseDialog(false);
      setFormErrors(prev => ({ ...prev, expenseName: '', estimatedCost: '', actualCost: '', remark: '' }));
      setSuccessMessage({ open: true, message: 'Expense added successfully!' });
    } catch (err) {
      console.error('Error adding expense:', err);
      setToast({ open: true, message: err.message || 'Failed to add expense', severity: 'error' });
    }
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense || !selectedCategory || !budget) return;
    
    // Verify budget belongs to current project
    const currentProjectId = searchParams.get('projectId');
    if (!currentProjectId || budget.projectId !== currentProjectId) {
      setError('Budget does not belong to current project. Please refresh the page.');
      await fetchBudget();
      return;
    }
    
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
      // Refetch budget to ensure we have the latest data
      await fetchBudget();
      const updatedBudget = await apiFetch(`/budgets/project/${currentProjectId}`);
      const updatedCategory = updatedBudget.categories.find(cat => cat.id === selectedCategory.id);
      if (updatedCategory) {
        setSelectedCategory(updatedCategory);
      }
      setShowEditExpenseDialog(null);
      setEditingExpense(null);
      setFormErrors(prev => ({ ...prev, expenseName: '', estimatedCost: '', actualCost: '', remark: '' }));
      setSuccessMessage({ open: true, message: 'Expense updated successfully!' });
    } catch (err) {
      console.error('Error updating expense:', err);
      setToast({ open: true, message: err.message || 'Failed to update expense', severity: 'error' });
    }
  };

  const handleDeleteExpense = async () => {
    if (!showDeleteDialog || !selectedCategory || !budget) return;
    
    // Verify budget belongs to current project
    const currentProjectId = searchParams.get('projectId');
    if (!currentProjectId || budget.projectId !== currentProjectId) {
      setError('Budget does not belong to current project. Please refresh the page.');
      await fetchBudget();
      return;
    }
    
    try {
      await apiFetch(`/budgets/${budget.id}/categories/${selectedCategory.id}/expenses/${showDeleteDialog.id}`, {
        method: 'DELETE',
      });
      // Refetch budget to ensure we have the latest data
      await fetchBudget();
      const updatedBudget = await apiFetch(`/budgets/project/${currentProjectId}`);
      const updatedCategory = updatedBudget.categories.find(cat => cat.id === selectedCategory.id);
      if (updatedCategory) {
        setSelectedCategory(updatedCategory);
      }
      setShowDeleteDialog(null);
      setSuccessMessage({ open: true, message: 'Expense deleted successfully!' });
    } catch (err) {
      console.error('Error deleting expense:', err);
      setToast({ open: true, message: err.message || 'Failed to delete expense', severity: 'error' });
    }
  };

  const handleMoveToCategory = async (item, categoryId, markAsPaid, createNew = false, newCategoryName = '') => {
    if (!item || !budget) return;
    if (!createNew && !categoryId) return;
    if (createNew && !newCategoryName.trim()) return;

    try {
      const currentProjectId = searchParams.get('projectId');
      // For bundles, unitPrice is already the total bundle price (quantity = 1)
      // For non-bundled items, calculate: unitPrice * quantity
      const quantity = item.quantity || item.placements?.length || 1;
      const totalCost = item.bundleId ? item.unitPrice : (item.unitPrice * quantity);
      
      let finalCategoryId = categoryId;
      
      // If creating new category, create it first
      if (createNew && newCategoryName.trim()) {
        const error = validateCategoryName(newCategoryName);
        if (error) {
          setFormErrors(prev => ({ ...prev, categoryName: error }));
          return;
        }
        
        const newCategory = await apiFetch(`/budgets/${budget.id}/categories`, {
          method: 'POST',
          body: JSON.stringify({ categoryName: newCategoryName.trim() }),
        });
        finalCategoryId = newCategory.id;
      }
      
      // Handle per-table services differently (they don't have placedElementIds)
      if (item.isPerTableService) {
        // For per-table services, create expense and track by serviceListingId
        // Use move-from-3d endpoint but with a special identifier
        await apiFetch(`/budgets/${budget.id}/move-from-3d`, {
          method: 'POST',
          body: JSON.stringify({
            categoryId: finalCategoryId,
            placedElementId: null, // Per-table services don't have placement IDs
            placedElementIds: [], // Empty array for per-table services
            serviceListingId: item.serviceListingId,
            expenseName: `${item.serviceListing?.name || 'Per-table Service'}${quantity > 1 ? ` (${quantity} tables)` : ''}`,
            estimatedCost: totalCost,
            actualCost: markAsPaid ? totalCost : null,
            markAsPaid: markAsPaid || false,
          }),
        });
      } else if (item.isProjectService) {
        // For project services (non-3D services), create expense without placedElementId
        await apiFetch(`/budgets/${budget.id}/move-from-3d`, {
          method: 'POST',
          body: JSON.stringify({
            categoryId: finalCategoryId,
            placedElementId: null, // Project services don't have placement IDs
            placedElementIds: [], // Empty array for project services
            serviceListingId: item.serviceListingId,
            expenseName: `${item.serviceListing?.name || 'Service'}${quantity > 1 ? ` (${quantity})` : ''}`,
            estimatedCost: totalCost,
            actualCost: markAsPaid ? totalCost : null,
            markAsPaid: markAsPaid || false,
          }),
        });
      } else {
        // For regular items (with placements), use the existing flow
        const placementIds = item.placements?.map(p => p.id) || [item.placementId];
        
        // Create expense for the grouped service
        await apiFetch(`/budgets/${budget.id}/move-from-3d`, {
          method: 'POST',
          body: JSON.stringify({
            categoryId: finalCategoryId,
            placedElementId: placementIds[0], // Use first placement ID for reference (backward compatibility)
            placedElementIds: placementIds, // Pass all placement IDs for grouped items
            serviceListingId: item.serviceListingId,
            expenseName: `${item.serviceListing?.name || 'Service from 3D Design'}${quantity > 1 ? ` (${quantity})` : ''}`,
            estimatedCost: totalCost, // Total cost for all items
            actualCost: markAsPaid ? totalCost : null,
            markAsPaid: markAsPaid || false,
          }),
        });
      }

      // Refetch budget first, then design items will be refetched automatically
      // and will filter out the moved items
      await fetchBudget();
      setShowMoveToCategoryDialog(null);
      setFormErrors(prev => ({ ...prev, categoryName: '' }));
      setToast({ 
        open: true, 
        message: createNew ? 'Category created and item moved successfully!' : 'Item moved to category successfully!', 
        severity: 'success' 
      });
    } catch (err) {
      console.error('Error moving item to category:', err);
      setToast({ open: true, message: err.message || 'Failed to move item to category', severity: 'error' });
    }
  };

  const handleFetchPaymentBreakdown = async (expenseId) => {
    if (!expenseId || !budget) return;

    try {
      const payments = await apiFetch(`/budgets/${budget.id}/expenses/${expenseId}/payments`);
      setShowPaymentBreakdown({ expenseId, payments });
    } catch (err) {
      console.error('Error fetching payment breakdown:', err);
      setToast({ open: true, message: err.message || 'Failed to fetch payment breakdown', severity: 'error' });
    }
  };

  const handleMoveExpense = async (expense, categoryId, createNew = false, newCategoryName = '') => {
    if (!expense || !budget || !selectedCategory) return;
    if (!createNew && !categoryId) return;
    if (createNew && !newCategoryName.trim()) return;

    try {
      const currentProjectId = searchParams.get('projectId');
      
      let finalCategoryId = categoryId;
      
      // If creating new category, create it first
      if (createNew && newCategoryName.trim()) {
        const error = validateCategoryName(newCategoryName);
        if (error) {
          setFormErrors(prev => ({ ...prev, categoryName: error }));
          return;
        }
        
        const newCategory = await apiFetch(`/budgets/${budget.id}/categories`, {
          method: 'POST',
          body: JSON.stringify({ categoryName: newCategoryName.trim() }),
        });
        finalCategoryId = newCategory.id;
      }
      
      // Update expense to move to new category
      await apiFetch(`/budgets/${budget.id}/categories/${selectedCategory.id}/expenses/${expense.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          categoryId: finalCategoryId,
        }),
      });

      // Refetch budget to get updated data
      await fetchBudget();
      const updatedBudget = await apiFetch(`/budgets/project/${currentProjectId}`);
      const updatedCategory = updatedBudget.categories.find(cat => cat.id === selectedCategory.id);
      if (updatedCategory) {
        setSelectedCategory(updatedCategory);
      }
      
      setShowMoveExpenseDialog(null);
      setFormErrors(prev => ({ ...prev, categoryName: '' }));
      setToast({ 
        open: true, 
        message: createNew ? 'Category created and expense moved successfully!' : 'Expense moved to category successfully!', 
        severity: 'success' 
      });
    } catch (err) {
      console.error('Error moving expense:', err);
      setToast({ open: true, message: err.message || 'Failed to move expense', severity: 'error' });
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
  const plannedSpend = budget ? parseFloat(budget.plannedSpend || 0) : 0;
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
                                    '&:hover': { color: '#e16789', backgroundColor: 'rgba(225, 103, 137, 0.1)' },
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
                      <CircularProgressChart value={totalSpent + plannedSpend} maxValue={totalBudget} size={120} />
                      <Box sx={{ flex: 1, minWidth: 200 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                          <Typography sx={{ fontFamily: "'Literata', serif", fontSize: '0.875rem', color: '#666' }}>
                            Planned (3D Design)
                          </Typography>
                          <Typography sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, color: '#e16789' }}>
                            RM {plannedSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                          <Typography sx={{ fontFamily: "'Literata', serif", fontSize: '0.875rem', color: '#666' }}>
                            Actual Spent
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
                            {totalRemaining >= 0 ? 'RM ' : '-RM '}{Math.abs(totalRemaining).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

              {/* 3D Venue Design Section */}
              {designItems.length > 0 && (
                <Card
                  sx={{
                    borderRadius: 0.5,
                    padding: 4,
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 1) 100%)',
                    border: '1px solid rgba(225, 103, 137, 0.1)',
                    mt: 3,
                    gridColumn: { xs: '1', lg: '1 / -1' },
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
                      <i className="fas fa-cube" style={{ fontSize: '1.5rem' }}></i>
                    </Box>
                    <Box>
                      <Typography
                        variant="h5"
                        sx={{
                          fontFamily: "'Playfair Display', serif",
                          fontWeight: 700,
                          color: '#0f060d',
                        }}
                      >
                        3D Venue Design (Planned)
                      </Typography>
                      <Typography
                        sx={{
                          fontFamily: "'Literata', serif",
                          fontSize: '0.875rem',
                          color: '#666',
                        }}
                      >
                        Services added to your 3D venue design
                      </Typography>
                    </Box>
                  </Box>

                  {loadingDesignItems ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress sx={{ color: '#e16789' }} />
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {designItems.map((item, index) => (
                        <Card
                          key={item.placementId || index}
                          sx={{
                            p: 2,
                            border: '1px solid rgba(225, 103, 137, 0.2)',
                            borderRadius: 0.5,
                            backgroundColor: 'rgba(225, 103, 137, 0.05)',
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ flex: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Chip
                                  label="3D Design"
                                  size="small"
                                  sx={{
                                    backgroundColor: '#e16789',
                                    color: 'white',
                                    fontFamily: "'Literata', serif",
                                    fontSize: '0.75rem',
                                    height: 20,
                                  }}
                                />
                                <Typography
                                  sx={{
                                    fontFamily: "'Playfair Display', serif",
                                    fontWeight: 600,
                                    fontSize: '1rem',
                                  }}
                                >
                                  {item.serviceListing?.name || 'Unknown Service'}
                                </Typography>
                              </Box>
                              <Typography
                                sx={{
                                  fontFamily: "'Literata', serif",
                                  fontSize: '0.875rem',
                                  color: '#666',
                                  ml: 4.5,
                                }}
                              >
                                Quantity: {item.quantity || item.placements?.length || 1}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <Typography
                                  sx={{
                                    fontFamily: "'Playfair Display', serif",
                                    fontWeight: 600,
                                    fontSize: '1.125rem',
                                    color: '#e16789',
                                  }}
                                >
                                  {item.bundleId ? (
                                    // Bundle: price is already the total bundle price
                                    `RM ${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  ) : (
                                    // Non-bundled: quantity × unit price
                                    `RM ${(item.unitPrice * (item.quantity || 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  )}
                                </Typography>
                                {!item.bundleId && (item.quantity || 1) > 1 && (
                                  <Typography
                                    sx={{
                                      fontFamily: "'Literata', serif",
                                      fontSize: '0.75rem',
                                      color: '#999',
                                      mt: 0.5,
                                    }}
                                  >
                                    {item.quantity} × RM {item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </Typography>
                                )}
                                {item.bundleId && (
                                  <Typography
                                    sx={{
                                      fontFamily: "'Literata', serif",
                                      fontSize: '0.75rem',
                                      color: '#999',
                                      mt: 0.5,
                                      fontStyle: 'italic',
                                    }}
                                  >
                                    Bundle (includes {item.placements?.length || 0} elements)
                                  </Typography>
                                )}
                              </Box>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => setShowMoveToCategoryDialog({ 
                                  ...item, 
                                  categoryId: '', 
                                  createNew: false, 
                                  newCategoryName: '',
                                  markAsPaid: false 
                                })}
                                sx={{
                                  border: '2px solid #e16789',
                                  color: '#e16789',
                                  textTransform: 'none',
                                  fontFamily: "'Literata', serif",
                                  '&:hover': {
                                    background: '#e16789',
                                    color: 'white',
                                  },
                                }}
                              >
                                Move to Category
                              </Button>
                            </Box>
                          </Box>
                        </Card>
                      ))}
                    </Box>
                  )}
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
                            <TableCell sx={{ fontFamily: "'Literata', serif" }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {expense.expenseName}
                                {expense.from3DDesign && (
                                  <Chip
                                    label="3D Design"
                                    size="small"
                                    sx={{
                                      backgroundColor: '#3b82f6',
                                      color: 'white',
                                      fontFamily: "'Literata', serif",
                                      fontSize: '0.7rem',
                                      height: 20,
                                    }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontFamily: "'Literata', serif", textAlign: 'center' }}>
                              RM {parseFloat(expense.estimatedCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell sx={{ fontFamily: "'Literata', serif", textAlign: 'center' }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                {expense.actualCost
                                  ? `RM ${parseFloat(expense.actualCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : '-'}
                                {expense.bookingId && (
                                  <Button
                                    size="small"
                                    onClick={() => handleFetchPaymentBreakdown(expense.id)}
                                    sx={{
                                      textTransform: 'none',
                                      fontFamily: "'Literata', serif",
                                      fontSize: '0.75rem',
                                      color: '#e16789',
                                      minWidth: 'auto',
                                      p: 0.5,
                                      '&:hover': {
                                        backgroundColor: 'rgba(225, 103, 137, 0.1)',
                                      },
                                    }}
                                  >
                                    View Payments
                                  </Button>
                                )}
                              </Box>
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
                                    '&:hover': { color: '#e16789', backgroundColor: 'rgba(225, 103, 137, 0.1)' },
                                  }}
                                  title="Edit expense"
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => setShowMoveExpenseDialog({ expense, categoryId: '', createNew: false, newCategoryName: '' })}
                                  sx={{
                                    color: '#666',
                                    '&:hover': { color: '#ab47bc', backgroundColor: 'rgba(171, 71, 188, 0.1)' },
                                  }}
                                  title="Move to another category"
                                >
                                  <i className="fas fa-arrows-alt" style={{ fontSize: '0.875rem' }}></i>
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => setShowDeleteDialog({ type: 'expense', id: expense.id, name: expense.expenseName })}
                                  disabled={expense.from3DDesign && expense.placedElementId}
                                  title={expense.from3DDesign && expense.placedElementId ? 'Cannot delete expense linked to 3D design. Remove from 3D design first.' : 'Delete expense'}
                                  sx={{
                                    color: expense.from3DDesign && expense.placedElementId ? '#ccc' : '#666',
                                    '&:hover': { 
                                      color: expense.from3DDesign && expense.placedElementId ? '#ccc' : '#c62828', 
                                      backgroundColor: expense.from3DDesign && expense.placedElementId ? 'transparent' : 'rgba(198, 40, 40, 0.1)' 
                                    },
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
                value={(() => {
                  // Hide placement IDs from remark if they exist (they're stored in placedElementIds now)
                  if (editingExpense.remark) {
                    try {
                      const remarkData = JSON.parse(editingExpense.remark);
                      if (remarkData.placedElementIds) {
                        // This remark contains placement IDs, don't show it
                        return '';
                      }
                    } catch (e) {
                      // Not JSON, show as normal remark
                    }
                  }
                  return editingExpense.remark || '';
                })()}
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

      {/* Move to Category Dialog */}
      <Dialog
        open={!!showMoveToCategoryDialog}
        onClose={() => setShowMoveToCategoryDialog(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <DialogTitle sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>
          Move to Category
        </DialogTitle>
        <DialogContent>
          {showMoveToCategoryDialog && (
            <>
              <Typography sx={{ fontFamily: "'Literata', serif", mb: 2, color: '#666' }}>
                Move "{showMoveToCategoryDialog.serviceListing?.name || 'Service'}" to a budget category.
              </Typography>
              
              {/* Toggle between existing and new category */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant={!showMoveToCategoryDialog.createNew ? 'contained' : 'outlined'}
                  onClick={() => setShowMoveToCategoryDialog({ ...showMoveToCategoryDialog, createNew: false, newCategoryName: '', categoryId: '' })}
                  sx={{
                    flex: 1,
                    fontFamily: "'Literata', serif",
                    textTransform: 'none',
                    backgroundColor: !showMoveToCategoryDialog.createNew ? '#e16789' : 'transparent',
                    color: !showMoveToCategoryDialog.createNew ? 'white' : '#e16789',
                    border: '1px solid #e16789',
                    '&:hover': {
                      backgroundColor: !showMoveToCategoryDialog.createNew ? '#c55a7a' : 'rgba(225, 103, 137, 0.1)',
                    },
                  }}
                >
                  Select Existing
                </Button>
                <Button
                  variant={showMoveToCategoryDialog.createNew ? 'contained' : 'outlined'}
                  onClick={() => setShowMoveToCategoryDialog({ ...showMoveToCategoryDialog, createNew: true, categoryId: '', newCategoryName: '' })}
                  sx={{
                    flex: 1,
                    fontFamily: "'Literata', serif",
                    textTransform: 'none',
                    backgroundColor: showMoveToCategoryDialog.createNew ? '#e16789' : 'transparent',
                    color: showMoveToCategoryDialog.createNew ? 'white' : '#e16789',
                    border: '1px solid #e16789',
                    '&:hover': {
                      backgroundColor: showMoveToCategoryDialog.createNew ? '#c55a7a' : 'rgba(225, 103, 137, 0.1)',
                    },
                  }}
                >
                  Create New
                </Button>
              </Box>

              {showMoveToCategoryDialog.createNew ? (
                <TextField
                  fullWidth
                  label="New Category Name"
                  value={showMoveToCategoryDialog.newCategoryName || ''}
                  onChange={(e) => {
                    setShowMoveToCategoryDialog({ ...showMoveToCategoryDialog, newCategoryName: e.target.value });
                    setFormErrors(prev => ({ ...prev, categoryName: '' }));
                  }}
                  margin="normal"
                  error={!!formErrors.categoryName}
                  helperText={formErrors.categoryName}
                  placeholder="e.g., Venue, Catering, Photography"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontFamily: "'Literata', serif",
                      borderRadius: 0.5,
                    },
                  }}
                />
              ) : (
                <>
                  {budget?.categories && budget.categories.length > 0 ? (
                    <FormControl fullWidth margin="normal">
                      <InputLabel 
                        id="select-category-label"
                        sx={{
                          fontFamily: "'Literata', serif",
                        }}
                      >
                        Select Category
                      </InputLabel>
                      <Select
                        labelId="select-category-label"
                        value={showMoveToCategoryDialog.categoryId || ''}
                        onChange={(e) => setShowMoveToCategoryDialog({ ...showMoveToCategoryDialog, categoryId: e.target.value })}
                        label="Select Category"
                        sx={{
                          fontFamily: "'Literata', serif",
                          borderRadius: 0.5,
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: showMoveToCategoryDialog.categoryId ? 'rgba(0, 0, 0, 0.23)' : 'rgba(0, 0, 0, 0.23)',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#e16789',
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#e16789',
                          },
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              borderRadius: 0.5,
                              fontFamily: "'Literata', serif",
                            },
                          },
                        }}
                      >
                        {budget.categories.map((cat) => (
                          <MenuItem key={cat.id} value={cat.id}>
                            {cat.categoryName}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Box
                      sx={{
                        mt: 2,
                        p: 2,
                        borderRadius: 0.5,
                        backgroundColor: 'rgba(225, 103, 137, 0.05)',
                        border: '1px solid rgba(225, 103, 137, 0.2)',
                        textAlign: 'center',
                      }}
                    >
                      <Typography
                        sx={{
                          fontFamily: "'Literata', serif",
                          fontSize: '0.875rem',
                          color: '#666',
                          fontStyle: 'italic',
                        }}
                      >
                        No categories available. Please create a new category to continue.
                      </Typography>
                    </Box>
                  )}
                </>
              )}
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showMoveToCategoryDialog.markAsPaid || false}
                    onChange={(e) => setShowMoveToCategoryDialog({ ...showMoveToCategoryDialog, markAsPaid: e.target.checked })}
                    sx={{ color: '#e16789', '&.Mui-checked': { color: '#e16789' } }}
                  />
                }
                label="Mark as paid (set actual cost)"
                sx={{
                  mt: 2,
                  '& .MuiFormControlLabel-label': {
                    fontFamily: "'Literata', serif",
                    fontSize: '0.875rem',
                    color: '#666',
                  },
                }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowMoveToCategoryDialog(null)}
            sx={{
              fontFamily: "'Literata', serif",
              color: '#666',
              textTransform: 'none',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (showMoveToCategoryDialog?.createNew) {
                if (showMoveToCategoryDialog?.newCategoryName?.trim()) {
                  handleMoveToCategory(
                    showMoveToCategoryDialog,
                    null,
                    showMoveToCategoryDialog.markAsPaid,
                    true,
                    showMoveToCategoryDialog.newCategoryName
                  );
                }
              } else {
                if (showMoveToCategoryDialog?.categoryId) {
                  handleMoveToCategory(
                    showMoveToCategoryDialog,
                    showMoveToCategoryDialog.categoryId,
                    showMoveToCategoryDialog.markAsPaid,
                    false
                  );
                }
              }
            }}
            disabled={
              showMoveToCategoryDialog?.createNew
                ? !showMoveToCategoryDialog?.newCategoryName?.trim()
                : !showMoveToCategoryDialog?.categoryId || showMoveToCategoryDialog?.categoryId === ''
            }
            variant="contained"
            sx={{
              fontFamily: "'Literata', serif",
              backgroundColor: '#e16789',
              textTransform: 'none',
              '&:hover': { backgroundColor: '#c55a7a' },
            }}
          >
            {showMoveToCategoryDialog?.createNew ? 'Create & Move' : 'Move'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Breakdown Dialog */}
      <Dialog
        open={!!showPaymentBreakdown}
        onClose={() => setShowPaymentBreakdown(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <DialogTitle sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>
          Payment History
        </DialogTitle>
        <DialogContent>
          {showPaymentBreakdown?.payments && (
            <>
              {showPaymentBreakdown.payments.payments && showPaymentBreakdown.payments.payments.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                  {showPaymentBreakdown.payments.payments.map((payment, index) => (
                    <Box
                      key={payment.id || index}
                      sx={{
                        p: 2,
                        border: '1px solid rgba(225, 103, 137, 0.2)',
                        borderRadius: 0.5,
                        backgroundColor: 'rgba(225, 103, 137, 0.05)',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: '0.875rem' }}>
                            {payment.type === 'deposit' ? 'Deposit' : payment.type === 'final_payment' ? 'Final Payment' : 'Payment'}
                          </Typography>
                          <Typography sx={{ fontFamily: "'Literata', serif", fontSize: '0.75rem', color: '#666', mt: 0.5 }}>
                            {new Date(payment.createdAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, color: '#e16789' }}>
                          RM {parseFloat(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(225, 103, 137, 0.2)' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>
                        Total Paid
                      </Typography>
                      <Typography sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, color: '#e16789', fontSize: '1.125rem' }}>
                        RM {showPaymentBreakdown.payments.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Typography sx={{ fontFamily: "'Literata', serif", color: '#666', textAlign: 'center', py: 4 }}>
                  No payment records found
                </Typography>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowPaymentBreakdown(null)}
            variant="contained"
            sx={{
              fontFamily: "'Literata', serif",
              backgroundColor: '#e16789',
              textTransform: 'none',
              '&:hover': { backgroundColor: '#c55a7a' },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move Expense Dialog */}
      <Dialog
        open={!!showMoveExpenseDialog}
        onClose={() => setShowMoveExpenseDialog(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <DialogTitle sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>
          Move Expense to Category
        </DialogTitle>
        <DialogContent>
          {showMoveExpenseDialog && (
            <>
              <Typography sx={{ fontFamily: "'Literata', serif", mb: 2, color: '#666' }}>
                Move "{showMoveExpenseDialog.expense?.expenseName || 'Expense'}" to a different budget category.
              </Typography>
              
              {/* Toggle between existing and new category */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant={!showMoveExpenseDialog.createNew ? 'contained' : 'outlined'}
                  onClick={() => setShowMoveExpenseDialog({ ...showMoveExpenseDialog, createNew: false, newCategoryName: '', categoryId: '' })}
                  sx={{
                    flex: 1,
                    fontFamily: "'Literata', serif",
                    textTransform: 'none',
                    backgroundColor: !showMoveExpenseDialog.createNew ? '#e16789' : 'transparent',
                    color: !showMoveExpenseDialog.createNew ? 'white' : '#e16789',
                    border: '1px solid #e16789',
                    '&:hover': {
                      backgroundColor: !showMoveExpenseDialog.createNew ? '#c55a7a' : 'rgba(225, 103, 137, 0.1)',
                    },
                  }}
                >
                  Select Existing
                </Button>
                <Button
                  variant={showMoveExpenseDialog.createNew ? 'contained' : 'outlined'}
                  onClick={() => setShowMoveExpenseDialog({ ...showMoveExpenseDialog, createNew: true, categoryId: '', newCategoryName: '' })}
                  sx={{
                    flex: 1,
                    fontFamily: "'Literata', serif",
                    textTransform: 'none',
                    backgroundColor: showMoveExpenseDialog.createNew ? '#e16789' : 'transparent',
                    color: showMoveExpenseDialog.createNew ? 'white' : '#e16789',
                    border: '1px solid #e16789',
                    '&:hover': {
                      backgroundColor: showMoveExpenseDialog.createNew ? '#c55a7a' : 'rgba(225, 103, 137, 0.1)',
                    },
                  }}
                >
                  Create New
                </Button>
              </Box>

              {showMoveExpenseDialog.createNew ? (
                <TextField
                  fullWidth
                  label="New Category Name"
                  value={showMoveExpenseDialog.newCategoryName || ''}
                  onChange={(e) => {
                    setShowMoveExpenseDialog({ ...showMoveExpenseDialog, newCategoryName: e.target.value });
                    setFormErrors(prev => ({ ...prev, categoryName: '' }));
                  }}
                  margin="normal"
                  error={!!formErrors.categoryName}
                  helperText={formErrors.categoryName}
                  placeholder="e.g., Venue, Catering, Photography"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontFamily: "'Literata', serif",
                      borderRadius: 0.5,
                    },
                  }}
                />
              ) : (
                <>
                  {budget?.categories && budget.categories.length > 0 ? (
                    <FormControl fullWidth margin="normal">
                      <InputLabel 
                        id="select-expense-category-label"
                        sx={{
                          fontFamily: "'Literata', serif",
                        }}
                      >
                        Select Category
                      </InputLabel>
                      <Select
                        labelId="select-expense-category-label"
                        value={showMoveExpenseDialog.categoryId || ''}
                        onChange={(e) => setShowMoveExpenseDialog({ ...showMoveExpenseDialog, categoryId: e.target.value })}
                        label="Select Category"
                        sx={{
                          fontFamily: "'Literata', serif",
                          borderRadius: 0.5,
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: showMoveExpenseDialog.categoryId ? 'rgba(0, 0, 0, 0.23)' : 'rgba(0, 0, 0, 0.23)',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#e16789',
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#e16789',
                          },
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              borderRadius: 0.5,
                              fontFamily: "'Literata', serif",
                            },
                          },
                        }}
                      >
                        {budget.categories
                          .filter(cat => cat.id !== selectedCategory?.id) // Exclude current category
                          .map((cat) => (
                            <MenuItem key={cat.id} value={cat.id}>
                              {cat.categoryName}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Box
                      sx={{
                        mt: 2,
                        p: 2,
                        borderRadius: 0.5,
                        backgroundColor: 'rgba(225, 103, 137, 0.05)',
                        border: '1px solid rgba(225, 103, 137, 0.2)',
                        textAlign: 'center',
                      }}
                    >
                      <Typography
                        sx={{
                          fontFamily: "'Literata', serif",
                          fontSize: '0.875rem',
                          color: '#666',
                          fontStyle: 'italic',
                        }}
                      >
                        No other categories available. Please create a new category to continue.
                      </Typography>
                    </Box>
                  )}
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowMoveExpenseDialog(null)}
            sx={{
              fontFamily: "'Literata', serif",
              color: '#666',
              textTransform: 'none',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (showMoveExpenseDialog?.createNew) {
                if (showMoveExpenseDialog?.newCategoryName?.trim()) {
                  handleMoveExpense(
                    showMoveExpenseDialog.expense,
                    null,
                    true,
                    showMoveExpenseDialog.newCategoryName
                  );
                }
              } else {
                if (showMoveExpenseDialog?.categoryId && showMoveExpenseDialog?.categoryId !== '') {
                  handleMoveExpense(
                    showMoveExpenseDialog.expense,
                    showMoveExpenseDialog.categoryId,
                    false
                  );
                }
              }
            }}
            disabled={
              showMoveExpenseDialog?.createNew
                ? !showMoveExpenseDialog?.newCategoryName?.trim()
                : !showMoveExpenseDialog?.categoryId || showMoveExpenseDialog?.categoryId === ''
            }
            variant="contained"
            sx={{
              fontFamily: "'Literata', serif",
              backgroundColor: '#e16789',
              textTransform: 'none',
              '&:hover': { backgroundColor: '#c55a7a' },
            }}
          >
            {showMoveExpenseDialog?.createNew ? 'Create & Move' : 'Move'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Message */}
      <SuccessMessage
        open={successMessage.open}
        onClose={() => setSuccessMessage({ ...successMessage, open: false })}
        message={successMessage.message}
      />

      {/* Toast Message */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast({ ...toast, open: false })}
          severity={toast.severity}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BudgetManagement;
