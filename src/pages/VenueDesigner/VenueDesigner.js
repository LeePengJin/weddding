import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
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
} from '../../lib/api';
import BudgetTracker from '../../components/BudgetTracker/BudgetTracker';
import CatalogSidebar from '../../components/Catalog/CatalogSidebar';
import Listing3DDialog from '../../components/Catalog/Listing3DDialog';
import Scene3D from './Scene3D';
import { VenueDesignerProvider } from './VenueDesignerContext';

const CATEGORIES = [
  'All Categories',
  'Venue',
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
  const { projectId: routeProjectId } = useParams();
  const searchParams = new URLSearchParams(location.search);
  const projectIdFromQuery = searchParams.get('projectId');
  const projectIdFromState = location.state?.projectId;
  const projectId = routeProjectId || projectIdFromQuery || projectIdFromState || null;

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
  const [venueInfo, setVenueInfo] = useState(null);
  const layoutAutosaveTimerRef = useRef(null);
  const skipNextLayoutSaveRef = useRef(true);

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
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await getVenueDesign(projectId);
      setPlacements(data.design?.placedElements || []);
      skipNextLayoutSaveRef.current = true;
      const layoutFromServer = normalizeLayout(data.design?.layoutData || {});
      setDesignLayout(layoutFromServer);
      setSidebarCollapsed(layoutFromServer.sidebar.collapsed ?? false);
      setVenueInfo(data.venue || null);
      setSavingState((prev) => ({
        ...prev,
        lastSaved: data.design?.layoutData?.lastSavedAt || null,
      }));

      const backendBudget = data.project?.budget?.totalBudget;
      if (backendBudget) {
        setTotalBudget(Number(backendBudget));
      }
      if (data.project?.weddingDate) {
        setWeddingDate(data.project.weddingDate);
      }
      setErrorMessage('');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load venue design');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const loadCatalog = useCallback(async () => {
    if (!projectId) return;
    setCatalogLoading(true);
    try {
      const response = await getVenueCatalog(projectId, {
        search: searchTerm || undefined,
        category: selectedCategory !== 'All Categories' ? selectedCategory : undefined,
        includeUnavailable: true,
      });
      setCatalogItems(response.listings || []);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load catalog');
    } finally {
      setCatalogLoading(false);
    }
  }, [projectId, searchTerm, selectedCategory]);

  const refreshAvailability = useCallback(async () => {
    if (!projectId || placements.length === 0) return;
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
  }, [projectId, placements]);

  const saveLayoutData = useCallback(
    async (layoutData = {}) => {
      if (!projectId) {
        setErrorMessage('No project selected. Please select a wedding project first.');
        return;
      }
      setSavingState((prev) => ({ ...prev, loading: true }));
      setErrorMessage(''); // Clear any previous errors
      try {
        const payload = { layoutData };
        await saveVenueDesign(projectId, payload);
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
    [projectId]
  );

  const handleAddItem = useCallback(async (item) => {
    if (!projectId) return;
    try {
      const response = await addDesignElement(projectId, {
        serviceListingId: item.id,
      });
      setPlacements((prev) => [...prev, ...(response.placements || [])]);
      setErrorMessage('');
    } catch (err) {
      setErrorMessage(err.message || 'Unable to add item to design');
    }
  }, [projectId]);

  const handleRemovePlacement = useCallback(async (placementId, scope = 'bundle') => {
    if (!projectId) return;
    try {
      const response = await deleteDesignElement(projectId, placementId, scope);
      const removedIds = response.removedPlacementIds || [];
      setPlacements((prev) => prev.filter((placement) => !removedIds.includes(placement.id)));
      setErrorMessage('');
    } catch (err) {
      setErrorMessage(err.message || 'Unable to remove item');
    }
  }, [projectId]);

  const handleToggleLock = useCallback(async (placement) => {
    if (!projectId) return;
    try {
      const updated = await updateDesignElement(projectId, placement.id, {
        isLocked: !placement.isLocked,
      });
      setPlacements((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setErrorMessage(err.message || 'Unable to update lock state');
    }
  }, [projectId]);

  const handleUpdatePlacement = useCallback(
    async (placementId, payload) => {
      if (!projectId) return null;
      try {
        const updated = await updateDesignElement(projectId, placementId, payload);
        setPlacements((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        return updated;
      } catch (err) {
        setErrorMessage(err.message || 'Unable to update element');
        throw err;
      }
    },
    [projectId]
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
      placements,
      isLoading,
      availabilityMap,
      venueInfo,
      refreshAvailability,
      onToggleLock: handleToggleLock,
      onRemovePlacement: handleRemovePlacement,
      onUpdatePlacement: handleUpdatePlacement,
      savingState,
      designLayout,
      setDesignLayout,
      sceneOptions: {},
    }),
    [
      projectId,
      placements,
      isLoading,
      availabilityMap,
      venueInfo,
      refreshAvailability,
      handleToggleLock,
      handleRemovePlacement,
      handleUpdatePlacement,
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

  if (!projectId) {
  return (
    <div className="venue-designer">
        <div className="empty-state">
          <h3>Please select a wedding project first</h3>
          <p>Open the designer from a project card or use the route <code>/projects/PROJECT_ID/venue-designer</code>.</p>
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
          onMessageVendor={() => {
            window.location.href = '/messages';
          }}
        />

        <div className="canvas-column">
          <div className="canvas-toolbar">
            <Link to="/project-dashboard" className="back-link">
              <i className="fas fa-arrow-left"></i>
              Back to dashboard
            </Link>
            <BudgetTracker
              total={totalBudget}
              planned={plannedSpend}
              remaining={remainingBudget}
              progress={budgetProgress}
            />
            <div className="toolbar-actions">
              <button className="secondary-btn" onClick={handleManualSave}>
            <i className="fas fa-save"></i>
                {savingState.loading ? 'Saving…' : 'Save design'}
          </button>
              <button className="secondary-btn" onClick={() => setShowCheckout(true)}>
            <i className="fas fa-list-alt"></i>
            Summary
          </button>
              <button className="primary-btn" onClick={() => setShowCheckout(true)}>
            <i className="fas fa-shopping-cart"></i>
                Proceed to checkout
          </button>
        </div>
      </div>

          <Scene3D />
            </div>
          </div>

      <DesignSummary
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        onProceedToCheckout={() => {
          setShowCheckout(false);
          setShowCheckoutModal(true);
        }}
                />

      <CheckoutModal
        open={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        groupedByVendor={(() => {
          // Calculate groupedByVendor from placements (same logic as DesignSummary)
          const itemGroups = new Map();
          const bundleInstanceTracker = new Map();

          placements.forEach((placement) => {
            const bundleId = placement.metadata?.bundleId;
            const serviceListingId = placement.metadata?.serviceListingId;
            const designElementName = placement.designElement?.name || 'Design Element';
            const groupKey = bundleId
              ? `bundle_${serviceListingId}`
              : `item_${placement.designElement?.id || designElementName}`;

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
                vendorId: placement.designElement?.vendorId,
                vendorName: placement.designElement?.vendor?.name || placement.designElement?.vendor?.user?.name || 'Unknown Vendor',
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
        onSuccess={() => {
          // Refresh design to reflect changes
          loadDesign();
                        }}
      />

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