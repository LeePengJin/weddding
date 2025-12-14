import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, PointerLockControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { Tooltip } from '@mui/material';
import PlacedElement from './PlacedElement';
import { useVenueDesigner } from './VenueDesignerContext';
import { useWASDControls } from './useWASDControls';
import BudgetTracker from '../../components/BudgetTracker/BudgetTracker';
import TableTaggingModal from '../../components/TableTaggingModal/TableTaggingModal';
import HelpModal from '../../components/HelpModal/HelpModal';
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

const FIRST_PERSON_HEIGHT = 1.7;

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
        color="#f3f4f6"
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

const SceneRefsBridge = ({ cameraRef, sizeRef, glRef }) => {
  const { camera, size, gl } = useThree();
  useEffect(() => {
    cameraRef.current = camera;
    sizeRef.current = size;
    glRef.current = gl;
  }, [camera, size, gl, cameraRef, sizeRef, glRef]);
  return null;
};

SceneRefsBridge.propTypes = {
  cameraRef: PropTypes.shape({ current: PropTypes.object }).isRequired,
  sizeRef: PropTypes.shape({ current: PropTypes.object }).isRequired,
  glRef: PropTypes.shape({ current: PropTypes.object }).isRequired,
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
      if (controls && controls.target && prevTarget) {
        controls.target.copy(framingTarget);
        if (typeof controls.update === 'function') {
          controls.update();
        }
      }

      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL('image/jpeg', 0.92);

      camera.position.copy(prevPosition);
      camera.quaternion.copy(prevQuaternion);
      if (controls && controls.target && prevTarget) {
        controls.target.copy(prevTarget);
        if (typeof controls.update === 'function') {
          controls.update();
        }
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
    onDuplicatePlacement,
    onDuplicateMultiple,
    onDeleteMultiple,
    onLockMultiple,
    venueInfo,
    venueDesignId,
    projectId,
    onReloadDesign,
    sceneOptions = {},
  } = useVenueDesigner();

  const [selectedIds, setSelectedIds] = useState([]); // Changed from selectedId to selectedIds array
  const selectedIdsRef = useRef([]); // Always keep current selectedIds in a ref to avoid stale closures
  
  // Keep ref in sync with state
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);
  
  const [groupInteractionMode, setGroupInteractionMode] = useState('translate'); // Track active mode for group toolbar
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [viewMode, setViewMode] = useState('orbit'); // 'orbit' | 'walk'
  const [pointerLocked, setPointerLocked] = useState(false);
  const [venueBounds, setVenueBounds] = useState(null);
  const [taggingModalPlacement, setTaggingModalPlacement] = useState(null);
  const [boxSelectionStart, setBoxSelectionStart] = useState(null); // For box selection
  const [boxSelectionEnd, setBoxSelectionEnd] = useState(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isShiftDown, setIsShiftDown] = useState(false);
  const selectedElementRefs = useRef(new Map()); // Store refs to selected elements for real-time updates
  const selectedInitialPositionsRef = useRef(new Map()); // Store initial positions for multi-selection
  const currentDragSessionRef = useRef(null); // Track current drag session: { draggedId, selectedIds: Set, initialPositions: Map }
  const venueModelUrl = useMemo(() => normalizeUrl(venueInfo?.modelFile), [venueInfo?.modelFile]);
  const orbitControlsRef = useRef(null);
  const wrapperRef = useRef(null);
  const cameraRef = useRef(null);
  const sizeRef = useRef(null);
  const glRef = useRef(null);

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
    selectedIdsRef.current = [];
    setSelectedIds([]);
    // Clear all drag state when selection is cleared
    selectedInitialPositionsRef.current.clear();
    currentDragSessionRef.current = null;
    setGroupInteractionMode('translate');
  }, []);

  const handleOpenTaggingModal = useCallback((placement) => {
    setTaggingModalPlacement(placement);
  }, []);

  const handleCloseTaggingModal = useCallback(() => {
    setTaggingModalPlacement(null);
  }, []);

  const handleTagUpdate = useCallback(async (placementId) => {
    if (onReloadDesign) {
      await onReloadDesign();
    }
  }, [onReloadDesign]);

  // Update the placement object when placements change (after reload)
  // This ensures the modal shows the correct checked state when reopened
  useEffect(() => {
    if (taggingModalPlacement?.id) {
      const updatedPlacement = placements.find(p => p.id === taggingModalPlacement.id);
      if (updatedPlacement && updatedPlacement.serviceListingIds !== taggingModalPlacement.serviceListingIds) {
        setTaggingModalPlacement(updatedPlacement);
      }
    }
  }, [placements, taggingModalPlacement]);

  const handleSelect = useCallback((placementId, isShiftKey = false) => {
    if (isShiftKey) {
      // Toggle selection: add if not selected, remove if already selected
      setSelectedIds((prev) => {
        const newSelection = prev.includes(placementId)
          ? prev.filter((id) => id !== placementId)
          : [...prev, placementId];
        // Update ref immediately
        selectedIdsRef.current = newSelection;
        // Clear all drag state when selection changes
        selectedInitialPositionsRef.current.clear();
        currentDragSessionRef.current = null;
        // Reset to default move mode when selection changes
        if (newSelection.length > 1) {
          setGroupInteractionMode('translate');
        }
        return newSelection;
      });
    } else {
      // Single selection: replace current selection
      const newSelection = [placementId];
      selectedIdsRef.current = newSelection;
      setSelectedIds(newSelection);
      // Clear all drag state when selection changes
      selectedInitialPositionsRef.current.clear();
      currentDragSessionRef.current = null;
      setGroupInteractionMode('translate');
    }
  }, []);

  const handleCanvasPointerMiss = useCallback((event) => {
    // Only clear selection if not starting box selection
    if (!event.shiftKey) {
    handleCloseSelection();
    }
  }, [handleCloseSelection]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Shift') setIsShiftDown(true);
    };
    const handleKeyUp = (e) => {
      if (e.key === 'Shift') setIsShiftDown(false);
    };
    const handleBlur = () => setIsShiftDown(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Box selection handlers
  const handleCanvasPointerDown = useCallback((event) => {
    // Start box selection if Shift is held and clicking on empty space
    if (event.shiftKey && event.button === 0) {
      const rect = event.target.getBoundingClientRect();
      setBoxSelectionStart({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      setBoxSelectionEnd(null);
    }
  }, []);

  const handleCanvasPointerMove = useCallback((event) => {
    if (boxSelectionStart && event.shiftKey) {
      const rect = event.target.getBoundingClientRect();
      setBoxSelectionEnd({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
  }, [boxSelectionStart]);

  const handleCanvasPointerUp = useCallback((event) => {
    if (boxSelectionStart && boxSelectionEnd) {
      // Calculate selection rectangle
      const rect = event.target.getBoundingClientRect();
      const startX = Math.min(boxSelectionStart.x, boxSelectionEnd.x);
      const endX = Math.max(boxSelectionStart.x, boxSelectionEnd.x);
      const startY = Math.min(boxSelectionStart.y, boxSelectionEnd.y);
      const endY = Math.max(boxSelectionStart.y, boxSelectionEnd.y);

      const camera = cameraRef.current;
      if (camera) {
        const foundIds = [];
        const v = new THREE.Vector3();

        placements.forEach((placement) => {
          if (!placement?.id || !placement?.position) return;
          v.set(placement.position.x || 0, placement.position.y || 0, placement.position.z || 0);
          v.project(camera);
          const sx = ((v.x + 1) / 2) * rect.width;
          const sy = ((-v.y + 1) / 2) * rect.height;
          if (sx >= startX && sx <= endX && sy >= startY && sy <= endY) {
            foundIds.push(placement.id);
          }
        });

        if (foundIds.length > 0) {
          setSelectedIds((prev) => {
            const merged = new Set([...(prev || []), ...foundIds]);
            const next = Array.from(merged);
            selectedIdsRef.current = next;
            selectedInitialPositionsRef.current.clear();
            currentDragSessionRef.current = null;
            if (next.length > 1) {
              setGroupInteractionMode('translate');
            }
            return next;
          });
        }
      }
      
      setBoxSelectionStart(null);
      setBoxSelectionEnd(null);
    } else if (boxSelectionStart) {
      // Click without drag - cancel box selection
      setBoxSelectionStart(null);
      setBoxSelectionEnd(null);
    }
  }, [boxSelectionStart, boxSelectionEnd, placements]);

  const handleDeletePlacement = useCallback(
    (placementId) => {
      if (!placementId || sceneOptions.allowRemoval === false) return;
      if (onRemovePlacement) {
        onRemovePlacement(placementId);
      } else if (onUpdatePlacement) {
        onUpdatePlacement(placementId, { remove: true });
      }
      // Remove from selection if it was selected
      setSelectedIds((prev) => prev.filter((id) => id !== placementId));
    },
    [onRemovePlacement, onUpdatePlacement, sceneOptions.allowRemoval]
  );

  const handleDuplicatePlacement = useCallback(
    async (placementId) => {
      if (onDuplicatePlacement) {
        await onDuplicatePlacement(placementId);
      }
    },
    [onDuplicatePlacement]
  );

  const handleTogglePlacementLock = useCallback(
    (placement) => {
      onToggleLock?.(placement);
    },
    [onToggleLock]
  );

  // Initialize drag session - store all initial positions synchronously
  // This is called directly from PlacedElement on pointer down
  const initializeDragSession = useCallback((draggedId, draggedInitialPos) => {
    // Always use the current selectedIds from ref (always up-to-date)
    const currentSelectedIds = selectedIdsRef.current.filter((id) => 
      placements.some((p) => p.id === id)
    );
    
    if (currentSelectedIds.length === 0 || !currentSelectedIds.includes(draggedId)) {
      return null;
    }
    
    const sessionSelectedIds = new Set(currentSelectedIds);
    const initialPositions = new Map();
    
    // Store the dragged element's initial position (passed from PlacedElement)
    if (draggedInitialPos) {
      initialPositions.set(draggedId, {
        x: draggedInitialPos.x,
        y: draggedInitialPos.y,
        z: draggedInitialPos.z,
      });
    }
    
    // Store initial positions for ALL other selected elements immediately from refs
    currentSelectedIds.forEach((id) => {
      if (id === draggedId) return; // Already stored above
      
      const elementRef = selectedElementRefs.current.get(id);
      if (elementRef && elementRef.groupRef && elementRef.groupRef.current) {
        const pos = elementRef.groupRef.current.position;
        initialPositions.set(id, {
          x: pos.x,
          y: pos.y,
          z: pos.z,
        });
      }
    });
    
    // Store drag session
    currentDragSessionRef.current = {
      draggedId,
      selectedIds: sessionSelectedIds,
      initialPositions,
      timestamp: Date.now(), // Add timestamp to track session freshness
    };
    
    // Also store in the old ref for backward compatibility
    initialPositions.forEach((pos, id) => {
      selectedInitialPositionsRef.current.set(id, pos);
    });
    
    return initialPositions.get(draggedId);
  }, [placements]);
  
  // Expose initialization function directly to PlacedElement
  const handleInitializeDragSession = useCallback((draggedId, draggedInitialPos) => {
    return initializeDragSession(draggedId, draggedInitialPos);
  }, [initializeDragSession]);
  
  // Real-time update for multi-selection during drag
  const handleUpdateOtherSelected = useCallback(
    (draggedId, positionOffset, selectedIdsParam, rotationDelta = null, initialPosition = null) => {
      const draggedRef = selectedElementRefs.current.get(draggedId);
      if (!draggedRef || !draggedRef.groupRef || !draggedRef.groupRef.current) return;
      
      const draggedGroupRef = draggedRef.groupRef.current;
      const draggedPlacement = placements.find((p) => p.id === draggedId);
      
      // Get current selectedIds from ref (always use latest, no stale closure)
      const currentSelectedIds = selectedIdsRef.current.filter((id) => 
        placements.some((p) => p.id === id)
      );
      
      // Check if selectedIdsParam contains child IDs (for parent-child relationships)
      // If selectedIdsParam is provided and contains IDs not in currentSelectedIds, they might be children
      const isParentChildUpdate = selectedIdsParam && 
        Array.isArray(selectedIdsParam) && 
        selectedIdsParam.some(id => !currentSelectedIds.includes(id));
      
      // Get drag session - should already be initialized in handlePointerDown
      let dragSession = currentDragSessionRef.current;
      
      // Check if we have a valid drag session
      const hasValidSession = dragSession && 
          dragSession.draggedId === draggedId && 
          currentSelectedIds.every(id => dragSession.selectedIds.has(id)) &&
          dragSession.selectedIds.size === currentSelectedIds.length;
      
      if (!hasValidSession) {
        // Session not initialized or invalid - try to initialize now (fallback)
        if (initialPosition) {
          const draggedInitialPos = initializeDragSession(draggedId, {
            x: initialPosition.x,
            y: initialPosition.y,
            z: initialPosition.z,
          });
          dragSession = currentDragSessionRef.current;
        }
        
        if (!dragSession) {
          return; // Failed to initialize
        }
      }
      
      // Use positions from drag session
      const sessionSelectedIds = dragSession.selectedIds;
      const sessionInitialPositions = dragSession.initialPositions;
      const draggedInitialPos = sessionInitialPositions.get(draggedId);
      
      // Initialize initialRotations map if it doesn't exist
      if (!dragSession.initialRotations) {
        dragSession.initialRotations = new Map();
      }
      
      if (!draggedInitialPos) {
        return;
      }
      
      // For parent-child updates, use selectedIdsParam directly (contains child IDs)
      // For multi-selection, use sessionSelectedIds
      const idsToUpdate = isParentChildUpdate && selectedIdsParam
        ? selectedIdsParam
        : Array.from(sessionSelectedIds);
      
      // Update elements (either selected elements or children)
      // For parent-child updates, skip the first loop and handle in the dedicated section below
      // For multi-selection, update in this loop
      if (!isParentChildUpdate) {
        idsToUpdate.forEach((id) => {
          if (id === draggedId) return; // Skip the dragged element itself
          
          // For multi-selection, only update if still in current selection
          if (!currentSelectedIds.includes(id)) {
            return; // This element is no longer selected, skip it
          }
          
          // Get initial position from session
          const otherInitialPos = sessionInitialPositions.get(id);
          if (!otherInitialPos) {
            console.warn('No initial position for element', id);
            return;
          }
          
          const elementRef = selectedElementRefs.current.get(id);
          if (!elementRef || !elementRef.groupRef || !elementRef.groupRef.current) return;
          
          const groupRef = elementRef.groupRef.current;
          
          if (positionOffset) {
            // Calculate relative position from dragged element's initial position
            const relativeX = otherInitialPos.x - draggedInitialPos.x;
            const relativeY = otherInitialPos.y - draggedInitialPos.y;
            const relativeZ = otherInitialPos.z - draggedInitialPos.z;
            
            // Apply dragged element's current position + relative offset
            const draggedCurrentPos = {
              x: draggedInitialPos.x + positionOffset.x,
              y: draggedInitialPos.y + positionOffset.y,
              z: draggedInitialPos.z + positionOffset.z,
            };
            
            groupRef.position.set(
              draggedCurrentPos.x + relativeX,
              draggedCurrentPos.y + relativeY,
              draggedCurrentPos.z + relativeZ
            );
          }
          
          if (rotationDelta !== null) {
            // Only change rotation, don't change position
            // All elements rotate in place by the same amount
            groupRef.rotation.y += rotationDelta;
          }
        });
      }
      
      // Update children of dragged element (parent-child relationship)
      // Check both: 1) draggedPlacement.parentElementId === null (saved parent), 
      // 2) selectedIdsParam contains child IDs (children passed explicitly from PlacedElement)
      const isParent = draggedPlacement && draggedPlacement.parentElementId === null;
      const hasExplicitChildren = isParentChildUpdate && selectedIdsParam && Array.isArray(selectedIdsParam);
      
      // Find children: either from database (parentElementId === draggedId) or from explicit list
      let children = placements.filter((p) => p.parentElementId === draggedId);
      
      // If explicit child IDs were provided, also include those (in case parentElementId not saved yet)
      if (hasExplicitChildren) {
        const explicitChildren = placements.filter((p) => selectedIdsParam.includes(p.id));
        // Merge and deduplicate
        const childIds = new Set([...children.map(c => c.id), ...explicitChildren.map(c => c.id)]);
        children = placements.filter((p) => childIds.has(p.id));
      }
      
      // Update children if: (parent is being dragged OR explicit children provided) AND has children AND has movement
      if ((isParent || hasExplicitChildren) && children.length > 0 && (positionOffset || rotationDelta !== null)) {
        console.log('[Parent-Child] Updating children:', {
          draggedId,
          isParent,
          hasExplicitChildren,
          childrenCount: children.length,
          childIds: children.map(c => c.id),
          hasPositionOffset: !!positionOffset,
          hasRotationDelta: rotationDelta !== null
        });
        
        // Note: We don't pre-capture children's positions here anymore
        // Instead, we capture them on-demand in the rotation logic below
        // This ensures we always use the child's current visual position
        
        children.forEach((child) => {
          const childRef = selectedElementRefs.current.get(child.id);
          if (!childRef || !childRef.groupRef || !childRef.groupRef.current) {
            // If child ref not found, skip - will be updated on commit
            console.warn('[Parent-Child] Child ref not found for:', child.id);
            return;
          }
          
          const childGroupRef = childRef.groupRef.current;
          const childPos = child.position || { x: 0, y: 0, z: 0 };
          
          // Use the dragged element's current visual position (from groupRef)
          const parentCurrentPos = draggedGroupRef.position;
          
          // Get parent's initial position from drag session or use placement position as fallback
          const parentInitialPos = initialPosition || 
            (sessionInitialPositions.get(draggedId)) || 
            (draggedPlacement.position || { x: 0, y: 0, z: 0 });
          
          if (positionOffset) {
            // Calculate relative position from parent's original position
            const relativeX = childPos.x - parentInitialPos.x;
            const relativeZ = childPos.z - parentInitialPos.z;
            const relativeY = childPos.y - parentInitialPos.y;
            
            // Apply parent's new visual position + relative offset
            childGroupRef.position.set(
              parentCurrentPos.x + relativeX,
              parentCurrentPos.y + relativeY,
              parentCurrentPos.z + relativeZ
            );
            
            console.log('[Parent-Child] Updated child position:', {
              childId: child.id,
              childPos: { x: childPos.x, y: childPos.y, z: childPos.z },
              parentInitialPos,
              parentCurrentPos: { x: parentCurrentPos.x, y: parentCurrentPos.y, z: parentCurrentPos.z },
              relativeOffset: { x: relativeX, y: relativeY, z: relativeZ },
              newChildPos: {
                x: parentCurrentPos.x + relativeX,
                y: parentCurrentPos.y + relativeY,
                z: parentCurrentPos.z + relativeZ
              }
            });
          }
          
          if (rotationDelta !== null) {
            // Rotate child around parent's initial center
            // Get the child's initial position from session (where it was when rotation started)
            // If not in session yet, use the child's current visual position (capture it now)
            let childInitialPos = sessionInitialPositions.get(child.id);
            if (!childInitialPos) {
              // Capture current visual position as initial position
              const currentPos = childGroupRef.position;
              childInitialPos = {
                x: currentPos.x,
                y: currentPos.y,
                z: currentPos.z
              };
              sessionInitialPositions.set(child.id, childInitialPos);
              
              // Also capture parent's initial rotation if not already stored
              if (!dragSession.initialRotations) {
                dragSession.initialRotations = new Map();
              }
              const parentInitialRotation = draggedGroupRef.rotation.y;
              dragSession.initialRotations.set(draggedId, parentInitialRotation);
              
              console.log('[Parent-Child] Captured child initial position on first rotation:', {
                childId: child.id,
                initialPos: childInitialPos,
                parentInitialRotation
              });
            }
            
            // Get parent's initial rotation from session
            const parentInitialRotation = dragSession.initialRotations?.get(draggedId) ?? draggedPlacement.rotation ?? 0;
            // Get parent's current rotation
            const parentCurrentRotation = draggedGroupRef.rotation.y;
            // Calculate total rotation from start (in radians)
            // Negate to match the parent's rotation direction
            const totalRotationDelta = -(parentCurrentRotation - parentInitialRotation);
            
            // Calculate relative position from parent's initial position
            // This is the position where the child is on the parent (like "at 12 o'clock")
            const relativeX = childInitialPos.x - parentInitialPos.x;
            const relativeZ = childInitialPos.z - parentInitialPos.z;
            
            // Rotate the relative position by the total rotation
            const cos = Math.cos(totalRotationDelta);
            const sin = Math.sin(totalRotationDelta);
            const rotatedX = relativeX * cos - relativeZ * sin;
            const rotatedZ = relativeX * sin + relativeZ * cos;
            
            // Apply rotation to child position
            // Rotate the child's position around the parent's center
            childGroupRef.position.set(
              parentCurrentPos.x + rotatedX,
              childInitialPos.y, // Keep Y from initial position (relative to parent)
              parentCurrentPos.z + rotatedZ
            );
            // Note: We do NOT rotate the child's orientation - it should maintain its original direction
            // The child's position orbits around the parent, but the child itself doesn't rotate
            
            console.log('[Parent-Child] Rotated child position:', {
              childId: child.id,
              incrementalRotationDelta: rotationDelta,
              totalRotationDelta,
              parentInitialRotation,
              parentCurrentRotation,
              childInitialPos,
              parentInitialPos,
              parentCurrentPos,
              relativePos: { x: relativeX, z: relativeZ },
              rotatedPos: { x: rotatedX, z: rotatedZ },
              newWorldPos: {
                x: parentCurrentPos.x + rotatedX,
                y: childInitialPos.y,
                z: parentCurrentPos.z + rotatedZ
              }
            });
          }
        });
      }
    },
    [placements, initializeDragSession]
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
      if (nextState.parentElementId !== undefined) {
        payload.parentElementId = nextState.parentElementId;
      }
      if (Object.keys(payload).length === 0) return;
      
      // Clear drag session after commit
      selectedInitialPositionsRef.current.clear();
      currentDragSessionRef.current = null;
      
      try {
        const draggedPlacement = placements.find((p) => p.id === placementId);
        if (!draggedPlacement) return;

        // Calculate offset for multi-selection movement
        const isMultiSelect = selectedIds.length > 1 && selectedIds.includes(placementId);
        let positionOffset = null;
        let rotationOffset = null;
        
        if (isMultiSelect && nextState.position) {
          const oldPos = draggedPlacement.position || { x: 0, y: 0, z: 0 };
          positionOffset = {
            x: nextState.position.x - oldPos.x,
            y: nextState.position.y - oldPos.y,
            z: nextState.position.z - oldPos.z,
          };
        }
        
        if (isMultiSelect && typeof nextState.rotation === 'number' && draggedPlacement.rotation !== undefined) {
          rotationOffset = nextState.rotation - draggedPlacement.rotation;
        }

        // Update the dragged element
        await onUpdatePlacement?.(placementId, payload);

        // Update all other selected elements (multi-selection movement)
        if (isMultiSelect) {
          const otherSelected = placements.filter(
            (p) => selectedIds.includes(p.id) && p.id !== placementId && !p.isLocked
          );
          
          for (const other of otherSelected) {
            const otherPayload = {};
            
            if (positionOffset) {
              const otherPos = other.position || { x: 0, y: 0, z: 0 };
              otherPayload.position = {
                x: otherPos.x + positionOffset.x,
                y: otherPos.y + positionOffset.y,
                z: otherPos.z + positionOffset.z,
              };
            }
            
            if (rotationOffset !== null && other.rotation !== undefined) {
              otherPayload.rotation = (other.rotation || 0) + rotationOffset;
            }
            
            if (Object.keys(otherPayload).length > 0) {
              await onUpdatePlacement?.(other.id, otherPayload);
            }
          }
        }

        // If this element has children, update their positions/rotations (parent-child relationship)
        // Only update if this element is a parent (not a child itself)
        // Update children when parent moves OR rotates
        if (draggedPlacement && draggedPlacement.parentElementId === null && (nextState.position || typeof nextState.rotation === 'number')) {
          // Find all child elements (children that have this element as parent)
          const children = placements.filter((p) => p.parentElementId === placementId);
          
          if (children.length > 0) {
            // Get the current visual position from the element ref if available
            const draggedRef = selectedElementRefs.current.get(placementId);
            const parentVisualPos = draggedRef?.groupRef?.current?.position 
              ? { 
                  x: draggedRef.groupRef.current.position.x,
                  y: draggedRef.groupRef.current.position.y,
                  z: draggedRef.groupRef.current.position.z,
                }
              : (nextState.position || draggedPlacement.position || { x: 0, y: 0, z: 0 });
            
            for (const child of children) {
              // Get child's current visual position if available (already updated in real-time)
              const childRef = selectedElementRefs.current.get(child.id);
              const childVisualPos = childRef?.groupRef?.current?.position
                ? {
                    x: childRef.groupRef.current.position.x,
                    y: childRef.groupRef.current.position.y,
                    z: childRef.groupRef.current.position.z,
                  }
                : (child.position || { x: 0, y: 0, z: 0 });
              
              // Use the child's current visual position directly - it's already correctly positioned
              // from the real-time updates during drag/rotation
              // Do NOT recalculate or re-rotate - just save what's already there
              // Also, do NOT change the child's rotation - it should maintain its original orientation
              await onUpdatePlacement?.(child.id, {
                position: {
                  x: Number(childVisualPos.x.toFixed(3)),
                  y: Number(childVisualPos.y.toFixed(3)),
                  z: Number(childVisualPos.z.toFixed(3)),
                },
                // Don't change child's rotation - it should maintain its original orientation
              });
            }
          }
        }
      } catch (err) {
        // Errors already handled upstream, no-op to keep interaction smooth
      }
    },
    [onUpdatePlacement, placements, selectedIds]
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

  const selectedPlacements = useMemo(() => {
    return placements.filter((placement) => selectedIds.includes(placement.id));
  }, [placements, selectedIds]);
  const selectedPlacement = selectedPlacements.length === 1 ? selectedPlacements[0] : null; // For backward compatibility with single-selection UI

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

  const handleTopView = useCallback(() => {
    // Switch to orbit mode if not already
    if (viewMode !== 'orbit') {
      handleViewModeChange('orbit');
      // Wait a bit for mode to change before setting camera
      setTimeout(() => {
        if (orbitControlsRef.current) {
          const controls = orbitControlsRef.current;
          
          // Calculate center of venue bounds or use default
          const centerX = venueBounds ? (venueBounds.minX + venueBounds.maxX) / 2 : 0;
          const centerZ = venueBounds ? (venueBounds.minZ + venueBounds.maxZ) / 2 : 0;
          const centerY = venueBounds ? (venueBounds.minY + venueBounds.maxY) / 2 : 2;
          
          // Position camera high above, looking straight down
          const height = venueBounds ? Math.max(venueBounds.maxY - venueBounds.minY, 20) + 10 : 30;
          controls.object.position.set(centerX, centerY + height, centerZ);
          
          // Set target to center of venue
          controls.target.set(centerX, centerY, centerZ);
          
          // Update controls to apply the changes
          controls.update();
        }
      }, 100);
    } else {
      // Already in orbit mode, set camera immediately
      if (orbitControlsRef.current) {
        const controls = orbitControlsRef.current;
        
        // Calculate center of venue bounds or use default
        const centerX = venueBounds ? (venueBounds.minX + venueBounds.maxX) / 2 : 0;
        const centerZ = venueBounds ? (venueBounds.minZ + venueBounds.maxZ) / 2 : 0;
        const centerY = venueBounds ? (venueBounds.minY + venueBounds.maxY) / 2 : 2;
        
        // Position camera high above, looking straight down
        const height = venueBounds ? Math.max(venueBounds.maxY - venueBounds.minY, 20) + 10 : 30;
        controls.object.position.set(centerX, centerY + height, centerZ);
        
        // Set target to center of venue
        controls.target.set(centerX, centerY, centerZ);
        
        // Update controls to apply the changes
        controls.update();
      }
    }
  }, [viewMode, handleViewModeChange, venueBounds]);

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
  const isBoxSelecting = Boolean(boxSelectionStart);
  const orbitControlsEnabled = orbitEnabled && !isShiftDown && !isBoxSelecting;
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
      {boxSelectionStart && boxSelectionEnd && (
        <div
          className="scene3d-selection-rect"
          style={{
            left: Math.min(boxSelectionStart.x, boxSelectionEnd.x),
            top: Math.min(boxSelectionStart.y, boxSelectionEnd.y),
            width: Math.abs(boxSelectionEnd.x - boxSelectionStart.x),
            height: Math.abs(boxSelectionEnd.y - boxSelectionStart.y),
          }}
        />
      )}
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
            actual={budgetData.actual}
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
        <Tooltip title="Help - How to use 3D Venue Design">
          <button
            type="button"
            className="scene3d-view-mode-btn"
            onClick={() => setShowHelpModal(true)}
          >
            <i className="fas fa-info-circle"></i>
          </button>
        </Tooltip>
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
        <button
          type="button"
          className="scene3d-view-mode-btn"
          onClick={handleTopView}
          title="Top view (2D)"
        >
          <i className="fas fa-map"></i>
        </button>
      </div>
      
      {/* Group actions toolbar - middle bottom */}
      {selectedIds.length > 1 && (
        <div 
          className="scene3d-group-actions-bottom" 
          style={{ 
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
            padding: '10px 16px',
            borderRadius: '50px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}
        >
          <span style={{ 
            marginRight: '12px', 
            fontSize: '14px', 
            fontWeight: 500, 
            color: 'rgba(255, 255, 255, 0.9)'
          }}>
            {selectedIds.length} selected
          </span>
          <button
            type="button"
            className={`scene3d-view-mode-btn ${groupInteractionMode === 'rotate' ? 'active' : ''}`}
            onClick={() => {
              setGroupInteractionMode('rotate');
              // Set rotate mode for all selected elements
              selectedPlacements.forEach((p) => {
                const elementRef = selectedElementRefs.current.get(p.id);
                if (elementRef && elementRef.setInteractionMode) {
                  elementRef.setInteractionMode('rotate');
                }
              });
            }}
            title="Rotate selected"
          >
            <i className="fas fa-redo"></i>
          </button>
          <button
            type="button"
            className={`scene3d-view-mode-btn ${groupInteractionMode === 'translate' ? 'active' : ''}`}
            onClick={() => {
              setGroupInteractionMode('translate');
              // Set move mode for all selected elements
              selectedPlacements.forEach((p) => {
                const elementRef = selectedElementRefs.current.get(p.id);
                if (elementRef && elementRef.setInteractionMode) {
                  elementRef.setInteractionMode('translate');
                }
              });
            }}
            title="Move selected"
          >
            <i className="fas fa-arrows-alt"></i>
          </button>
          <button
            type="button"
            className="scene3d-view-mode-btn"
            onClick={() => {
              const allLocked = selectedPlacements.every((p) => p.isLocked);
              onLockMultiple?.(selectedIds, !allLocked);
            }}
            title={selectedPlacements.every((p) => p.isLocked) ? 'Unlock selected' : 'Lock selected'}
          >
            <i className={`fas fa-${selectedPlacements.every((p) => p.isLocked) ? 'unlock' : 'lock'}`}></i>
          </button>
          <button
            type="button"
            className="scene3d-view-mode-btn"
            onClick={() => {
              if (onDuplicateMultiple) {
                onDuplicateMultiple(selectedIds);
              }
            }}
            title="Duplicate selected"
          >
            <i className="fas fa-copy"></i>
          </button>
          <button
            type="button"
            className="scene3d-view-mode-btn"
            onClick={handleCloseSelection}
            title="Clear selection"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}
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
        camera={{ position: [14, 22, 18], fov: 42, near: 0.1, far: 500 }}
        dpr={[1, 2]}
        onPointerMissed={handleCanvasPointerMiss}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
      >
        <SceneRefsBridge cameraRef={cameraRef} sizeRef={sizeRef} glRef={glRef} />
        <CaptureBridge onRegisterCapture={onRegisterCapture} controlsRef={orbitControlsRef} />
        <color attach="background" args={['#cbd2de']} />
        <fog attach="fog" args={['#efe9e4', 60, 220]} />
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[18, 30, 20]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-camera-left={-110}
          shadow-camera-right={110}
          shadow-camera-top={110}
          shadow-camera-bottom={-110}
          shadow-camera-near={0.1}
          shadow-camera-far={200}
          shadow-bias={-0.0005}
          shadow-normalBias={0.04}
          shadow-radius={2}
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

        {/* ContactShadows positioned very low to prevent overlay on elements */}
        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={0.08}
          width={200}
          height={200}
          blur={4}
          far={50}
          scale={1.2}
        />

        <Suspense fallback={null}>
          {placements.map((placement) => (
              <PlacedElement
                key={placement.id}
                placement={placement}
                isSelected={selectedIds.includes(placement.id)}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                availability={availabilityMap[placement.metadata?.serviceListingId]}
                snapIncrement={effectiveGrid.snapToGrid ? effectiveGrid.size || 1 : null}
                onOrbitToggle={setOrbitEnabled}
                onTransformCommit={handleTransformCommit}
                allPlacements={placements}
                removable={true}
                onDelete={handleDeletePlacement}
                onDuplicate={onDuplicatePlacement ? handleDuplicatePlacement : undefined}
                onToggleLock={handleTogglePlacementLock}
                onShowDetails={sceneOptions.onShowDetails}
                onClose={handleCloseSelection}
                venueBounds={venueBounds}
                onOpenTaggingModal={handleOpenTaggingModal}
                onRegisterElementRef={(id, ref) => {
                  selectedElementRefs.current.set(id, ref);
                }}
                onUpdateOtherSelected={handleUpdateOtherSelected}
                onInitializeDragSession={handleInitializeDragSession}
              />
            ))}
        </Suspense>

        <Environment preset="sunset" />

        <WASDControls mode={viewMode} venueBounds={venueBounds} />

        {viewMode === 'orbit' && (
          <OrbitControls
            key="orbit-controls"
            ref={orbitControlsRef}
            makeDefault
            enabled={orbitControlsEnabled}
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
            key="pointer-lock-controls"
            makeDefault
            onLock={() => setPointerLocked(true)}
            onUnlock={() => {
              setPointerLocked(false);
              setViewMode('orbit');
            }}
          />
        )}
      </Canvas>

      {/* Table Tagging Modal - rendered outside Canvas to avoid R3F errors */}
      {taggingModalPlacement && venueDesignId && projectId && (
        <TableTaggingModal
          open={Boolean(taggingModalPlacement)}
          onClose={handleCloseTaggingModal}
          placement={taggingModalPlacement}
          venueDesignId={venueDesignId}
          projectId={projectId}
          onTagUpdate={handleTagUpdate}
        />
      )}

      {/* Help Modal */}
      <HelpModal open={showHelpModal} onClose={() => setShowHelpModal(false)} />
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


