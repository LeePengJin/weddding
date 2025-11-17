import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import './VenueDesigner.styles.css';
import DesignSummary from './DesignSummary';
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

const formatImageUrl = (url) => {
  if (!url) return '/images/default-product.jpg';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads')) return `http://localhost:4000${url}`;
  return url;
};

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
  const [designLayout, setDesignLayout] = useState({});
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [savingState, setSavingState] = useState({ loading: false, lastSaved: null });

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
      setDesignLayout(data.design?.layoutData || {});
      setSidebarCollapsed(data.design?.layoutData?.sidebar?.collapsed ?? false);
      setSavingState((prev) => ({
        ...prev,
        lastSaved: data.design?.layoutData?.lastSavedAt || null,
      }));

      const backendBudget = data.project?.budget?.totalBudget;
      if (backendBudget) {
        setTotalBudget(Number(backendBudget));
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

  const persistLayout = useCallback(
    async (nextLayout) => {
      if (!projectId) return;
      setDesignLayout(nextLayout);
      setSavingState((prev) => ({ ...prev, loading: true }));
      try {
        await saveVenueDesign(projectId, { layoutData: nextLayout });
        setSavingState({
          loading: false,
          lastSaved: new Date().toISOString(),
        });
      } catch (err) {
        setErrorMessage(err.message || 'Failed to save design layout');
        setSavingState((prev) => ({ ...prev, loading: false }));
      }
    },
    [projectId]
  );

  const handleAddItem = async (item) => {
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
  };

  const handleRemovePlacement = async (placementId, scope = 'bundle') => {
    if (!projectId) return;
    try {
      const response = await deleteDesignElement(projectId, placementId, scope);
      const removedIds = response.removedPlacementIds || [];
      setPlacements((prev) => prev.filter((placement) => !removedIds.includes(placement.id)));
      setErrorMessage('');
    } catch (err) {
      setErrorMessage(err.message || 'Unable to remove item');
    }
  };

  const handleToggleLock = async (placement) => {
    if (!projectId) return;
    try {
      const updated = await updateDesignElement(projectId, placement.id, {
        isLocked: !placement.isLocked,
      });
      setPlacements((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setErrorMessage(err.message || 'Unable to update lock state');
    }
  };

  const handleSidebarToggle = () => {
    const nextCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(nextCollapsed);
    const nextLayout = {
      ...designLayout,
      sidebar: { collapsed: nextCollapsed },
    };
    persistLayout(nextLayout);
  };

  const handleManualSave = () => {
    persistLayout(designLayout || {});
  };

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
              savingState={savingState}
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

          <div className="canvas-stage">
            <div className="canvas-placeholder">
              <div className="venue-outline">
                <div className="venue-floor">
                  {isLoading && (
                    <div className="canvas-hint">
                      <i className="fas fa-spinner fa-spin"></i>
                      <p>Loading your design…</p>
                    </div>
                  )}

                  {!isLoading &&
                    placements.map((placement) => {
                      const isUnavailable =
                        availabilityMap[placement.metadata?.serviceListingId]?.available === false;
                      return (
                        <div
                          key={placement.id}
                          className={`placed-item ${placement.isLocked ? 'locked' : ''} ${
                            isUnavailable ? 'placement-unavailable' : ''
                          }`}
                        >
                          <div className="placed-item-top">
                            <span>{placement.designElement?.name || 'Design Element'}</span>
                            {isUnavailable && <span className="placement-warning">Unavailable</span>}
                          </div>
                          <div className="placed-item-actions">
                            <button onClick={() => handleToggleLock(placement)}>
                              <i className={`fas fa-lock${placement.isLocked ? '' : '-open'}`}></i>
                            </button>
                            <button onClick={() => handleRemovePlacement(placement.id)}>
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
              {!isLoading && placements.length === 0 && (
                <div className="canvas-hint">
                  <i className="fas fa-mouse-pointer"></i>
                  <p>Drag items from the catalog to place them in your venue</p>
                  <p className="hint-secondary">Items placed: {placements.length}</p>
                </div>
              )}
            </div>
            <div className="scene-meta">
              <span>Wedding Venue Design</span>
              <span className="scene-meta-muted">
                {savingState.lastSaved ? `Last saved ${new Date(savingState.lastSaved).toLocaleTimeString()}` : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {selectedItemInfo && (
        <div className="item-details-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Item Details</h3>
              <button className="close-modal-btn" onClick={() => setSelectedItemInfo(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body">
              <div className="item-details-grid">
                <div className="item-image-large">
                  <img src={formatImageUrl(selectedItemInfo.images?.[0])} alt={selectedItemInfo.name} />
                </div>

                <div className="item-details-info">
                  <h4>{selectedItemInfo.name}</h4>
                  <p className="item-description">{selectedItemInfo.description}</p>
                  <div className="item-price-large">
                    RM {Number(selectedItemInfo.price).toLocaleString()}
                  </div>

                  <div className="vendor-info">
                    <h5>Vendor Information</h5>
                    <p>
                      <strong>Vendor:</strong> {selectedItemInfo.vendor?.name || 'Vendor'}
                    </p>
                    <p>
                      <strong>Category:</strong> {selectedItemInfo.category?.replace('_', ' ') || 'Uncategorised'}
                    </p>
                  </div>

                  <div className="item-actions">
                    <button
                      className="add-to-design-btn"
                      onClick={() => {
                        handleAddItem(selectedItemInfo);
                        setSelectedItemInfo(null);
                      }}
                    >
                      <i className="fas fa-plus"></i>
                      Add to Design
                    </button>
                    <button
                      className="message-vendor-btn"
                      onClick={() => {
                        window.location.href = '/messages';
                      }}
                    >
                      <i className="fas fa-comment"></i>
                      Message Vendor
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCheckout && (
        <DesignSummary
          onClose={() => setShowCheckout(false)}
          onSubmit={() => {
            setShowCheckout(false);
          }}
        />
      )}
    </div>
  );
};

export default VenueDesigner;