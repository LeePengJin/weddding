import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Html, useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useVenueDesigner } from './VenueDesignerContext';

const PLACEHOLDER_COLOR = '#e5dcd2';
const HIGHLIGHT_COLOR = '#e76f93';
const UNAVAILABLE_COLOR = '#f87171';
const BOOKING_STATUS_COLORS = {
  pending_vendor_confirmation: '#fbbf24',
  pending_deposit_payment: '#fb923c',
  confirmed: '#34d399',
  pending_final_payment: '#60a5fa',
  completed: '#a3a3a3',
  cancelled_by_couple: '#ef4444',
  cancelled_by_vendor: '#ef4444',
  rejected: '#ef4444',
};

const degToRad = (deg = 0) => (deg * Math.PI) / 180;
const radToDeg = (rad = 0) => (rad * 180) / Math.PI;
const normalizeDegrees = (deg) => {
  const value = ((deg % 360) + 360) % 360;
  return Number(value.toFixed(2));
};

const parseDimensions = (dimensions) => {
  if (!dimensions) return null;
  const parsed = {};
  ['width', 'height', 'depth'].forEach((axis) => {
    const raw = dimensions[axis];
    if (raw === '' || raw === null || raw === undefined) return;
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) {
      parsed[axis] = value;
    }
  });
  return Object.keys(parsed).length ? parsed : null;
};

const GltfInstance = ({
  url,
  scaleMultiplier = 1,
  verticalOffset = 0,
  targetDimensions = null,
  outlineColor = null,
  outlineScale = 1.03,
}) => {
  const { scene } = useGLTF(url);
  const parsedTargetDimensions = useMemo(() => parseDimensions(targetDimensions), [targetDimensions]);

  const { base, outline } = useMemo(() => {
    if (!scene) return { base: null, outline: null };

    const computeScale = (size) => {
      const maxDim = Math.max(size.x, size.y, size.z);
      let scaleX = 1;
      let scaleY = 1;
      let scaleZ = 1;

      if (parsedTargetDimensions) {
        const ratioX =
          parsedTargetDimensions.width && size.x > 0 ? parsedTargetDimensions.width / size.x : null;
        const ratioY =
          parsedTargetDimensions.height && size.y > 0 ? parsedTargetDimensions.height / size.y : null;
        const ratioZ =
          parsedTargetDimensions.depth && size.z > 0 ? parsedTargetDimensions.depth / size.z : null;

        const ratios = [ratioX, ratioY, ratioZ].filter((value) => Number.isFinite(value));

        if (ratios.length === 1) {
          const uniformScale = ratios[0] || 1;
          scaleX = scaleY = scaleZ = uniformScale;
        } else if (ratios.length > 1) {
          scaleX = ratioX || ratios[0];
          scaleY = ratioY || ratios[0];
          scaleZ = ratioZ || ratios[0];
        } else if (maxDim > 0) {
          const fitScale = 2 / maxDim;
          scaleX = scaleY = scaleZ = fitScale;
        }
      } else if (maxDim > 0) {
        let normalization = 1;
        if (maxDim > 5) {
          normalization = 5 / maxDim;
        } else if (maxDim < 0.5) {
          normalization = 0.5 / maxDim;
        }
        scaleX = scaleY = scaleZ = normalization;
      }

      if (Number.isFinite(scaleMultiplier) && scaleMultiplier > 0) {
        scaleX *= scaleMultiplier;
        scaleY *= scaleMultiplier;
        scaleZ *= scaleMultiplier;
      }

      return { scaleX, scaleY, scaleZ };
    };

    const prepare = (copy, { forOutline = false } = {}) => {
      copy.traverse((child) => {
        if (child.isMesh && child.material) {
          child.castShadow = !forOutline;
          child.receiveShadow = !forOutline;

          if (forOutline) {
            child.material = new THREE.MeshBasicMaterial({
              color: outlineColor || '#ffffff',
              side: THREE.BackSide,
              transparent: true,
              opacity: 0.85,
              depthWrite: false,
            });
          } else {
            child.material = child.material.clone();
          }
        }
      });

      const bbox = new THREE.Box3().setFromObject(copy);
      const center = bbox.getCenter(new THREE.Vector3());
      copy.position.sub(center);

      const size = bbox.getSize(new THREE.Vector3());
      const { scaleX, scaleY, scaleZ } = computeScale(size);
      const bump = forOutline ? (Number.isFinite(outlineScale) ? outlineScale : 1.03) : 1;
      copy.scale.set(scaleX * bump, scaleY * bump, scaleZ * bump);

      const alignedBox = new THREE.Box3().setFromObject(copy);
      copy.position.y -= alignedBox.min.y;
      if (verticalOffset) {
        copy.position.y += verticalOffset;
      }

      return copy;
    };

    const baseCopy = prepare(scene.clone(true));
    const outlineCopy = outlineColor ? prepare(scene.clone(true), { forOutline: true }) : null;
    return { base: baseCopy, outline: outlineCopy };
  }, [scene, scaleMultiplier, verticalOffset, parsedTargetDimensions, outlineColor, outlineScale]);

  if (!base) {
    return null;
  }

  return (
    <group>
      {outline ? <primitive object={outline} /> : null}
      <primitive object={base} />
    </group>
  );
};

const ModelInstance = ({
  url,
  scaleMultiplier = 1,
  verticalOffset = 0,
  targetDimensions = null,
  outlineColor = null,
  outlineScale = 1.03,
}) => {
  const fullUrl = useMemo(() => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/uploads')) {
      return `http://localhost:4000${url}`;
    }
    return url;
  }, [url]);

  if (!fullUrl) {
    return (
      <group position={[0, 0.5, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.2, 1, 1.2]} />
          <meshStandardMaterial color={PLACEHOLDER_COLOR} />
        </mesh>
      </group>
    );
  }

  return (
    <GltfInstance
      url={fullUrl}
      scaleMultiplier={scaleMultiplier}
      verticalOffset={verticalOffset}
      targetDimensions={targetDimensions}
      outlineColor={outlineColor}
      outlineScale={outlineScale}
    />
  );
};

const COLLISION_RADIUS_DEFAULT = 0.4;

const getFootprintRadius = (placement) => {
  const metaRadius = parseFloat(placement.metadata?.footprintRadius);
  if (Number.isFinite(metaRadius) && metaRadius > 0) {
    return metaRadius;
  }
  const dims = placement.designElement?.dimensions;
  if (dims) {
    const width = Number(dims.width) || 0;
    const depth = Number(dims.depth) || 0;
    const derived = Math.max(width, depth) / 2;
    if (derived > 0) return derived;
  }
  return COLLISION_RADIUS_DEFAULT;
};

// Helper to determine if an object can be stacked on top of surfaces
const isStackable = (p) => {
  if (p.metadata?.isStackable !== undefined) {
    return Boolean(p.metadata.isStackable);
  }
  if (p.designElement?.isStackable !== undefined) {
    return Boolean(p.designElement.isStackable);
  }
  const name = p.designElement?.name?.toLowerCase() || '';
  // Assume these items are stackable
  if (name.includes('flower') || name.includes('vase') || name.includes('bouquet') || name.includes('centerpiece') || name.includes('plate') || name.includes('glass') || name.includes('candle')) {
    return true;
  }
  return false;
};

const PlacedElement = ({
  placement,
  isSelected,
  selectedIds = [],
  onSelect,
  availability,
  snapIncrement,
  onOrbitToggle,
  onTransformCommit,
  onDelete,
  onDuplicate,
  onToggleLock,
  onShowDetails,
  onClose,
  allPlacements = [],
  removable = false,
  venueBounds,
  onOpenTaggingModal,
  onRegisterElementRef,
  onUpdateOtherSelected,
  onInitializeDragSession,
  bookingHighlightEnabled = false,
  needsUpdateHighlightEnabled = false,
  needsUpdateServiceListingIds = [],
  onStartReplace,
}) => {
  const { scene, camera, raycaster } = useThree();
  const groupRef = useRef();
  const modelGroupRef = useRef();
  const boundingBoxRef = useRef(new THREE.Box3());
  const setInteractionModeRef = useRef(null);
  
  useEffect(() => {
    if (onRegisterElementRef) {
      onRegisterElementRef(placement.id, {
        groupRef,
        setInteractionMode: (mode) => {
          if (setInteractionModeRef.current) {
            setInteractionModeRef.current(mode);
          }
        },
      });
    }
    return () => {
      if (onRegisterElementRef) {
        // Unregister - pass null or remove from map
        // The parent component will handle cleanup
      }
    };
  }, [placement.id, onRegisterElementRef]);
  const dragStateRef = useRef({
    mode: null,
    plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    offset: new THREE.Vector3(),
    intersection: new THREE.Vector3(),
    startPointerX: 0,
    startRotation: 0,
    pointerId: null,
    captureTarget: null,
    parentElementId: null, // Track parent element when stacking
    initialPosition: null, // For multi-selection
    otherSelectedInitialPositions: null, // For multi-selection
  });
  const [isLockedLocal, setIsLockedLocal] = useState(Boolean(placement.isLocked));
  const [interactionMode, setInteractionMode] = useState('translate'); // 'translate' | 'rotate'
  const [isHovered, setIsHovered] = useState(false);
  setInteractionModeRef.current = setInteractionMode;
  const { venueDesignId, projectId, mode } = useVenueDesigner();

  const footprintRadius = useMemo(() => getFootprintRadius(placement), [placement]);

  const position = useMemo(() => {
    const { x = 0, z = 0 } = placement.position || {};
    const y = placement.position?.y || 0;
    return [x, y, z];
  }, [placement.position]);

  const rotationY = useMemo(() => degToRad(placement.rotation || 0), [placement.rotation]);

  const availabilityState = availability?.available === false ? 'unavailable' : 'available';
  const bookingStatus = placement?.bookingStatus || null;
  const placementServiceListingId =
    placement?.metadata?.serviceListingId || placement?.serviceListing?.id || placement?.serviceListingId || null;
  const needsUpdate = useMemo(() => {
    if (!needsUpdateHighlightEnabled) return false;
    if (!placementServiceListingId) return false;
    if (Array.isArray(needsUpdateServiceListingIds) && needsUpdateServiceListingIds.includes(placementServiceListingId)) {
      return true;
    }
    if (placement?.serviceListing) {
      if (placement.serviceListing.isActive === false) return true;
      if (placement.serviceListing.vendorStatus && placement.serviceListing.vendorStatus !== 'active') return true;
    }
    if (placement?.metadata?.serviceListingId && !placement?.serviceListing) return true;
    return false;
  }, [needsUpdateHighlightEnabled, needsUpdateServiceListingIds, placementServiceListingId, placement?.metadata?.serviceListingId, placement?.serviceListing]);

  const outlineColor = useMemo(() => {
    // Outline highlight should ONLY appear when a highlight toggle is enabled.
    if (!bookingHighlightEnabled && !needsUpdateHighlightEnabled) return null;

    // Package designer "needs update" highlight has priority.
    if (needsUpdateHighlightEnabled) {
      return needsUpdate ? '#ef4444' : null;
    }

    // Project booking-status highlight
    if (availabilityState === 'unavailable') return UNAVAILABLE_COLOR;
    if (isSelected) return '#f5b7b1';
    if (bookingStatus) return BOOKING_STATUS_COLORS[bookingStatus] || '#a78bfa';
    return '#94a3b8';
  }, [availabilityState, bookingHighlightEnabled, bookingStatus, isSelected, needsUpdateHighlightEnabled, needsUpdate]);

  const bookingStatusLabel = useMemo(() => {
    if (!bookingStatus) return 'Not booked';
    const labels = {
      pending_vendor_confirmation: 'Pending confirmation',
      pending_deposit_payment: 'Pending deposit',
      confirmed: 'Confirmed',
      pending_final_payment: 'Pending final payment',
      completed: 'Completed',
      cancelled_by_couple: 'Cancelled',
      cancelled_by_vendor: 'Cancelled',
      rejected: 'Rejected',
    };
    return labels[bookingStatus] || bookingStatus;
  }, [bookingStatus]);

  const serviceName = placement?.serviceListing?.name || placement?.metadata?.serviceName || null;

  const ringStyle = useMemo(() => {
    if (availabilityState === 'unavailable') {
      return { color: UNAVAILABLE_COLOR, opacity: isSelected ? 0.45 : 0.22 };
    }
    if (isSelected) {
      return { color: '#f5b7b1', opacity: 0.45 };
    }
    if (bookingHighlightEnabled) {
      if (bookingStatus) {
        return { color: BOOKING_STATUS_COLORS[bookingStatus] || '#a78bfa', opacity: 0.32 };
      }
      // faint ring for unbooked/unmapped
      return { color: '#94a3b8', opacity: 0.08 };
    }
    return { color: HIGHLIGHT_COLOR, opacity: 0.18 };
  }, [availabilityState, bookingHighlightEnabled, bookingStatus, isSelected]);

  // Check if this is a table
  const isTable = useMemo(() => {
    return (
      placement?.designElement?.elementType === 'table' ||
      placement?.elementType === 'table' ||
      placement?.designElement?.name?.toLowerCase().includes('table')
    );
  }, [placement]);

  const canReplaceInPackageDesigner = mode === 'package' && Boolean(placement?.metadata?.serviceListingId);


  useEffect(() => {
    setIsLockedLocal(Boolean(placement.isLocked));
  }, [placement.isLocked]);

  useEffect(() => {
    if (!isSelected) {
      setInteractionMode('translate');
    }
  }, [isSelected]);

  const commitTransform = useCallback(() => {
    if (!groupRef.current) return;
    const { x, y, z } = groupRef.current.position;
    const rotation = normalizeDegrees(radToDeg(groupRef.current.rotation.y));
    const commitData = {
      position: { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), z: Number(z.toFixed(3)) },
      rotation,
    };
    const detectedParentId = dragStateRef.current.parentElementId;
    
    const parentChanged = detectedParentId !== undefined && 
                          detectedParentId !== (placement.parentElementId || null);
    
    if (parentChanged) {
      if (detectedParentId && typeof detectedParentId === 'string') {
        const trimmedId = detectedParentId.trim();
        if (trimmedId !== '' && trimmedId !== placement.id) {
          commitData.parentElementId = trimmedId;
          console.log('[Parent-Child] Saving parentElementId:', trimmedId, 'for placement:', placement.id);
        } else {
          console.warn('[Parent-Child] Invalid parentElementId or self-reference:', trimmedId);
        }
      } else if (detectedParentId === null && placement.parentElementId) {
        commitData.parentElementId = null;
        console.log('[Parent-Child] Clearing parentElementId for placement:', placement.id);
      }
    }
    
    console.log('[Parent-Child] Commit data:', { 
      placementId: placement.id, 
      hasParentElementId: !!commitData.parentElementId,
      parentElementId: commitData.parentElementId,
      detectedParentId,
      currentPlacementParentId: placement.parentElementId,
      parentChanged
    });
    
    onTransformCommit?.(placement.id, commitData);
  }, [onTransformCommit, placement.id, placement.parentElementId]);

  const endInteraction = useCallback(() => {
    if (!dragStateRef.current.mode) return;
    dragStateRef.current.captureTarget?.releasePointerCapture?.(dragStateRef.current.pointerId);
    dragStateRef.current.pointerId = null;
    dragStateRef.current.captureTarget = null;
    dragStateRef.current.mode = null;
    // Clear initial position tracking
    dragStateRef.current.initialPosition = null;
    dragStateRef.current.otherSelectedInitialPositions = null;
    onOrbitToggle?.(true);
    commitTransform();
    dragStateRef.current.parentElementId = placement.parentElementId || null;
  }, [commitTransform, onOrbitToggle, placement.parentElementId]);

  const handlePointerDown = useCallback(
    (event) => {
      event.stopPropagation();
      if (!isSelected) {
        const isShiftKey = event.nativeEvent?.shiftKey || false;
        onSelect?.(placement.id, isShiftKey);
        return;
      }
      if (!groupRef.current || isLockedLocal) return;

      const state = dragStateRef.current;
      
      state.initialPosition = groupRef.current.position.clone();
      
      if (selectedIds.length > 1 && selectedIds.includes(placement.id)) {
        if (onInitializeDragSession) {
          onInitializeDragSession(placement.id, {
            x: state.initialPosition.x,
            y: state.initialPosition.y,
            z: state.initialPosition.z,
          });
        }
      }
      
      if (interactionMode === 'translate') {
        if (event.ray.intersectPlane(state.plane, state.intersection)) {
          state.offset.copy(groupRef.current.position).sub(state.intersection);
        } else {
          state.offset.set(0, 0, 0);
        }
        state.mode = 'translate';
      } else if (interactionMode === 'rotate') {
        state.startPointerX = event.clientX ?? event.nativeEvent?.clientX ?? 0;
        state.startRotation = groupRef.current.rotation.y;
        state.mode = 'rotate';
      }

      onOrbitToggle?.(false);
      state.pointerId = event.pointerId;
      state.captureTarget = event.target;
      state.captureTarget?.setPointerCapture?.(event.pointerId);
    },
    [onSelect, placement.id, onOrbitToggle, isSelected, isLockedLocal, interactionMode, selectedIds, allPlacements]
  );

  const handlePointerMove = useCallback(
    (event) => {
      const state = dragStateRef.current;
      if (!state.mode || !groupRef.current) return;

      event.stopPropagation();

      if (state.mode === 'translate') {
        if (event.ray.intersectPlane(state.plane, state.intersection)) {
          const snap = snapIncrement && snapIncrement > 0 ? snapIncrement : null;
          let nextX = state.intersection.x + state.offset.x;
          let nextZ = state.intersection.z + state.offset.z;
          
          if (snap) {
            nextX = Math.round(nextX / snap) * snap;
            nextZ = Math.round(nextZ / snap) * snap;
          }

          let nextY = 0;
          
          if (state.mode === 'translate' && dragStateRef.current.parentElementId === null && placement.parentElementId) {
            dragStateRef.current.parentElementId = placement.parentElementId;
          }
          
          if (isStackable(placement)) {
             raycaster.setFromCamera(event.pointer, camera);
             
             const intersects = raycaster.intersectObjects(scene.children, true);
             
             let foundValidParent = false;
             for (const hit of intersects) {
               let isSelf = false;
               hit.object.traverseAncestors((a) => {
                 if (a === groupRef.current) isSelf = true;
               });
               if (isSelf) continue;

               if (hit.object.userData?.isGround) continue;

               // If we hit a Placement, stack on top
               let isPlacement = false;
               if (hit.object.userData?.isPlacement) isPlacement = true;
               else {
                 hit.object.traverseAncestors((a) => {
                   if (a.userData?.isPlacement) isPlacement = true;
                 });
               }

               if (isPlacement) {
                 foundValidParent = true;
                 // Get the world bounding box of the hit object (or the specific mesh)
                 const box = new THREE.Box3().setFromObject(hit.object);
                 // Stack on top
                 nextY = box.max.y;
                 
                 // Find the parent placement ID by traversing up to find the placement group
                 let parentGroup = hit.object;
                 while (parentGroup && !parentGroup.userData?.placementId) {
                   if (!parentGroup.parent) break;
                   parentGroup = parentGroup.parent;
                 }
                const detectedParentId = parentGroup?.userData?.placementId;
                
                if (detectedParentId && 
                    typeof detectedParentId === 'string') {
                  const trimmedId = detectedParentId.trim();
                  if (trimmedId !== '' && trimmedId !== placement.id) {
                    dragStateRef.current.parentElementId = trimmedId;
                    console.log('[Parent-Child] Detected parent during drag:', trimmedId, 'for child:', placement.id);
                  } else {
                    dragStateRef.current.parentElementId = null;
                    console.log('[Parent-Child] Self-reference detected, clearing parent');
                  }
                } else {
                  dragStateRef.current.parentElementId = null;
                  console.log('[Parent-Child] No valid parent found, clearing parent');
                }
                 break;
               }
             }
             
             if (!foundValidParent) {
               dragStateRef.current.parentElementId = null;
               console.log('[Parent-Child] No placement found (on ground), clearing parent for:', placement.id);
             }
          } else {
            if (nextY < 0.1) {
              dragStateRef.current.parentElementId = null;
             }
          }

          let collisionFound = false;
          // Check collisions
          for (const other of allPlacements) {
            if (other.id === placement.id) continue;

            const otherPos = other.position || {};
            const dx = nextX - (otherPos.x || 0);
            const dz = nextZ - (otherPos.z || 0);
            const distance = Math.sqrt(dx * dx + dz * dz);
            const otherRadius = getFootprintRadius(other);
            
            const clearance = 0.02;
            const threshold = Math.max(0.1, footprintRadius + otherRadius - clearance);
            const isIntersecting = distance < threshold;

            if (isIntersecting) {
              if (nextY > 0.1) {
                // We are stacked, ignore floor-level collisions
              } else {
                // We are on floor, so collide with floor items
                const otherY = other.position?.y || 0;
                if (otherY < 0.1) {
                  collisionFound = true;
                  break;
                }
              }
            }
          }

          if (venueBounds) {
            const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
            nextX = clamp(nextX, venueBounds.minX + footprintRadius, venueBounds.maxX - footprintRadius);
            nextZ = clamp(nextZ, venueBounds.minZ + footprintRadius, venueBounds.maxZ - footprintRadius);
            if (nextY < venueBounds.minY) {
              nextY = venueBounds.minY;
            }
          }

          if (!collisionFound) {
            const oldX = groupRef.current.position.x;
            const oldY = groupRef.current.position.y;
            const oldZ = groupRef.current.position.z;
            
            groupRef.current.position.set(nextX, nextY, nextZ);
            
            if (selectedIds.length > 1 && selectedIds.includes(placement.id) && state.initialPosition) {
              const offset = {
                x: nextX - state.initialPosition.x,
                y: nextY - state.initialPosition.y,
                z: nextZ - state.initialPosition.z,
              };
              
              if (onUpdateOtherSelected) {
                onUpdateOtherSelected(placement.id, offset, selectedIds, null, state.initialPosition);
              }
            }
            
            const isParent = placement.parentElementId === null;
            if (isParent) {
              // This element is a parent, update its children
              const children = allPlacements.filter((p) => p.parentElementId === placement.id);
              if (children.length > 0 && onUpdateOtherSelected) {
                const offset = {
                  x: nextX - (state.initialPosition?.x || oldX),
                  y: nextY - (state.initialPosition?.y || oldY),
                  z: nextZ - (state.initialPosition?.z || oldZ),
                };
                // Pass children IDs to update them
                const childIds = children.map((c) => c.id);
                console.log('[Parent-Child] Parent moving, updating children:', {
                  parentId: placement.id,
                  childCount: children.length,
                  childIds,
                  offset
                });
                onUpdateOtherSelected(placement.id, offset, childIds, null, state.initialPosition);
              }
            }
          }
        }
      } else if (state.mode === 'rotate') {
        const pointerX = event.clientX ?? event.nativeEvent?.clientX ?? 0;
        const delta = pointerX - state.startPointerX;
        // Sensitivity factor: 0.01 radians per pixel
        const oldRotation = groupRef.current.rotation.y;
        const newRotation = state.startRotation + delta * 0.01;
        groupRef.current.rotation.y = newRotation;
        
        // Update other selected elements in real-time for multi-selection rotation
        if (selectedIds.length > 1 && selectedIds.includes(placement.id) && state.initialPosition) {
          const rotationDelta = newRotation - oldRotation;
          if (onUpdateOtherSelected && Math.abs(rotationDelta) > 0.001) {
            onUpdateOtherSelected(placement.id, null, selectedIds, rotationDelta, state.initialPosition);
          }
        }
        
        // Update children in real-time (parent-child relationship)
        if (placement.parentElementId === null) {
          // This element is a parent, update its children
          const children = allPlacements.filter((p) => p.parentElementId === placement.id);
          if (children.length > 0 && onUpdateOtherSelected) {
            const rotationDelta = newRotation - oldRotation;
            const childIds = children.map((c) => c.id);
            onUpdateOtherSelected(placement.id, null, childIds, rotationDelta, groupRef.current.position);
          }
        }
      }
    },
    [snapIncrement, allPlacements, footprintRadius, placement.id, placement, scene, camera, raycaster, venueBounds]
  );

  const handlePointerUp = useCallback(
    (event) => {
      event.stopPropagation();
      endInteraction();
    },
    [endInteraction]
  );

  const handlePointerLeave = useCallback(() => {
    endInteraction();
  }, [endInteraction]);

  const scaleMultiplier = useMemo(() => {
    const value = parseFloat(placement.metadata?.scaleMultiplier);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
    return 1;
  }, [placement.metadata]);

  const verticalOffset = useMemo(() => {
    const value = parseFloat(placement.metadata?.verticalOffset);
    if (Number.isFinite(value)) {
      return value;
    }
    return 0;
  }, [placement.metadata]);

  useEffect(() => {
    if (modelGroupRef.current) {
      boundingBoxRef.current.setFromObject(modelGroupRef.current);
    }
  }, [placement, scaleMultiplier]);

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[0, rotationY, 0]}
      renderOrder={1}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerLeave}
      onPointerOver={(e) => {
        e.stopPropagation();
        setIsHovered(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setIsHovered(false);
      }}
      userData={{ isPlacement: true, placementId: placement.id }}
    >
      <group ref={modelGroupRef} scale={[1.2, 1.2, 1.2]}>
        {placement.designElement?.modelFile ? (
          <ModelInstance
            url={placement.designElement.modelFile}
            scaleMultiplier={scaleMultiplier}
            verticalOffset={verticalOffset}
            targetDimensions={placement.designElement?.dimensions || placement.metadata?.targetDimensions}
            outlineColor={outlineColor}
            outlineScale={1.035}
          />
        ) : (
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.2, 1, 1.2]} />
            <meshStandardMaterial color={PLACEHOLDER_COLOR} />
          </mesh>
        )}
      </group>

      {/* When booking highlight is enabled, we use an outline around the model instead of the base circle. */}
      {/* When any outline highlight is enabled, we use the outline instead of the base circle. */}
      {!(bookingHighlightEnabled || needsUpdateHighlightEnabled) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[0.9, 32]} />
          <meshBasicMaterial color={ringStyle.color} opacity={ringStyle.opacity} transparent />
        </mesh>
      )}

      {/* Show which service this placement belongs to (only on hover, and only when highlight is enabled). */}
      {bookingHighlightEnabled && isHovered && (serviceName || bookingStatus) && (
        <Html
          position={[0, (boundingBoxRef.current.max.y || 1.2) + 0.7, 0]}
          center
          distanceFactor={28}
          className="scene3d-label"
        >
          <div className="scene3d-label-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: outlineColor || '#94a3b8',
                boxShadow: '0 0 0 2px rgba(255,255,255,0.65)',
              }}
            />
            <span style={{ fontWeight: 700 }}>{serviceName || 'Service'}</span>
            <small>{bookingStatusLabel}</small>
          </div>
        </Html>
      )}

      {isSelected && selectedIds.length === 1 && (
        <Html
          position={[0, (boundingBoxRef.current.max.y || 1.2) + 1, 0]}
          center
          distanceFactor={24}
          className="placement-toolbar-wrapper"
        >
          <div 
            className="placement-toolbar" 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {isLockedLocal ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !isLockedLocal;
                    setIsLockedLocal(next);
                    onToggleLock?.(placement);
                  }}
                >
                  Unlock
                </button>
                <button onClick={(e) => { e.stopPropagation(); onClose?.(); }}>Close</button>
              </>
            ) : (
              <>
                <button
                  className={interactionMode === 'rotate' ? 'active' : ''}
                  onClick={(e) => { e.stopPropagation(); setInteractionMode('rotate'); }}
                >
                  Rotate
                </button>
                <button
                  className={interactionMode === 'translate' ? 'active' : ''}
                  onClick={(e) => { e.stopPropagation(); setInteractionMode('translate'); }}
                >
                  Move
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !isLockedLocal;
                    setIsLockedLocal(next);
                    onToggleLock?.(placement);
                  }}
                >
                  Lock
                </button>
                {onShowDetails && <button onClick={(e) => { e.stopPropagation(); onShowDetails?.(placement); }}>Details</button>}
                {isTable && projectId && venueDesignId && onOpenTaggingModal && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTaggingModal(placement);
                      onClose?.(); // Close the tooltip when opening tag modal
                    }}
                  >
                    Tag Services
                  </button>
                )}
                {onDuplicate && (
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onDuplicate?.(placement.id); 
                    }} 
                    aria-label="Duplicate placement"
                  >
                    Duplicate
                  </button>
                )}
                {canReplaceInPackageDesigner && onStartReplace && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartReplace(placement, placement.metadata?.bundleId ? 'bundle' : 'single');
                      onClose?.();
                    }}
                    aria-label="Replace service from catalog"
                  >
                    Replace
                  </button>
                )}
                {removable && (
                  <button onClick={(e) => { e.stopPropagation(); onDelete?.(placement.id); }} aria-label="Delete placement">
                    Delete
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onClose?.(); }}>Close</button>
              </>
            )}
          </div>
        </Html>
      )}

    </group>
  );
};

PlacedElement.propTypes = {
  placement: PropTypes.shape({
    id: PropTypes.string.isRequired,
    position: PropTypes.shape({
      x: PropTypes.number,
      y: PropTypes.number,
      z: PropTypes.number,
    }),
    rotation: PropTypes.number,
    isLocked: PropTypes.bool,
    designElement: PropTypes.shape({
      name: PropTypes.string,
      modelFile: PropTypes.string,
    }),
    metadata: PropTypes.object,
    bookingId: PropTypes.string,
    bookingStatus: PropTypes.string,
  }).isRequired,
  isSelected: PropTypes.bool,
  selectedIds: PropTypes.arrayOf(PropTypes.string),
  onSelect: PropTypes.func,
  availability: PropTypes.object,
  snapIncrement: PropTypes.number,
  onOrbitToggle: PropTypes.func,
  onTransformCommit: PropTypes.func,
  onDelete: PropTypes.func,
  onDuplicate: PropTypes.func,
  onToggleLock: PropTypes.func,
  onShowDetails: PropTypes.func,
  onClose: PropTypes.func,
  allPlacements: PropTypes.arrayOf(PropTypes.object),
  removable: PropTypes.bool,
  venueBounds: PropTypes.shape({
    minX: PropTypes.number,
    maxX: PropTypes.number,
    minY: PropTypes.number,
    maxY: PropTypes.number,
    minZ: PropTypes.number,
    maxZ: PropTypes.number,
  }),
  onOpenTaggingModal: PropTypes.func,
  onRegisterElementRef: PropTypes.func,
  onUpdateOtherSelected: PropTypes.func,
  onInitializeDragSession: PropTypes.func,
  bookingHighlightEnabled: PropTypes.bool,
  needsUpdateHighlightEnabled: PropTypes.bool,
  needsUpdateServiceListingIds: PropTypes.arrayOf(PropTypes.string),
  onStartReplace: PropTypes.func,
};

export default PlacedElement;
