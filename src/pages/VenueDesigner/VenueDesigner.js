import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import './VenueDesigner.styles.css';
import DesignSummary from './DesignSummary.jsx';
import CheckoutModal from './CheckoutModal.jsx';
import {
  getVenueDesign,
  addDesignElement,
  updateDesignElement,
  deleteDesignElement,
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
  const [totalBudget, setTotalBudget] = useState(15000);
  const [placements, setPlacements] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedItemInfo, setSelectedItemInfo] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [designLayout, setDesignLayout] = useState(() => normalizeLayout({}));
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [savingState, setSavingState] = useState({ loading: false, lastSaved: null });
  const [threeDPreview, setThreeDPreview] = useState(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [weddingDate, setWeddingDate] = useState(null);
  const [eventStartTime, setEventStartTime] = useState(null);
  const [eventEndTime, setEventEndTime] = useState(null);
  const [venueInfo, setVenueInfo] = useState(null);
  const [venueDesignId, setVenueDesignId] = useState(null);
  const [projectServices, setProjectServices] = useState([]);
  const layoutAutosaveTimerRef = useRef(null);
  const skipNextLayoutSaveRef = useRef(true);
  const captureScreenshotRef = useRef(null);
  const handleRegisterCapture = useCallback((fn) => {
    captureScreenshotRef.current = fn;
  }, []);

  const plannedSpend = useMemo(() => {
    const bundleTotals = new Map();
    placements.forEach((placement) => {
      const bundleId = placement?.metadata?.bundleId;
      const unitPrice = placement?.metadata?.unitPrice;
      if (bundleId && unitPrice && !bundleTotals.has(bundleId)) {
        bundleTotals.set(bundleId, parseFloat(unitPrice));
      }
    });
    return Array.from(bundleTotals.values()).reduce((sum, price) => sum + price, 0);
  }, [placements]);

  const remainingBudget = Math.max(totalBudget - plannedSpend, 0);
  const budgetProgress = totalBudget > 0 ? (plannedSpend / totalBudget) * 100 : 0;

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
        const backendBudget = data.project?.budget?.totalBudget;
        if (backendBudget) {
          setTotalBudget(Number(backendBudget));
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
      } else {
        // Package mode: set venue info if available
        setVenueInfo(data.venue || null);
        setWeddingDate(null);
      }

      setErrorMessage('');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load venue design');
    } finally {
      setIsLoading(false);
    }
  }, [resourceId, designerMode, projectId, packageId]);

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
      setErrorMessage(err.message || 'Failed to load catalog');
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
        setErrorMessage('No design context selected.');
        return;
      }
      setSavingState((prev) => ({ ...prev, loading: true }));
      setErrorMessage(''); // Clear any previous errors
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
        setErrorMessage(errorMessage);
        setSavingState((prev) => ({ ...prev, loading: false }));
      }
    },
    [resourceId, designerMode, projectId, packageId]
  );

  const handleAddItem = useCallback(
    async (item) => {
      if (!resourceId) return;
      try {
        const response =
          designerMode === 'package'
            ? await addPackageDesignElement(packageId, { serviceListingId: item.id })
            : await addDesignElement(projectId, { serviceListingId: item.id });
        setPlacements((prev) => [...prev, ...(response.placements || [])]);
        setErrorMessage('');
      } catch (err) {
        setErrorMessage(err.message || 'Unable to add item to design');
      }
    },
    [resourceId, designerMode, packageId, projectId]
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
        setErrorMessage('');
      } catch (err) {
        setErrorMessage(err.message || 'Unable to remove item');
      }
    },
    [resourceId, designerMode, packageId, projectId]
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
      setErrorMessage(err.message || 'Unable to update lock state');
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
        setErrorMessage(err.message || 'Unable to update element');
        throw err;
      }
    },
    [resourceId, designerMode, packageId, projectId]
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
      onUpdatePlacement: handleUpdatePlacement,
      onReloadDesign: loadDesign,
      savingState,
      designLayout,
      setDesignLayout,
      sceneOptions: {},
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
      handleUpdatePlacement,
      loadDesign,
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

  const backHref = designerMode === 'package' ? '/admin/packages' : '/project-dashboard';
  const backLabel = designerMode === 'package' ? 'Back to packages' : 'Back to dashboard';
  const handleBackNavigation = useCallback(() => {
    navigate(backHref);
  }, [navigate, backHref]);

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
      {errorMessage && (
        <div className="designer-alert">
          <p>{errorMessage}</p>
          <button onClick={() => setErrorMessage('')}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

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
          <Scene3D
            designerMode={designerMode}
            onSaveDesign={handleManualSave}
            onOpenSummary={designerMode === 'project' ? () => setShowCheckout(true) : undefined}
            onProceedCheckout={designerMode === 'project' ? () => setShowCheckout(true) : undefined}
            onRegisterCapture={handleRegisterCapture}
            budgetData={
              designerMode === 'project'
                ? {
                    total: totalBudget,
                    planned: plannedSpend,
                    remaining: remainingBudget,
                    progress: budgetProgress,
                  }
                : null
            }
          />
        </div>
      </div>

      {designerMode === 'project' && (
        <DesignSummary
          open={showCheckout}
          onClose={() => setShowCheckout(false)}
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
          groupedByVendor={(() => {
            // Calculate groupedByVendor from placements and projectServices (aligned with DesignSummary)
            const itemGroups = new Map();
            const bundleInstanceTracker = new Map();

            // 3D placements
            placements.forEach((placement) => {
              const bundleId = placement.metadata?.bundleId;
              const serviceListingId = placement.metadata?.serviceListingId;
              const designElementName = placement.designElement?.name || placement.serviceListing?.name || 'Service Item';
              const groupKey = bundleId
                ? `bundle_${serviceListingId}`
                : `item_${placement.designElement?.id || placement.id || serviceListingId}`;

              if (!itemGroups.has(groupKey)) {
                const isBundle = Boolean(bundleId);
                const itemName = isBundle
                  ? (placement.serviceListing?.name || 'Bundle Item')
                  : designElementName;

                itemGroups.set(groupKey, {
                  key: groupKey,
                  isBundle,
                  name: itemName,
                  quantity: 0,
                  price: 0,
                  placementIds: [],
                  bundleIds: new Set(),
                  serviceListingId: serviceListingId || null,
                  designElementId: placement.designElement?.id || null,
                  vendorId: placement.designElement?.vendorId || placement.serviceListing?.vendorId,
                  vendorName:
                    placement.designElement?.vendor?.name ||
                    placement.designElement?.vendor?.user?.name ||
                    placement.serviceListing?.vendor?.name ||
                    placement.serviceListing?.vendor?.user?.name ||
                    'Unknown Vendor',
                  isNon3DService: false,
                  isBooked: placement.isBooked || false,
                });
              }

              const group = itemGroups.get(groupKey);
              group.placementIds.push(placement.id);

              if (bundleId) {
                group.bundleIds.add(bundleId);
                if (!bundleInstanceTracker.has(bundleId)) {
                  bundleInstanceTracker.set(bundleId, true);
                  group.quantity += 1;
                  const price = placement.metadata?.unitPrice
                    ? parseFloat(placement.metadata.unitPrice)
                    : placement.serviceListing?.price
                    ? parseFloat(placement.serviceListing.price)
                    : 0;
                  group.price += price;
                }
              } else {
                group.quantity += 1;
                const price = placement.metadata?.unitPrice
                  ? parseFloat(placement.metadata.unitPrice)
                  : placement.serviceListing?.price
                  ? parseFloat(placement.serviceListing.price)
                  : 0;
                group.price += price;
              }
            });

            // Non-3D project services
            projectServices.forEach((ps) => {
              const groupKey = `service_${ps.serviceListingId}`;
              const listing = ps.serviceListing || {};

              if (!itemGroups.has(groupKey)) {
                itemGroups.set(groupKey, {
                  key: groupKey,
                  isBundle: false,
                  name: listing.name || 'Service Item',
                  quantity: 0,
                  price: 0,
                  placementIds: [],
                  bundleIds: new Set(),
                  serviceListingId: ps.serviceListingId,
                  designElementId: null,
                  vendorId: listing.vendor?.id,
                  vendorName:
                    listing.vendor?.name ||
                    listing.vendor?.user?.name ||
                    'Unknown Vendor',
                  isNon3DService: true,
                  isBooked: ps.isBooked,
                });
              }

              const group = itemGroups.get(groupKey);
              group.quantity += ps.quantity || 1;
              const price = listing.price ? parseFloat(listing.price) : 0;
              group.price += price * (ps.quantity || 1);
            });

            const vendorGroups = {};
            Array.from(itemGroups.values()).forEach((item) => {
              const vendorKey = item.vendorId || item.vendorName;
              if (!vendorGroups[vendorKey]) {
                vendorGroups[vendorKey] = {
                  vendorId: item.vendorId,
                  vendorName: item.vendorName,
                  items: [],
                  total: 0,
                };
              }
              const displayName = item.quantity > 1 ? `${item.name} x ${item.quantity}` : item.name;
              vendorGroups[vendorKey].items.push({
                ...item,
                displayName,
              });
              vendorGroups[vendorKey].total += item.price;
            });

            return Object.values(vendorGroups);
          })()}
          projectId={projectId}
          weddingDate={weddingDate}
          venueDesignId={venueDesignId}
          eventStartTime={eventStartTime}
          eventEndTime={eventEndTime}
          onSuccess={() => {
            loadDesign();
          }}
        />
      )}

      {threeDPreview && (
        <Listing3DDialog
          open={Boolean(threeDPreview)}
          item={threeDPreview.item}
          modelSrc={threeDPreview.modelSrc}
          onClose={() => setThreeDPreview(null)}
          />
        )}
      </div>
    </VenueDesignerProvider>
  );
};

export default VenueDesigner; 