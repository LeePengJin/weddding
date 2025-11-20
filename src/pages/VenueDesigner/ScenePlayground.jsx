import React, { useCallback, useMemo, useState } from 'react';
import Scene3D from './Scene3D';
import { VenueDesignerProvider } from './VenueDesignerContext';
import './ScenePlayground.css';

const DEFAULT_LAYOUT = {
  grid: { size: 1, visible: false, snapToGrid: false },
  sidebar: { collapsed: false },
};

const DEMO_VENUES = [
  {
    label: 'Grand Ballroom',
    url: 'http://localhost:4000/uploads/models3d/usr_01KAGENSM8QB0P9ZP518YTP1YH_1763648057229_2450.glb',
  },
  {
    label: 'Garden Pavilion',
    url: 'http://localhost:4000/uploads/models3d/usr_01KAGENSM8QB0P9ZP518YTP1YH_1763648057147_6645.glb',
  },
];

const DEMO_ITEMS = [
  {
    name: 'Premium Plastic Chair',
    modelFile: 'http://localhost:4000/uploads/models3d/usr_01KAGENSM8QB0P9ZP518YTP1YH_1763648057229_2450.glb',
    metadata: { footprintRadius: 0.5 },
    dimensions: { width: 0.45, height: 0.9, depth: 0.45 },
    isStackable: false,
  },
  {
    name: 'Cocktail Table',
    modelFile: 'http://localhost:4000/uploads/models3d/usr_01KAGENSM8QB0P9ZP518YTP1YH_1763648057147_6645.glb',
    metadata: { footprintRadius: 0.7 },
    dimensions: { width: 0.75, height: 1.1, depth: 0.75 },
    isStackable: false,
  },
  {
    name: 'Banquet Table',
    modelFile: 'http://localhost:4000/uploads/models3d/b78b8368-be53-4044-aa72-fcf598323c11.glb',
    metadata: { footprintRadius: 1.2 },
    dimensions: { width: 1.8, height: 0.75, depth: 1.8 },
    isStackable: false,
  },
];

const ScenePlayground = () => {
  const [placements, setPlacements] = useState(() =>
    DEMO_ITEMS.map((item, index) => ({
      id: `ple_demo_${index}`,
      position: { x: index * 2, y: 0, z: 0 },
      rotation: 0,
      isLocked: false,
      metadata: { ...(item.metadata || {}) },
      designElement: {
        id: `demo_item_${index}`,
        name: item.name,
        modelFile: item.modelFile,
        isStackable: item.isStackable ?? false,
        dimensions: item.dimensions || null,
      },
    }))
  );
  const [designLayout, setDesignLayout] = useState(DEFAULT_LAYOUT);
  const [venueModelUrl, setVenueModelUrl] = useState('');
  const [newItemName, setNewItemName] = useState('New Item');
  const [newItemModel, setNewItemModel] = useState('');
  const [newItemDimensions, setNewItemDimensions] = useState({ width: '', height: '', depth: '' });
  const [newItemStackable, setNewItemStackable] = useState(true);

  const buildDimensionsPayload = useCallback((dims) => {
    const out = {};
    ['width', 'height', 'depth'].forEach((axis) => {
      const raw = dims?.[axis];
      if (raw === '' || raw === null || raw === undefined) return;
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) {
        out[axis] = value;
      }
    });
    return Object.keys(out).length ? out : null;
  }, []);

  const handleAddItem = () => {
    const id = `ple_demo_${Date.now()}`;
    const dimensions = buildDimensionsPayload(newItemDimensions);
    const computedRadius =
      dimensions && (dimensions.width || dimensions.depth)
        ? Math.max(dimensions.width || 0, dimensions.depth || 0) / 2
        : undefined;
    setPlacements((prev) => [
      ...prev,
      {
        id,
        position: { x: Math.random() * 4 - 2, y: 0, z: Math.random() * 4 - 2 },
        rotation: 0,
        isLocked: false,
        metadata: {
          isStackable: newItemStackable,
          ...(computedRadius ? { footprintRadius: computedRadius } : {}),
        },
        designElement: {
          id: `demo_design_${Date.now()}`,
          name: newItemName || 'New Item',
          modelFile: newItemModel || null,
          isStackable: newItemStackable,
          dimensions,
        },
      },
    ]);
  };

  const handleClearItems = () => {
    setPlacements([]);
    setVenueModelUrl('');
  };
  const handleUseDemo = () => {
    setVenueModelUrl('');
    setPlacements(
      DEMO_ITEMS.map((item, index) => ({
        id: `ple_demo_reset_${index}`,
        position: { x: (index - 1) * 2, y: 0, z: index % 2 === 0 ? -2 : 2 },
        rotation: 0,
        isLocked: false,
        metadata: { ...(item.metadata || {}) },
        designElement: {
          id: `demo_item_reset_${index}`,
          name: item.name,
          modelFile: item.modelFile,
          isStackable: item.isStackable ?? false,
          dimensions: item.dimensions || null,
        },
      }))
    );
  };

  const handleUpdatePlacement = useCallback(
    async (placementId, payload) => {
      let updatedPlacement = null;
      setPlacements((prev) => {
        if (payload.remove) {
          return prev.filter((placement) => placement.id !== placementId);
        }
        return prev.map((placement) => {
          if (placement.id !== placementId) return placement;
          const nextPlacement = {
            ...placement,
            position: payload.position ? { ...placement.position, ...payload.position } : placement.position,
            rotation: payload.rotation ?? placement.rotation,
          };
          updatedPlacement = nextPlacement;
          return nextPlacement;
        });
      });
      return updatedPlacement;
    },
    [setPlacements]
  );

  const contextValue = useMemo(
    () => ({
      projectId: 'playground',
      placements,
      isLoading: false,
      availabilityMap: {},
      venueInfo: venueModelUrl ? { modelFile: venueModelUrl } : null,
      refreshAvailability: () => {},
      onToggleLock: () => {},
      onRemovePlacement: (id) => handleUpdatePlacement(id, { remove: true }),
      onUpdatePlacement: handleUpdatePlacement,
      savingState: { loading: false, lastSaved: null },
      designLayout,
      setDesignLayout,
      sceneOptions: {
        allowGridControls: false,
        allowSnapToggle: false,
        forceGridVisible: false,
        forceSnap: false,
        allowRemoval: true,
      },
    }),
    [placements, venueModelUrl, handleUpdatePlacement, designLayout]
  );

  return (
    <div className="scene-playground">
      <aside className="scene-playground-controls">
        <h2>Scene Playground</h2>
        <p>Use this sandbox to try assets and layout ideas before moving into the real designer.</p>

        <label>
          Venue Model URL
          <input
            type="text"
            value={venueModelUrl}
            onChange={(e) => setVenueModelUrl(e.target.value)}
            placeholder="/uploads/models/venue.glb"
          />
        </label>

        <div className="scene-playground-demo">
          <span>Quick Demo Venues</span>
          <div className="scene-playground-demo-buttons">
            {DEMO_VENUES.map((venue) => (
              <button
                key={venue.label}
                type="button"
                onClick={() => setVenueModelUrl(venue.url)}
                className={venueModelUrl === venue.url ? 'active' : ''}
              >
                {venue.label}
              </button>
            ))}
          </div>
        </div>

        <div className="scene-playground-divider" />

        <label>
          Item name
          <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} />
        </label>

        <label>
          Item model URL
          <input
            type="text"
            value={newItemModel}
            onChange={(e) => setNewItemModel(e.target.value)}
            placeholder="/uploads/models/item.glb"
          />
        </label>

        <div className="scene-playground-dimensions">
          <span>Dimensions (meters)</span>
          <div className="dimension-inputs">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Width"
              value={newItemDimensions.width}
              onChange={(e) =>
                setNewItemDimensions((prev) => ({ ...prev, width: e.target.value }))
              }
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Height"
              value={newItemDimensions.height}
              onChange={(e) =>
                setNewItemDimensions((prev) => ({ ...prev, height: e.target.value }))
              }
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Depth"
              value={newItemDimensions.depth}
              onChange={(e) =>
                setNewItemDimensions((prev) => ({ ...prev, depth: e.target.value }))
              }
            />
          </div>
          <label className="stackable-toggle">
            <input
              type="checkbox"
              checked={newItemStackable}
              onChange={(e) => setNewItemStackable(e.target.checked)}
            />
            <span>Stackable item</span>
          </label>
        </div>

        <button type="button" onClick={handleAddItem} className="primary-btn">
          Add Item
        </button>
        <button type="button" onClick={handleClearItems} className="secondary-btn">
          Clear Items
        </button>
        <button type="button" onClick={handleUseDemo} className="secondary-btn">
          Load Demo Setup
        </button>

        <div className="scene-playground-meta">
          <span>Items: {placements.length}</span>
          <span>Grid size: {designLayout.grid.size}</span>
        </div>
      </aside>

      <div className="scene-playground-stage">
        <VenueDesignerProvider value={contextValue}>
          <Scene3D />
        </VenueDesignerProvider>
      </div>
    </div>
  );
};

export default ScenePlayground;


