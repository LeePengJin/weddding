import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Snackbar, Alert, CircularProgress, Typography } from '@mui/material';
import './VenueDesigner.styles.css';
import DesignSummary from './DesignSummary.jsx';
import CheckoutModal from './CheckoutModal.jsx';
import ContractReviewModal from './ContractReviewModal.jsx';
import {
  getVenueDesign,
  getVenueDesignBudget,
  addDesignElement,
  updateDesignElement,
  deleteDesignElement,
  duplicateDesignElement,
  duplicatePackageDesignElement,
  saveVenueDesign,
  getVenueCatalog,
  getVenueAvailability,
  getPackageDesign,
  addPackageDesignElement,
  updatePackageDesignElement,
  deletePackageDesignElement,
  savePackageDesign,
  getPackageCatalog,
  uploadPackagePreview,
  deleteProjectService,
  apiFetch,
} from '../../lib/api';
import BudgetTracker from '../../components/BudgetTracker/BudgetTracker';
import CatalogSidebar from '../../components/Catalog/CatalogSidebar';
import Listing3DDialog from '../../components/Catalog/Listing3DDialog';
import Scene3D from './Scene3D';
import { VenueDesignerProvider } from './VenueDesignerContext';

const CATEGORIES = [
  'All Categories',
  'Caterer',
  'Florist',
  'Photographer',
  'Videographer',
  'DJ_Music',
  'Other',
];

const DEFAULT_GRID_SETTINGS = {
  size: 1,
  visible: false, // Grid hidden by default
  snapToGrid: false, // Snap off by default - allow free movement
};

const normalizeLayout = (layout = {}) => ({
  ...layout,
  // Force grid to be hidden and snap off, ignoring any saved layout data
  grid: { ...DEFAULT_GRID_SETTINGS, visible: false, snapToGrid: false },
  sidebar: { collapsed: false, ...(layout?.sidebar || {}) },
});

const VenueDesigner = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId: routeProjectId, packageId: routePackageId } = useParams();
  const searchParams = new URLSearchParams(location.search);
  const projectIdFromQuery = searchParams.get('projectId');
  const packageIdFromQuery = searchParams.get('packageId');
  const projectIdFromState = location.state?.projectId;
  const packageIdFromState = location.state?.packageId;
  const projectId = routeProjectId || projectIdFromQuery || projectIdFromState || null;
  const packageId = routePackageId || packageIdFromQuery || packageIdFromState || null;
  const designerMode = packageId ? 'package' : 'project';
  const resourceId = packageId || projectId || null;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [totalBudget, setTotalBudget] = useState(0); // Will be set from backend budget
  const [budget, setBudget] = useState(null); // Store full budget object
  const [placements, setPlacements] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedItemInfo, setSelectedItemInfo] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [designLayout, setDesignLayout] = useState(() => normalizeLayout({}));
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [savingState, setSavingState] = useState({ loading: false, lastSaved: null });
  const [threeDPreview, setThreeDPreview] = useState(null);
  const [showContractReview, setShowContractReview] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [weddingDate, setWeddingDate] = useState(null);
  const [eventStartTime, setEventStartTime] = useState(null);
  const [eventEndTime, setEventEndTime] = useState(null);
  const [venueInfo, setVenueInfo] = useState(null);
  const [venueDesignId, setVenueDesignId] = useState(null);
  const [projectServices, setProjectServices] = useState([]);
  const [bookedQuantities, setBookedQuantities] = useState({});
  const [toastNotification, setToastNotification] = useState({ open: false, message: '', severity: 'info' });
  const layoutAutosaveTimerRef = useRef(null);
  const skipNextLayoutSaveRef = useRef(true);
  const captureScreenshotRef = useRef(null);
  const handleRegisterCapture = useCallback((fn) => {
    captureScreenshotRef.current = fn;
  }, []);

  // Calculate remaining: totalBudget - plannedSpend - totalSpent
  // Parse totalSpent - handle both string and number types
  let totalSpent = 0;
  if (budget?.totalSpent != null) {
    const totalSpentStr = String(budget.totalSpent);
    totalSpent = parseFloat(totalSpentStr);
    if (isNaN(totalSpent)) {
      totalSpent = 0;
    }
  }
  // Always use backend plannedSpend - it's calculated using the same logic as checkout summary
  // The backend updatePlannedSpend function matches the checkout summary calculation
  const effectivePlannedSpend = budget?.plannedSpend !== undefined && budget?.plannedSpend !== null
    ? parseFloat(budget.plannedSpend)
    : 0;
  const remainingBudget = totalBudget - effectivePlannedSpend - totalSpent; // Allow negative values
  const totalCommitted = effectivePlannedSpend + totalSpent;
  const budgetProgress = totalBudget > 0 ? (totalCommitted / totalBudget) * 100 : 0;

  const loadDesign = useCallback(async () => {
    if (!resourceId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data =
        designerMode === 'package' ? await getPackageDesign(packageId) : await getVenueDesign(projectId);

      setPlacements(data.design?.placedElements || []);
      skipNextLayoutSaveRef.current = true;
      const layoutFromServer = normalizeLayout(data.design?.layoutData || {});
      setDesignLayout(layoutFromServer);
      setSidebarCollapsed(layoutFromServer.sidebar.collapsed ?? false);
      setSavingState((prev) => ({
        ...prev,
        lastSaved: data.design?.layoutData?.lastSavedAt || null,
      }));

      // Store venue design ID for table tagging
      if (data.design?.id) {
        setVenueDesignId(data.design.id);
      }

      if (designerMode === 'project') {
        setVenueInfo(data.venue || null);
        const backendBudget = data.project?.budget;
        if (backendBudget) {
          setBudget(backendBudget);
          // Convert string to number (backend returns Decimal as string)
          const budgetTotal = parseFloat(backendBudget.totalBudget || '0');
          setTotalBudget(isNaN(budgetTotal) ? 0 : budgetTotal);
        } else {
          // If no budget, set to 0 (will show message in BudgetTracker)
          setBudget(null);
          setTotalBudget(0);
        }
        if (data.project?.weddingDate) {
          setWeddingDate(data.project.weddingDate);
        }
        if (data.project?.eventStartTime) {
          setEventStartTime(data.project.eventStartTime);
        }
        if (data.project?.eventEndTime) {
          setEventEndTime(data.project.eventEndTime);
        }
        // Non-3D services associated with this project
        setProjectServices(data.projectServices || []);
        // Booked quantities for checkout adjustment
        setBookedQuantities(data.bookedQuantities || {});
      } else {
        // Package mode: set venue info if available
        setVenueInfo(data.venue || null);
        setWeddingDate(null);
      }

      setToastNotification({ open: false, message: '', severity: 'info' });
    } catch (err) {
      setToastNotification({ open: true, message: err.message || 'Failed to load venue design', severity: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [resourceId, designerMode, projectId, packageId]);

  const refreshBookedQuantities = useCallback(async () => {
    if (!projectId || designerMode !== 'project') return;
    try {
      const data = await getVenueDesign(projectId);
      setBookedQuantities(data.bookedQuantities || {});
    } catch (error) {
      console.error('[VenueDesigner] Failed to refresh booked quantities', error);
    }
  }, [projectId, designerMode]);

  // Lightweight budget refresh - only updates budget data without full page reload
  const refreshBudget = useCallback(async () => {
    if (!projectId || designerMode !== 'project') return;
    try {
      const data = await getVenueDesignBudget(projectId);
      if (data.budget) {
        setBudget(data.budget);
        const budgetTotal = parseFloat(data.budget.totalBudget || '0');
        setTotalBudget(isNaN(budgetTotal) ? 0 : budgetTotal);
      }
    } catch (error) {
      console.error('[VenueDesigner] Failed to refresh budget', error);
      // Fallback to full reload if budget endpoint fails
      if (designerMode === 'project') {
        const fullData = await getVenueDesign(projectId);
        if (fullData.project?.budget) {
          setBudget(fullData.project.budget);
          const budgetTotal = parseFloat(fullData.project.budget.totalBudget || '0');
          setTotalBudget(isNaN(budgetTotal) ? 0 : budgetTotal);
        }
      }
    }
  }, [projectId, designerMode]);

  // Handle tag updates - refresh budget immediately, then reload design
  const handleTagUpdateReload = useCallback(async () => {
    // When tags are updated, refresh budget immediately (lightweight)
    await refreshBudget();
    // Then reload full design to get updated placements with new tags
    await loadDesign();
  }, [refreshBudget, loadDesign]);

  const loadCatalog = useCallback(async () => {
    if (!resourceId) return;
    setCatalogLoading(true);
    try {
      const queryPayload = {
        search: searchTerm || undefined,
        category: selectedCategory !== 'All Categories' ? selectedCategory : undefined,
      };
      if (designerMode === 'project') {
        queryPayload.includeUnavailable = true;
      }
      const response =
        designerMode === 'package'
          ? await getPackageCatalog(packageId, queryPayload)
          : await getVenueCatalog(projectId, queryPayload);
      setCatalogItems(response.listings || []);
    } catch (err) {
      setToastNotification({ open: true, message: err.message || 'Failed to load catalog', severity: 'error' });
    } finally {
      setCatalogLoading(false);
    }
  }, [resourceId, designerMode, packageId, projectId, searchTerm, selectedCategory]);

  const refreshAvailability = useCallback(async () => {
    if (designerMode !== 'project' || !projectId || placements.length === 0) return;
    const listingIds = Array.from(
      new Set(
        placements
          .map((placement) => placement?.metadata?.serviceListingId)
          .filter(Boolean)
      )
    );
    if (listingIds.length === 0) return;
    try {
      const result = await getVenueAvailability(projectId, listingIds);
      const map = {};
      (result.results || []).forEach((entry) => {
        map[entry.serviceListingId] = entry;
      });
      setAvailabilityMap(map);
    } catch (err) {
      console.error('[VenueDesigner] Availability check failed', err);
    }
  }, [designerMode, projectId, placements]);

  const saveLayoutData = useCallback(
    async (layoutData = {}) => {
      if (!resourceId) {
        setToastNotification({ open: true, message: 'No design context selected.', severity: 'error' });
        return;
      }
      setSavingState((prev) => ({ ...prev, loading: true }));
      setToastNotification({ open: false, message: '', severity: 'info' }); // Clear any previous errors
      try {
        const payload = { layoutData };
        if (designerMode === 'package') {
          await savePackageDesign(packageId, payload);
          if (captureScreenshotRef.current) {
            try {
              const imageData = await captureScreenshotRef.current();
              if (imageData) {
                await uploadPackagePreview(packageId, imageData);
              }
            } catch (captureErr) {
              console.warn('Failed to capture package preview image', captureErr);
            }
          }
        } else {
          await saveVenueDesign(projectId, payload);
        }
        setSavingState({
          loading: false,
          lastSaved: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Error saving design layout:', err);
        const errorMessage = err.message || err.error || 'Failed to save design layout. Please try again.';
        setToastNotification({ open: true, message: errorMessage, severity: 'error' });
        setSavingState((prev) => ({ ...prev, loading: false }));
      }
    },
    [resourceId, designerMode, projectId, packageId]
  );

  const handleAddItem = useCallback(
    async (item) => {
      if (!resourceId) return;
      try {
        const payload = { serviceListingId: item.id };
        
        const response =
          designerMode === 'package'
            ? await addPackageDesignElement(packageId, payload)
            : await addDesignElement(projectId, payload);
        
        // If non-3D service was added (projectService: true), refresh budget and project services
        if (response.projectService) {
          // Add small delay to ensure backend has finished updating plannedSpend
          await new Promise(resolve => setTimeout(resolve, 100));
          // Refresh budget immediately (lightweight update)
          await refreshBudget();
          // Still need to reload design to get updated projectServices list
          await loadDesign();
          
          // Show helpful toast notification for per_table services
          if (response.isPerTable) {
              setToastNotification({
                open: true,
                message: 'Service added! This service uses per-table pricing. Please tag tables in the 3D design by clicking on a table and selecting "Tag Services" to set the quantity.',
                severity: 'info',
              });
          } else {
            setToastNotification({
              open: true,
              message: 'Service added to project successfully!',
              severity: 'success',
            });
          }
        } else {
          setPlacements((prev) => [...prev, ...(response.placements || [])]);
          // Refresh budget immediately (lightweight update, no full page reload)
          // Add small delay to ensure backend has finished updating plannedSpend
          await new Promise(resolve => setTimeout(resolve, 100));
          await refreshBudget();
          setToastNotification({
            open: true,
            message: 'Service added to design successfully!',
            severity: 'success',
          });
        }
      } catch (err) {
        setToastNotification({ open: true, message: err.message || 'Unable to add item to design', severity: 'error' });
      }
    },
    [resourceId, designerMode, packageId, projectId, loadDesign]
  );

  const handleRemovePlacement = useCallback(
    async (placementId, scope = 'bundle') => {
      if (!resourceId) return;
      try {
        const response =
          designerMode === 'package'
            ? await deletePackageDesignElement(packageId, placementId, scope)
            : await deleteDesignElement(projectId, placementId, scope);
        const removedIds = response.removedPlacementIds || [];
        setPlacements((prev) => prev.filter((placement) => !removedIds.includes(placement.id)));
        // Refresh budget immediately (lightweight update, no full page reload)
        if (designerMode === 'project') {
          // Add small delay to ensure backend has finished updating plannedSpend
          await new Promise(resolve => setTimeout(resolve, 100));
          await refreshBudget();
        }
        setToastNotification({ open: false, message: '', severity: 'info' });
      } catch (err) {
        // Use toast notification instead of error message
        const errorMsg = err.message || 'Unable to remove item';
        if (errorMsg.includes('booking') || errorMsg.includes('cannot be removed')) {
          setToastNotification({
            open: true,
            message: errorMsg,
            severity: 'warning',
          });
        } else {
          setToastNotification({
            open: true,
            message: errorMsg,
            severity: 'error',
          });
        }
      }
    },
    [resourceId, designerMode, packageId, projectId, refreshBudget]
  );

  const handleRemoveProjectService = useCallback(
    async (serviceListingId) => {
      if (!projectId) return;
      try {
        await deleteProjectService(projectId, serviceListingId);
        // Add small delay to ensure backend has finished updating plannedSpend
        await new Promise(resolve => setTimeout(resolve, 100));
        // Refresh budget immediately (lightweight update)
        await refreshBudget();
        // Then reload design to get updated projectServices list
        await loadDesign();
        setToastNotification({ open: false, message: '', severity: 'info' });
      } catch (err) {
        // Use toast notification instead of error message
        const errorMsg = err.message || 'Unable to remove service from project';
        if (errorMsg.includes('booking') || errorMsg.includes('cannot be removed')) {
          setToastNotification({
            open: true,
            message: errorMsg,
            severity: 'warning',
          });
        } else {
          setToastNotification({
            open: true,
            message: errorMsg,
            severity: 'error',
          });
        }
      }
    },
    [projectId, loadDesign, refreshBudget]
  );

  const handleToggleLock = useCallback(async (placement) => {
    if (!resourceId) return;
    try {
      const updated =
        designerMode === 'package'
          ? await updatePackageDesignElement(packageId, placement.id, {
              isLocked: !placement.isLocked,
            })
          : await updateDesignElement(projectId, placement.id, {
              isLocked: !placement.isLocked,
            });
      setPlacements((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setToastNotification({ open: true, message: err.message || 'Unable to update lock state', severity: 'error' });
    }
  }, [resourceId, designerMode, packageId, projectId]);

  const handleUpdatePlacement = useCallback(
    async (placementId, payload) => {
      if (!resourceId) return null;
      try {
        const updated =
          designerMode === 'package'
            ? await updatePackageDesignElement(packageId, placementId, payload)
            : await updateDesignElement(projectId, placementId, payload);
        setPlacements((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        return updated;
      } catch (err) {
        setToastNotification({ open: true, message: err.message || 'Unable to update element', severity: 'error' });
        throw err;
      }
    },
    [resourceId, designerMode, packageId, projectId]
  );

  const handleDuplicatePlacement = useCallback(
    async (placementId) => {
      if (!resourceId) {
        return null;
      }
      try {
        const response =
          designerMode === 'package'
            ? await duplicatePackageDesignElement(packageId, placementId)
            : await duplicateDesignElement(projectId, placementId);
        // Handle both single placement and bundle (array of placements)
        const newPlacements = response.placements || (response.placement ? [response.placement] : []);
        if (newPlacements.length > 0) {
          setPlacements((prev) => [...prev, ...newPlacements]);
          const itemCount = newPlacements.length > 1 ? `${newPlacements.length} elements` : 'element';
          
          // Show warning if booked services were filtered out, otherwise show success
          if (response.warning) {
            setToastNotification({ open: true, message: response.warning, severity: 'warning' });
          } else {
            setToastNotification({ 
              open: true, 
              message: `Duplicated ${itemCount} successfully`, 
              severity: 'success' 
            });
          }
          return newPlacements;
        }
      } catch (err) {
        const errorMsg = err.message || 'Unable to duplicate element';
        // Check if it's a warning (exclusive service)
        if (errorMsg.includes('exclusive') || errorMsg.includes('maximum quantity')) {
          setToastNotification({ open: true, message: errorMsg, severity: 'warning' });
        } else {
          setToastNotification({ open: true, message: errorMsg, severity: 'error' });
        }
        throw err;
      }
    },
    [resourceId, designerMode, projectId]
  );

  const handleDuplicateMultiple = useCallback(
    async (placementIds) => {
      if (!placementIds || placementIds.length === 0) return;
      
      // Group placements by bundleId to avoid duplicating the same bundle multiple times
      const bundleGroups = new Map();
      const singlePlacements = [];
      
      placementIds.forEach((id) => {
        const placement = placements.find((p) => p.id === id);
        if (placement?.metadata?.bundleId) {
          const bundleId = placement.metadata.bundleId;
          if (!bundleGroups.has(bundleId)) {
            bundleGroups.set(bundleId, id); // Store one representative ID per bundle
          }
        } else {
          singlePlacements.push(id);
        }
      });
      
      const uniqueIds = [...Array.from(bundleGroups.values()), ...singlePlacements];
      const results = [];
      
      const warnings = [];
      for (const id of uniqueIds) {
        try {
          const result = await handleDuplicatePlacement(id);
          if (result) {
            // result can be an array (for bundles) or a single placement
            if (Array.isArray(result)) {
              results.push(...result);
            } else {
              results.push(result);
            }
            // Collect warnings from the response
            // Note: handleDuplicatePlacement shows toast, but we collect for summary
          }
        } catch (err) {
          // Continue with other elements even if one fails
          console.error(`Failed to duplicate element ${id}:`, err);
          // Check if it's a warning (exclusive service, etc.)
          if (err.message && (err.message.includes('exclusive') || err.message.includes('maximum quantity'))) {
            warnings.push(err.message);
          }
        }
      }
      
      if (results.length > 0 || warnings.length > 0) {
        const itemCount = results.length > 1 ? `${results.length} elements` : results.length === 1 ? 'element' : 'elements';
        if (warnings.length > 0) {
          // Show warning if some duplications failed
          setToastNotification({
            open: true,
            message: results.length > 0 
              ? `Duplicated ${itemCount}. Some elements could not be duplicated.`
              : `Some elements could not be duplicated.`,
            severity: 'warning',
          });
        } else if (results.length > 0) {
          setToastNotification({
            open: true,
            message: `Duplicated ${itemCount} successfully`,
            severity: 'success',
          });
        }
      }
    },
    [handleDuplicatePlacement, placements]
  );

  const handleDeleteMultiple = useCallback(
    async (placementIds) => {
      if (!placementIds || placementIds.length === 0) return;
      const results = [];
      for (const id of placementIds) {
        try {
          await handleRemovePlacement(id);
          results.push(id);
        } catch (err) {
          console.error(`Failed to delete element ${id}:`, err);
        }
      }
      if (results.length > 0) {
        setToastNotification({
          open: true,
          message: `Deleted ${results.length} element(s)`,
          severity: 'success',
        });
      }
    },
    [handleRemovePlacement]
  );

  const handleLockMultiple = useCallback(
    async (placementIds, lockState) => {
      if (!placementIds || placementIds.length === 0) return;
      const results = [];
      for (const id of placementIds) {
        try {
          const placement = placements.find((p) => p.id === id);
          if (placement && placement.isLocked !== lockState) {
            await handleToggleLock(placement);
            results.push(id);
          }
        } catch (err) {
          console.error(`Failed to ${lockState ? 'lock' : 'unlock'} element ${id}:`, err);
        }
      }
      if (results.length > 0) {
        setToastNotification({
          open: true,
          message: `${lockState ? 'Locked' : 'Unlocked'} ${results.length} element(s)`,
          severity: 'success',
        });
      }
    },
    [placements, handleToggleLock]
  );

  const handleSidebarToggle = () => {
    const nextCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(nextCollapsed);
    setDesignLayout((prev) =>
      normalizeLayout({
        ...(prev || {}),
        sidebar: { ...(prev?.sidebar || {}), collapsed: nextCollapsed },
      })
    );
  };

  const handleManualSave = () => {
    if (layoutAutosaveTimerRef.current) {
      clearTimeout(layoutAutosaveTimerRef.current);
      layoutAutosaveTimerRef.current = null;
    }
    saveLayoutData(normalizeLayout(designLayout || {}));
  };

  const handleShow3D = (item, modelSrc) => {
    setThreeDPreview({ item, modelSrc });
  };

  // Note: checkoutGroupedByVendor is no longer needed - CheckoutModal fetches its own data from backend endpoint

  const contextValue = useMemo(
    () => ({
      projectId,
      packageId,
      mode: designerMode,
      resourceId,
      placements,
      projectServices,
      isLoading,
      availabilityMap,
      venueInfo,
      venueDesignId,
      refreshAvailability,
      onToggleLock: handleToggleLock,
      onRemovePlacement: handleRemovePlacement,
      onRemoveProjectService: handleRemoveProjectService,
      setToastNotification,
      onUpdatePlacement: handleUpdatePlacement,
      onDuplicatePlacement: handleDuplicatePlacement,
      onDuplicateMultiple: handleDuplicateMultiple,
      onDeleteMultiple: handleDeleteMultiple,
      onLockMultiple: handleLockMultiple,
      onReloadDesign: handleTagUpdateReload,
      savingState,
      designLayout,
      setDesignLayout,
      sceneOptions: {},
      setToastNotification,
    }),
    [
      projectId,
      packageId,
      designerMode,
      resourceId,
      placements,
      projectServices,
      isLoading,
      availabilityMap,
      venueInfo,
      venueDesignId,
      refreshAvailability,
      handleToggleLock,
      handleRemovePlacement,
      handleRemoveProjectService,
      handleUpdatePlacement,
      handleDuplicatePlacement,
      handleDuplicateMultiple,
      handleDeleteMultiple,
      handleLockMultiple,
      handleTagUpdateReload,
      savingState,
      designLayout,
    ]
  );

  useEffect(() => {
    return () => {
      if (layoutAutosaveTimerRef.current) {
        clearTimeout(layoutAutosaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadDesign();
  }, [loadDesign]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadCatalog();
    }, 250);
    return () => clearTimeout(timeout);
  }, [loadCatalog]);

  useEffect(() => {
    refreshAvailability();
    const interval = setInterval(refreshAvailability, 60000);
    return () => clearInterval(interval);
  }, [refreshAvailability]);

  useEffect(() => {
    if (!projectId) return;
    if (skipNextLayoutSaveRef.current) {
      skipNextLayoutSaveRef.current = false;
      return;
    }
    if (!designLayout) return;
    if (layoutAutosaveTimerRef.current) {
      clearTimeout(layoutAutosaveTimerRef.current);
    }
    layoutAutosaveTimerRef.current = setTimeout(() => {
      saveLayoutData(designLayout);
    }, 800);

    return () => {
      if (layoutAutosaveTimerRef.current) {
        clearTimeout(layoutAutosaveTimerRef.current);
      }
    };
  }, [designLayout, projectId, saveLayoutData]);

  const backHref = designerMode === 'package' 
    ? '/admin/packages' 
    : projectId 
      ? `/project-dashboard?projectId=${projectId}` 
      : '/project-dashboard';
  const backLabel = designerMode === 'package' ? 'Back to packages' : 'Back to dashboard';
  const handleBackNavigation = useCallback(() => {
    navigate(backHref);
  }, [navigate, backHref, projectId]);

  if (designerMode === 'project' && !projectId) {
    return (
      <div className="venue-designer">
        <div className="empty-state">
          <h3>Please select a wedding project first</h3>
          <p>
            Open the designer from a project card or use the route <code>/projects/PROJECT_ID/venue-designer</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <VenueDesignerProvider value={contextValue}>
      <div className="venue-designer">

      <div className="venue-layout">
        <CatalogSidebar
          collapsed={sidebarCollapsed}
          onToggle={handleSidebarToggle}
          backLabel={backLabel}
          backTo={backHref}
          onBack={handleBackNavigation}
          searchTerm={searchTerm}
          onSearch={setSearchTerm}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          categories={CATEGORIES}
          items={catalogItems}
          loading={catalogLoading}
          onAdd={handleAddItem}
          onShowDetails={setSelectedItemInfo}
          selectedItem={selectedItemInfo}
          onCloseDetails={() => setSelectedItemInfo(null)}
          onShowItem3D={handleShow3D}
          onMessageVendor={
            designerMode === 'project'
              ? async (item) => {
                  try {
                    const vendorId = item?.vendor?.id || item?.vendor?.userId;
                    if (!vendorId) {
                      console.error('Vendor data:', item?.vendor);
                      alert('Vendor information not available');
                      return;
                    }
                    const conversation = await apiFetch('/conversations', {
                      method: 'POST',
                      body: JSON.stringify({ vendorId }),
                    });
                    window.location.href = `/messages?conversationId=${conversation.id}`;
                  } catch (err) {
                    console.error('Failed to create conversation:', err);
                    alert(err.message || 'Failed to start conversation');
                  }
                }
              : undefined
          }
        />

        <div className="canvas-column">
          {isLoading ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%',
              gap: '16px',
              color: '#666'
            }}>
              <CircularProgress size={48} />
              <Typography variant="h6">Loading venue design...</Typography>
            </div>
          ) : (
            <Scene3D
              designerMode={designerMode}
              onSaveDesign={handleManualSave}
              onOpenSummary={designerMode === 'project' ? () => setShowCheckout(true) : undefined}
              onProceedCheckout={designerMode === 'project' ? () => setShowCheckout(true) : undefined}
              onRegisterCapture={handleRegisterCapture}
              budgetData={
                designerMode === 'project' && totalBudget > 0
                  ? {
                      total: totalBudget,
                      planned: effectivePlannedSpend,
                      actual: totalSpent,
                      remaining: remainingBudget,
                      progress: budgetProgress,
                    }
                  : designerMode === 'project' && totalBudget === 0
                  ? {
                      showMessage: true,
                      message: 'No budget set. Please set your total budget in Budget Management to track your spending.',
                      projectId: projectId,
                    }
                  : null
              }
            />
          )}
        </div>
      </div>

      {designerMode === 'project' && (
        <DesignSummary
          open={showCheckout}
          onClose={() => setShowCheckout(false)}
          eventStartTime={eventStartTime}
          eventEndTime={eventEndTime}
          onProceedToCheckout={() => {
            setShowCheckout(false);
            setShowCheckoutModal(true);
          }}
        />
      )}

      {designerMode === 'project' && (
        <CheckoutModal
          open={showCheckoutModal}
          onClose={() => setShowCheckoutModal(false)}
          projectId={projectId}
          weddingDate={weddingDate}
          venueDesignId={venueDesignId}
          eventStartTime={eventStartTime}
          eventEndTime={eventEndTime}
          onSuccess={() => {
            // Keep the current design and camera position; refresh booked quantities only.
            setShowCheckoutModal(false);
            refreshBookedQuantities();
            setToastNotification({
              open: true,
              severity: 'success',
              message: 'Your booking request has been submitted. You can track it under My Bookings.',
            });
          }}
          onShowToast={setToastNotification}
        />
      )}

      {threeDPreview && (
        <Listing3DDialog
          open={Boolean(threeDPreview)}
          item={threeDPreview.item}
          modelSrc={threeDPreview.modelSrc}
          onClose={() => setThreeDPreview(null)}
          onRefreshCatalog={loadCatalog}
          catalogItems={catalogItems}
        />
      )}

      {/* Toast Notification */}
      <Snackbar
        open={toastNotification.open}
        autoHideDuration={6000}
        onClose={() => setToastNotification({ ...toastNotification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToastNotification({ ...toastNotification, open: false })}
          severity={toastNotification.severity}
          sx={{ width: '100%' }}
        >
          {toastNotification.message}
        </Alert>
      </Snackbar>
      </div>
    </VenueDesignerProvider>
  );
};

export default VenueDesigner; 