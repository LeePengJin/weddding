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
    url: 'http://localhost:4000/uploads/models3d/45795a03-092b-46d2-a786-67a938e1845e.glb',
  },
  {
    label: 'Garden Pavilion',
    url: 'http://localhost:4000/uploads/models3d/usr_01K9F1HZ5AH7TDBSNRA853W1SB_1762971888120_1910.glb',
  },
];

const DEMO_ITEMS = [
  {
    name: 'Premium Plastic Chair',
    modelFile: 'http://localhost:4000/uploads/models3d/45795a03-092b-46d2-a786-67a938e1845e.glb',
    metadata: { footprintRadius: 0.8 },
  },
  {
    name: 'Banquet Table',
    modelFile: 'http://localhost:4000/uploads/models3d/usr_01K9F1HZ5AH7TDBSNRA853W1SB_1762971888120_1910.glb',
    metadata: { footprintRadius: 1.5 },
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
      },
    }))
  );
  const [designLayout, setDesignLayout] = useState(DEFAULT_LAYOUT);
  const [venueModelUrl, setVenueModelUrl] = useState(DEMO_VENUES[0].url);
  const [newItemName, setNewItemName] = useState('New Item');
  const [newItemModel, setNewItemModel] = useState('');

  const handleAddItem = () => {
    const id = `ple_demo_${Date.now()}`;
    setPlacements((prev) => [
      ...prev,
      {
        id,
        position: { x: Math.random() * 4 - 2, y: 0, z: Math.random() * 4 - 2 },
        rotation: 0,
        isLocked: false,
        metadata: { isStackable: true },
        designElement: {
          id: `demo_design_${Date.now()}`,
          name: newItemName || 'New Item',
          modelFile: newItemModel || null,
        },
      },
    ]);
  };

  const handleClearItems = () => {
    setPlacements([]);
    setVenueModelUrl('');
  };
  const handleUseDemo = () => {
    setVenueModelUrl(DEMO_VENUES[0].url);
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


