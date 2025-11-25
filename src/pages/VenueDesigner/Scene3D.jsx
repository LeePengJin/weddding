import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, PointerLockControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import PlacedElement from './PlacedElement';
import { useVenueDesigner } from './VenueDesignerContext';
import { useWASDControls } from './useWASDControls';
import BudgetTracker from '../../components/BudgetTracker/BudgetTracker';
import './Scene3D.css';

const DEFAULT_GRID = {
  size: 1,
  visible: false, // Grid hidden by default
  snapToGrid: false, // Snap off by default - allow free movement
};

const CAMERA_BOUNDS = {
  minX: -40,
  maxX: 40,
  minZ: -40,
  maxZ: 40,
  minY: 1.2,
  maxY: 18,
};

const FIRST_PERSON_HEIGHT = 1.55;

const exitPointerLockIfNeeded = () => {
  if (document.exitPointerLock && document.pointerLockElement) {
    try {
      document.exitPointerLock();
    } catch (err) {
      console.warn('[PointerLock] exit failed', err);
    }
  }
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

const VenueModel = ({ modelUrl, onBoundsCalculated }) => {
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

    // Calculate final bounds after all transformations
    const finalBox = new THREE.Box3().setFromObject(copy);
    
    // Notify parent of calculated bounds
    if (onBoundsCalculated) {
      onBoundsCalculated({
        minX: finalBox.min.x,
        maxX: finalBox.max.x,
        minY: finalBox.min.y,
        maxY: finalBox.max.y,
        minZ: finalBox.min.z,
        maxZ: finalBox.max.z,
      });
    }

    return copy;
  }, [scene, onBoundsCalculated]);

  if (!venueScene) return null;

  return <primitive object={venueScene} />;
};

// WASD Controls Component
const WASDControls = ({ mode, venueBounds }) => {
  const bounds = venueBounds || CAMERA_BOUNDS;
  useWASDControls({
    mode,
    bounds,
    firstPersonHeight: FIRST_PERSON_HEIGHT,
  });
  return null;
};

const CaptureBridge = ({ onRegisterCapture, controlsRef }) => {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    if (!onRegisterCapture) return undefined;
    const capture = async () => {
      const renderer = gl;
      const prevSize = renderer.getSize(new THREE.Vector2());
      const prevPixelRatio = renderer.getPixelRatio();
      const prevPosition = camera.position.clone();
      const prevQuaternion = camera.quaternion.clone();
      const controls = controlsRef?.current;
      const prevTarget = controls?.target?.clone();
      const framingTarget = new THREE.Vector3(0, 1.5, 0);

      renderer.setPixelRatio(1);
      renderer.setSize(1400, 900, false);

      camera.position.set(18, 14, 20);
      camera.lookAt(framingTarget);
      if (controls && prevTarget) {
        controls.target.copy(framingTarget);
        controls.update();
      }

      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL('image/jpeg', 0.92);

      camera.position.copy(prevPosition);
      camera.quaternion.copy(prevQuaternion);
      if (controls && prevTarget) {
        controls.target.copy(prevTarget);
        controls.update();
      }

      renderer.setPixelRatio(prevPixelRatio);
      renderer.setSize(prevSize.x, prevSize.y, false);

      return dataUrl;
    };
    onRegisterCapture(() => capture());
    return undefined;
  }, [gl, scene, camera, onRegisterCapture, controlsRef]);

  return null;
};

CaptureBridge.propTypes = {
  onRegisterCapture: PropTypes.func,
  controlsRef: PropTypes.shape({ current: PropTypes.object }),
};

CaptureBridge.defaultProps = {
  onRegisterCapture: undefined,
  controlsRef: undefined,
};

const Scene3D = ({ designerMode, onSaveDesign, onOpenSummary, onProceedCheckout, onRegisterCapture, budgetData }) => {
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
  const [viewMode, setViewMode] = useState('orbit'); // 'orbit' | 'walk'
  const [pointerLocked, setPointerLocked] = useState(false);
  const [venueBounds, setVenueBounds] = useState(null);
  const venueModelUrl = useMemo(() => normalizeUrl(venueInfo?.modelFile), [venueInfo?.modelFile]);
  const orbitControlsRef = useRef(null);
  const wrapperRef = useRef(null);

  const handleVenueBoundsCalculated = useCallback((bounds) => {
    // Add a small margin to allow some flexibility, but keep elements within venue
    const margin = 0.5; // Small margin in units
    setVenueBounds({
      minX: bounds.minX + margin,
      maxX: bounds.maxX - margin,
      minY: bounds.minY,
      maxY: bounds.maxY,
      minZ: bounds.minZ + margin,
      maxZ: bounds.maxZ - margin,
    });
  }, []);

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

  const handleViewModeChange = useCallback(
    (mode) => {
      if (mode === viewMode) return;
      if (mode === 'orbit') {
        exitPointerLockIfNeeded();
        setPointerLocked(false);
      } else {
        handleCloseSelection();
      }
      setViewMode(mode);
    },
    [handleCloseSelection, viewMode]
  );

  useEffect(() => {
    const handleGlobalPointerDown = (event) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target)) {
        handleCloseSelection();
      }
    };
    document.addEventListener('pointerdown', handleGlobalPointerDown, true);
    return () => document.removeEventListener('pointerdown', handleGlobalPointerDown, true);
  }, [handleCloseSelection]);

  const isProjectMode = designerMode === 'project';
  const handleSaveClick = useCallback(() => {
    onSaveDesign?.();
  }, [onSaveDesign]);

  const handleSummaryClick = useCallback(() => {
    onOpenSummary?.();
  }, [onOpenSummary]);

  const handleCheckoutClick = useCallback(() => {
    onProceedCheckout?.();
  }, [onProceedCheckout]);

  return (
    <div className="scene3d-wrapper" ref={wrapperRef}>
      <div className="scene3d-floating-actions">
        <button
          type="button"
          className="scene3d-fab scene3d-fab-primary"
          onClick={handleSaveClick}
          disabled={savingState?.loading}
        >
          <i className="fas fa-save" />
          {savingState?.loading ? 'Saving…' : 'Save design'}
        </button>
        {isProjectMode && (
          <>
            <button type="button" className="scene3d-fab" onClick={handleSummaryClick}>
              Summary
            </button>
            <button type="button" className="scene3d-fab scene3d-fab-accent" onClick={handleCheckoutClick}>
              Checkout
            </button>
          </>
        )}
      </div>
      <div className="scene3d-toolbar">
        {isProjectMode && budgetData && (
          <BudgetTracker
            total={budgetData.total}
            planned={budgetData.planned}
            remaining={budgetData.remaining}
            progress={budgetData.progress}
          />
        )}
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
      <div className="scene3d-view-mode-controls">
        <button
          type="button"
          className={`scene3d-view-mode-btn ${viewMode === 'orbit' ? 'active' : ''}`}
          onClick={() => handleViewModeChange('orbit')}
          title="Orbit view"
        >
          <i className="fas fa-satellite-dish"></i>
        </button>
        <button
          type="button"
          className={`scene3d-view-mode-btn ${viewMode === 'walk' ? 'active' : ''}`}
          onClick={() => handleViewModeChange('walk')}
          title="Walk view"
        >
          <i className="fas fa-walking"></i>
        </button>
      </div>
      <div className="scene3d-meta">
        <span>Wedding Venue Space</span>
        {savingState?.lastSaved && (
          <span className="scene3d-meta-muted">
            Last saved {new Date(savingState.lastSaved).toLocaleTimeString()}
          </span>
        )}
      </div>
      {viewMode === 'walk' && !pointerLocked && (
        <div className="scene3d-hint">
          Click inside the scene to look around. Press Esc to exit walk mode.
        </div>
      )}

      <Canvas
        shadows
        camera={{ position: [14, 16, 18], fov: 42, near: 0.1, far: 500 }}
        dpr={[1, 2]}
        onPointerMissed={handleCanvasPointerMiss}
      >
        <CaptureBridge onRegisterCapture={onRegisterCapture} controlsRef={orbitControlsRef} />
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
            <VenueModel modelUrl={venueModelUrl} onBoundsCalculated={handleVenueBoundsCalculated} />
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
              venueBounds={venueBounds}
            />
          ))}
        </Suspense>

        <Environment preset="sunset" />

        <WASDControls mode={viewMode} venueBounds={venueBounds} />

        {viewMode === 'orbit' && (
          <OrbitControls
            ref={orbitControlsRef}
            makeDefault
            enabled={orbitEnabled}
            enableDamping
            dampingFactor={0.08}
            minDistance={6}
            maxDistance={45}
            minPolarAngle={0.05}
            maxPolarAngle={Math.PI / 2.05}
            target={[0, 2, 0]}
          />
        )}

        {viewMode === 'walk' && (
          <PointerLockControls
            makeDefault
            onLock={() => setPointerLocked(true)}
            onUnlock={() => {
              setPointerLocked(false);
              setViewMode('orbit');
            }}
          />
        )}
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

Scene3D.propTypes = {
  designerMode: PropTypes.oneOf(['package', 'project']),
  onSaveDesign: PropTypes.func,
  onOpenSummary: PropTypes.func,
  onProceedCheckout: PropTypes.func,
  onRegisterCapture: PropTypes.func,
  budgetData: PropTypes.shape({
    total: PropTypes.number,
    planned: PropTypes.number,
    remaining: PropTypes.number,
    progress: PropTypes.number,
  }),
};

Scene3D.defaultProps = {
  designerMode: 'project',
  onSaveDesign: undefined,
  onOpenSummary: undefined,
  onProceedCheckout: undefined,
  onRegisterCapture: undefined,
};

export default Scene3D;


