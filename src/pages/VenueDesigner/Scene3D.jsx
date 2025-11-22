import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import PlacedElement from './PlacedElement';
import { useVenueDesigner } from './VenueDesignerContext';
import { useWASDControls } from './useWASDControls';
import './Scene3D.css';

const DEFAULT_GRID = {
  size: 1,
  visible: false, // Grid hidden by default
  snapToGrid: false, // Snap off by default - allow free movement
};

const SceneGround = ({ size = 160 }) => (
  <group position={[0, -0.05, 0]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ isGround: true }}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        color="#dae0ea"
        roughness={0.92}
        metalness={0}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
    </mesh>
  </group>
);

const normalizeUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/uploads')) {
    return `http://localhost:4000${url}`;
  }
  return url;
};

const VenueModel = ({ modelUrl }) => {
  const { scene } = useGLTF(modelUrl);

  const venueScene = useMemo(() => {
    if (!scene) return null;
    const copy = scene.clone(true);
    copy.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
        }
      }
    });

    const bbox = new THREE.Box3().setFromObject(copy);
    const center = bbox.getCenter(new THREE.Vector3());
    copy.position.sub(center);

    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    let normalization = 1;
    if (maxDim > 80) {
      normalization = 80 / maxDim;
    } else if (maxDim < 10) {
      normalization = 10 / maxDim;
    }
    copy.scale.setScalar(normalization);

    // After scaling, realign so the venue floor sits on y=0
    const alignedBox = new THREE.Box3().setFromObject(copy);
    const minY = alignedBox.min.y;
    copy.position.y -= minY;

    return copy;
  }, [scene]);

  if (!venueScene) return null;

  return <primitive object={venueScene} />;
};

// WASD Controls Component
const WASDControls = () => {
  useWASDControls();
  return null;
};

const Scene3D = () => {
  const {
    placements = [],
    availabilityMap = {},
    savingState,
    designLayout,
    setDesignLayout,
    onUpdatePlacement,
    onRemovePlacement,
    onToggleLock,
    venueInfo,
    sceneOptions = {},
  } = useVenueDesigner();

  const [selectedId, setSelectedId] = useState(null);
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const venueModelUrl = useMemo(() => normalizeUrl(venueInfo?.modelFile), [venueInfo?.modelFile]);

  const gridSettings = useMemo(() => {
    if (!designLayout?.grid) return DEFAULT_GRID;
    return {
      size: designLayout.grid.size ?? DEFAULT_GRID.size,
      visible: designLayout.grid.visible ?? DEFAULT_GRID.visible,
      snapToGrid: designLayout.grid.snapToGrid ?? DEFAULT_GRID.snapToGrid,
    };
  }, [designLayout]);

  const effectiveGrid = useMemo(() => {
    let result = gridSettings;
    // Force grid to be hidden and snap to be off
    result = { ...result, visible: false, snapToGrid: false };
    if (sceneOptions.forceGridVisible === false) {
      result = { ...result, visible: false };
    }
    if (sceneOptions.forceSnap === false) {
      result = { ...result, snapToGrid: false };
    }
    return result;
  }, [gridSettings, sceneOptions]);

  const gridDivisions = useMemo(() => {
    const base = effectiveGrid.size || 1;
    return Math.max(10, Math.min(200, Math.round(160 / base)));
  }, [effectiveGrid.size]);

  const handleCloseSelection = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleSelect = useCallback((placementId) => {
    setSelectedId(placementId);
  }, []);

  const handleCanvasPointerMiss = useCallback(() => {
    handleCloseSelection();
  }, [handleCloseSelection]);

  const handleDeletePlacement = useCallback(
    (placementId) => {
      if (!placementId || sceneOptions.allowRemoval === false) return;
      if (onRemovePlacement) {
        onRemovePlacement(placementId);
      } else if (onUpdatePlacement) {
        onUpdatePlacement(placementId, { remove: true });
      }
      if (selectedId === placementId) {
        setSelectedId(null);
      }
    },
    [onRemovePlacement, onUpdatePlacement, selectedId, sceneOptions.allowRemoval]
  );

  const handleTogglePlacementLock = useCallback(
    (placement) => {
      onToggleLock?.(placement);
    },
    [onToggleLock]
  );

  const handleTransformCommit = useCallback(
    async (placementId, nextState) => {
      if (!placementId || !nextState) return;
      const payload = {};
      if (nextState.position) {
        payload.position = nextState.position;
      }
      if (typeof nextState.rotation === 'number') {
        payload.rotation = nextState.rotation;
      }
      if (Object.keys(payload).length === 0) return;
      try {
        await onUpdatePlacement?.(placementId, payload);
      } catch (err) {
        // Errors already handled upstream, no-op to keep interaction smooth
      }
    },
    [onUpdatePlacement]
  );

  const updateGridSetting = useCallback(
    (key, value) => {
      setDesignLayout?.((prev) => ({
        ...(prev || {}),
        grid: {
          ...(prev?.grid || {}),
          [key]: value,
        },
      }));
    },
    [setDesignLayout]
  );

  const handleToggleGrid = () => {
    updateGridSetting('visible', !effectiveGrid?.visible);
  };

  const handleToggleSnap = () => {
    updateGridSetting('snapToGrid', !effectiveGrid?.snapToGrid);
  };

  const selectedPlacement = placements.find((placement) => placement.id === selectedId) || null;

  return (
    <div className="scene3d-wrapper">
      <div className="scene3d-toolbar">
        {/* Grid and snap controls removed - grid is hidden and snap is off by default */}
        {selectedPlacement && (
          <div className="scene3d-selection">
            <strong>{selectedPlacement.designElement?.name || 'Design Element'}</strong>
            <span>
              Position:{' '}
              {`${selectedPlacement.position?.x?.toFixed(2) ?? 0}, ${
                selectedPlacement.position?.y?.toFixed(2) ?? 0
              }, ${selectedPlacement.position?.z?.toFixed(2) ?? 0}`}
            </span>
          </div>
        )}
      </div>

      <Canvas
        shadows
        camera={{ position: [14, 16, 18], fov: 42, near: 0.1, far: 500 }}
        dpr={[1, 2]}
        onPointerMissed={handleCanvasPointerMiss}
      >
        <color attach="background" args={['#cbd2de']} />
        <fog attach="fog" args={['#efe9e4', 60, 220]} />
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[18, 30, 20]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight position={[-20, 15, -10]} intensity={0.4} />

        <SceneGround size={200} />

        {venueModelUrl && (
          <Suspense fallback={null}>
            <VenueModel modelUrl={venueModelUrl} />
          </Suspense>
        )}

        {effectiveGrid.visible && (
          <gridHelper args={[160, gridDivisions, '#d8d2cc', '#ece7e2']} position={[0, 0.05, 0]} />
        )}

        <ContactShadows
          position={[0, 0.02, 0]}
          opacity={0.35}
          width={160}
          height={160}
          blur={1.8}
          far={50}
        />

        <Suspense fallback={null}>
          {placements.map((placement) => (
            <PlacedElement
              key={placement.id}
              placement={placement}
              isSelected={selectedId === placement.id}
              onSelect={handleSelect}
              availability={availabilityMap[placement.metadata?.serviceListingId]}
              snapIncrement={effectiveGrid.snapToGrid ? effectiveGrid.size || 1 : null}
              onOrbitToggle={setOrbitEnabled}
              onTransformCommit={handleTransformCommit}
              allPlacements={placements}
              removable={true}
              onDelete={handleDeletePlacement}
              onToggleLock={handleTogglePlacementLock}
              onShowDetails={sceneOptions.onShowDetails}
              onClose={handleCloseSelection}
            />
          ))}
        </Suspense>

        <Environment preset="sunset" />

        <WASDControls />

        <OrbitControls
          makeDefault
          enabled={orbitEnabled}
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={80}
          minPolarAngle={0.05}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 2, 0]}
        />
      </Canvas>

      <div className="scene3d-meta">
        <span>Wedding Venue Space</span>
        {savingState?.lastSaved && (
          <span className="scene3d-meta-muted">
            Last saved {new Date(savingState.lastSaved).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
};

export default Scene3D;


