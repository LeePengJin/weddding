import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Html, useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

const PLACEHOLDER_COLOR = '#e5dcd2';
const HIGHLIGHT_COLOR = '#e76f93';
const UNAVAILABLE_COLOR = '#f87171';

const degToRad = (deg = 0) => (deg * Math.PI) / 180;
const radToDeg = (rad = 0) => (rad * 180) / Math.PI;
const normalizeDegrees = (deg) => {
  const value = ((deg % 360) + 360) % 360;
  return Number(value.toFixed(2));
};

const GltfInstance = ({ url, scaleMultiplier = 1, verticalOffset = 0 }) => {
  const { scene } = useGLTF(url);

  const cloned = useMemo(() => {
    if (!scene) return null;
    const copy = scene.clone(true);
    copy.traverse((child) => {
      if (child.isMesh && child.material) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = child.material.clone();
      }
    });

    const bbox = new THREE.Box3().setFromObject(copy);
    const center = bbox.getCenter(new THREE.Vector3());
    copy.position.sub(center);

    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    let normalization = 1;
    if (maxDim > 5) {
      normalization = 5 / maxDim;
    } else if (maxDim < 0.5) {
      normalization = 0.5 / maxDim;
    }
    copy.scale.setScalar(normalization * scaleMultiplier);

    const alignedBox = new THREE.Box3().setFromObject(copy);
    copy.position.y -= alignedBox.min.y;
    if (verticalOffset) {
      copy.position.y += verticalOffset;
    }

    return copy;
  }, [scene, scaleMultiplier, verticalOffset]);

  if (!cloned) {
    return null;
  }

  return <primitive object={cloned} />;
};

const ModelInstance = ({ url, scaleMultiplier = 1, verticalOffset = 0 }) => {
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

  return <GltfInstance url={fullUrl} scaleMultiplier={scaleMultiplier} verticalOffset={verticalOffset} />;
};

const COLLISION_RADIUS_DEFAULT = 1;

// Helper to determine if an object can be stacked on top of surfaces
const isStackable = (p) => {
  if (p.metadata?.isStackable !== undefined) {
    return Boolean(p.metadata.isStackable);
  }
  const name = p.designElement?.name?.toLowerCase() || '';
  // Assume these items are stackable
  if (name.includes('flower') || name.includes('vase') || name.includes('bouquet') || name.includes('centerpiece') || name.includes('plate') || name.includes('glass') || name.includes('candle')) {
    return true;
  }
  // Tables, chairs, etc are not stackable on other tables usually
  return false;
};

const PlacedElement = ({
  placement,
  isSelected,
  onSelect,
  availability,
  snapIncrement,
  onOrbitToggle,
  onTransformCommit,
  onDelete,
  onToggleLock,
  onShowDetails,
  onClose,
  allPlacements = [],
  removable = false,
}) => {
  const { scene, camera, raycaster } = useThree();
  const groupRef = useRef();
  const modelGroupRef = useRef();
  const boundingBoxRef = useRef(new THREE.Box3());
  const dragStateRef = useRef({
    mode: null,
    plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    offset: new THREE.Vector3(),
    intersection: new THREE.Vector3(),
    startPointerX: 0,
    startRotation: 0,
    pointerId: null,
    captureTarget: null,
  });
  const [isLockedLocal, setIsLockedLocal] = useState(Boolean(placement.isLocked));
  const [interactionMode, setInteractionMode] = useState('translate'); // 'translate' | 'rotate'

  const footprintRadius = useMemo(() => {
    const metaRadius = parseFloat(placement.metadata?.footprintRadius);
    if (Number.isFinite(metaRadius) && metaRadius > 0) {
      return metaRadius;
    }
    return COLLISION_RADIUS_DEFAULT;
  }, [placement.metadata]);

  const position = useMemo(() => {
    const { x = 0, z = 0 } = placement.position || {};
    // Note: We use y=0 from props, but during drag we might set y > 0 if stacked.
    // However, on initial render/commit, y is usually 0 unless persisted.
    // Since the backend/schema might handle y, let's use it if available.
    const y = placement.position?.y || 0;
    return [x, y, z];
  }, [placement.position]);

  const rotationY = useMemo(() => degToRad(placement.rotation || 0), [placement.rotation]);

  const availabilityState = availability?.available === false ? 'unavailable' : 'available';

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
    onTransformCommit?.(placement.id, {
      position: { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), z: Number(z.toFixed(3)) },
      rotation,
    });
  }, [onTransformCommit, placement.id]);

  const endInteraction = useCallback(() => {
    if (!dragStateRef.current.mode) return;
    dragStateRef.current.captureTarget?.releasePointerCapture?.(dragStateRef.current.pointerId);
    dragStateRef.current.pointerId = null;
    dragStateRef.current.captureTarget = null;
    dragStateRef.current.mode = null;
    onOrbitToggle?.(true);
    commitTransform();
  }, [commitTransform, onOrbitToggle]);

  const handlePointerDown = useCallback(
    (event) => {
      event.stopPropagation();
      if (!isSelected) {
        onSelect?.(placement.id);
        return;
      }
      if (!groupRef.current || isLockedLocal) return;

      const state = dragStateRef.current;
      
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
    [onSelect, placement.id, onOrbitToggle, isSelected, isLockedLocal, interactionMode]
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
          
          // Perform raycast to find surfaces below
          if (isStackable(placement)) {
             // Manually update raycaster from pointer for reliable intersection
             // Note: event.pointer is normalized device coordinates
             raycaster.setFromCamera(event.pointer, camera);
             
             // Intersect with all objects in scene
             const intersects = raycaster.intersectObjects(scene.children, true);
             
             for (const hit of intersects) {
               // Ignore self
               let isSelf = false;
               hit.object.traverseAncestors((a) => {
                 if (a === groupRef.current) isSelf = true;
               });
               if (isSelf) continue;

               // Ignore ground plane (tagged with userData.isGround)
               if (hit.object.userData?.isGround) continue;

               // If we hit a Placement (tagged with userData.isPlacement), stack on top
               // Check ancestry for isPlacement tag if needed, or just assume mesh hit is valid surface
               let isPlacement = false;
               if (hit.object.userData?.isPlacement) isPlacement = true;
               else {
                 hit.object.traverseAncestors((a) => {
                   if (a.userData?.isPlacement) isPlacement = true;
                 });
               }

               if (isPlacement) {
                 // Found a valid surface!
                 // Get the world bounding box of the hit object (or the specific mesh)
                 const box = new THREE.Box3().setFromObject(hit.object);
                 // Stack on top
                 nextY = box.max.y;
                 break; // Stop at first valid surface (closest to camera)
               }
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
            const otherRadius = parseFloat(other.metadata?.footprintRadius) || COLLISION_RADIUS_DEFAULT;
            
            const isIntersecting = distance < footprintRadius + otherRadius;

            if (isIntersecting) {
              // If we are stacked significantly above the other object, ignore collision
              // We need the height of the other object.
              // Since we don't have exact height in metadata efficiently, we assume:
              // If nextY > 0.1 (meaning we successfully stacked on SOMETHING),
              // and we are colliding with 'other', we assume 'other' is what we are stacked on or similar.
              // Ideally we'd check if 'other' is the object we raycasted, but simpler heuristic:
              // If I am floating (nextY > 0), I ignore collisions with things below me.
              // But I should still collide with things at my same height (e.g. another stacked flower).
              // For now, allow stacking to override XZ collision.
              if (nextY > 0.1) {
                // We are stacked, ignore floor-level collisions
                // TODO: Ideally check if other.y is near nextY
              } else {
                // We are on floor, so collide with floor items
                // Check if 'other' is also on floor (y near 0)
                const otherY = other.position?.y || 0;
                if (otherY < 0.1) {
                  collisionFound = true;
                  break;
                }
              }
            }
          }

          if (!collisionFound) {
            groupRef.current.position.set(nextX, nextY, nextZ);
          }
        }
      } else if (state.mode === 'rotate') {
        const pointerX = event.clientX ?? event.nativeEvent?.clientX ?? 0;
        const delta = pointerX - state.startPointerX;
        // Sensitivity factor: 0.01 radians per pixel
        groupRef.current.rotation.y = state.startRotation + delta * 0.01;
      }
    },
    [snapIncrement, allPlacements, footprintRadius, placement.id, placement, scene, camera, raycaster]
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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerLeave}
      userData={{ isPlacement: true, placementId: placement.id }}
    >
      <group ref={modelGroupRef} scale={[1.2, 1.2, 1.2]}>
        {placement.designElement?.modelFile ? (
          <ModelInstance
            url={placement.designElement.modelFile}
            scaleMultiplier={scaleMultiplier}
            verticalOffset={verticalOffset}
          />
        ) : (
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.2, 1, 1.2]} />
            <meshStandardMaterial color={PLACEHOLDER_COLOR} />
          </mesh>
        )}
      </group>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.9, 32]} />
        <meshBasicMaterial
          color={availabilityState === 'unavailable' ? UNAVAILABLE_COLOR : isSelected ? '#f5b7b1' : HIGHLIGHT_COLOR}
          opacity={isSelected ? 0.45 : 0.18}
          transparent
        />
      </mesh>

      {isSelected && (
        <Html
          position={[0, (boundingBoxRef.current.max.y || 1.2) + 0.6, 0]}
          center
          distanceFactor={22}
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
  }).isRequired,
  isSelected: PropTypes.bool,
  onSelect: PropTypes.func,
  availability: PropTypes.object,
  snapIncrement: PropTypes.number,
  onOrbitToggle: PropTypes.func,
  onTransformCommit: PropTypes.func,
  onDelete: PropTypes.func,
  onToggleLock: PropTypes.func,
  onShowDetails: PropTypes.func,
  onClose: PropTypes.func,
  allPlacements: PropTypes.arrayOf(PropTypes.object),
  removable: PropTypes.bool,
};

export default PlacedElement;
