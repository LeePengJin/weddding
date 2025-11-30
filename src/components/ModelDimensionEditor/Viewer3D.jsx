import React, { useRef, useState, useEffect, useLayoutEffect, Suspense, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { 
  useGLTF, 
  Html,
  Center,
  GizmoHelper,
  GizmoViewport,
  Environment,
  ContactShadows,
  OrbitControls
} from '@react-three/drei';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import './Viewer3D.css';

// Helper to check if a vector is valid (finite numbers)
const isValidNumber = (num) => !isNaN(num) && isFinite(num);
const isValidVector = (v) => isValidNumber(v.x) && isValidNumber(v.y) && isValidNumber(v.z);

// --- Dimension Handle Component ---
const DimensionHandle = ({ start, end, offset, label, axis, onDrag, setInteracting, color = "#ffffff" }) => {
  const { camera, raycaster } = useThree();
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(null);

  // Geometric Calculations
  const { p1, p2, dir, length, center, isValid } = useMemo(() => {
     if (!isValidVector(start) || !isValidVector(end) || !isValidVector(offset)) {
         return { p1: new THREE.Vector3(), p2: new THREE.Vector3(), dir: new THREE.Vector3(), length: 0, center: new THREE.Vector3(), isValid: false };
     }

     let safeOffset = offset.clone();
     if (safeOffset.lengthSq() < 0.00001) {
         safeOffset = new THREE.Vector3(0, 1, 0); 
     }

     // P1 and P2 are the points on the dimension line (offset from object)
     const p1 = start.clone().add(offset);
     const p2 = end.clone().add(offset);
     const dVec = p2.clone().sub(p1);
     const length = dVec.length();
     const dir = dVec.clone().normalize();
     const center = p1.clone().add(p2).multiplyScalar(0.5);

     return { p1, p2, dir, length, center, isValid: true };
  }, [start, end, offset]);

  const labelPosition = useMemo(() => {
      let safeOffset = offset.clone();
      if (safeOffset.lengthSq() < 0.00001) safeOffset = new THREE.Vector3(0, 1, 0);
      return center.clone().add(safeOffset.normalize().multiplyScalar(0.25));
  }, [center, offset]);

  // Handle Interaction
  const handlePointerDown = (e) => {
    e.stopPropagation();
    if (e.target) {
      e.target.setPointerCapture(e.pointerId);
    }
    
    const plane = new THREE.Plane();
    const viewDir = new THREE.Vector3();
    camera.getWorldDirection(viewDir);
    plane.setFromNormalAndCoplanarPoint(viewDir.negate(), center);

    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersect);
    
    if (intersect && isValidVector(intersect)) {
        dragStartRef.current = { point: intersect };
        setIsDragging(true);
        setInteracting(true);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !dragStartRef.current) return;
    e.stopPropagation();

    const plane = new THREE.Plane();
    const viewDir = new THREE.Vector3();
    camera.getWorldDirection(viewDir);
    plane.setFromNormalAndCoplanarPoint(viewDir.negate(), center);

    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersect);

    if (intersect && isValidVector(intersect)) {
        const startPoint = dragStartRef.current.point;
        const diff = intersect.clone().sub(startPoint);
        
        let delta = 0;
        if (axis === 'x') delta = diff.x;
        if (axis === 'y') delta = diff.y;
        if (axis === 'z') delta = diff.z;
        
        if (!isNaN(delta)) {
            onDrag(delta);
            dragStartRef.current = { point: intersect };
        }
    }
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    setInteracting(false);
    dragStartRef.current = null;
    if (e.target) {
      e.target.releasePointerCapture(e.pointerId);
    }
  };

  const handlePointerOver = (e) => {
    e.stopPropagation();
    setIsHovered(true);
  };

  const handlePointerOut = (e) => {
    e.stopPropagation();
    setIsHovered(false);
  };

  useEffect(() => {
    if (isDragging) {
        document.body.style.cursor = 'grabbing';
    } else if (isHovered) {
        document.body.style.cursor = 'grab';
    } else {
        document.body.style.cursor = 'auto';
    }
    return () => {
         if (!isDragging && !isHovered) document.body.style.cursor = 'auto';
    }
  }, [isHovered, isDragging]);

  // Use a high-contrast color (Yellow/Amber) for hover/drag state
  const lineColor = isHovered || isDragging ? "#facc15" : color; 
  const lineWidth = isHovered || isDragging ? 5 : 2;

  if (!isValid) return null;

  // --- ARROW LOGIC (<------>) ---
  const arrowHeight = 0.12;
  const arrowRadius = 0.03;

  // Start Arrow: Tip at P1, points -dir
  const startArrowPos = p1.clone().add(dir.clone().multiplyScalar(arrowHeight / 2));
  const startArrowQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());

  // End Arrow: Tip at P2, points +dir
  const endArrowPos = p2.clone().sub(dir.clone().multiplyScalar(arrowHeight / 2));
  const endArrowQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone());

  // Line connects bases
  const lineStart = p1.clone().add(dir.clone().multiplyScalar(arrowHeight));
  const lineEnd = p2.clone().sub(dir.clone().multiplyScalar(arrowHeight));

  const showLine = length > arrowHeight * 2.2;

  // Keys to force update when coordinates change (Prevents ghosting lines)
  const lineKey = `${p1.x.toFixed(3)},${p1.y.toFixed(3)},${p1.z.toFixed(3)}-${p2.x.toFixed(3)}`;

  // Hit box dimensions
  const hitThickness = 0.4;
  
  return (
    <group>
        {/* Main Dimension Line (Connecting Arrows) */}
        {showLine && (
            <line>
                <bufferGeometry key={lineKey}>
                    <bufferAttribute
                        attach="attributes-position"
                        count={2}
                        array={new Float32Array([
                            lineStart.x, lineStart.y, lineStart.z,
                            lineEnd.x, lineEnd.y, lineEnd.z
                        ])}
                        itemSize={3}
                    />
                </bufferGeometry>
                <lineBasicMaterial color={lineColor} linewidth={lineWidth} />
            </line>
        )}

        {/* Start Arrow (<) */}
        <mesh position={startArrowPos} quaternion={startArrowQuat}>
            <coneGeometry args={[arrowRadius, arrowHeight, 32]} />
            <meshBasicMaterial color={lineColor} />
        </mesh>

        {/* End Arrow (>) */}
        <mesh position={endArrowPos} quaternion={endArrowQuat}>
            <coneGeometry args={[arrowRadius, arrowHeight, 32]} />
            <meshBasicMaterial color={lineColor} />
        </mesh>

        {/* Hit Area (Invisible Box) */}
        <mesh 
            position={center} 
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            <boxGeometry args={[
                axis === 'x' ? length : hitThickness, 
                axis === 'y' ? length : hitThickness, 
                axis === 'z' ? length : hitThickness
            ]} />
            <meshBasicMaterial transparent opacity={0} depthTest={false} />
        </mesh>

        {/* Label */}
        <Html position={labelPosition} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
            <div className={`model-dimension-label ${isDragging || isHovered ? 'model-dimension-label-active' : ''}`}>
                {label}
            </div>
        </Html>
    </group>
  );
};


const ModelViewer = ({ url, onDimensionsChange, setSceneRef, setInteracting, targetDimensions }) => {
  const { scene } = useGLTF(url);
  const [originalSize, setOriginalSize] = useState(new THREE.Vector3(1, 1, 1));
  const [scale, setScale] = useState(new THREE.Vector3(1, 1, 1));
  const [modelCenter, setModelCenter] = useState(new THREE.Vector3(0,0,0));
  const groupRef = useRef(null);
  const isInitializedRef = useRef(false);
  const onDimensionsChangeRef = useRef(onDimensionsChange);
  
  // Keep callback ref up to date
  useEffect(() => {
    onDimensionsChangeRef.current = onDimensionsChange;
  }, [onDimensionsChange]);

  // Create a stable key from targetDimensions to detect actual changes
  const targetDimensionsKey = useMemo(() => {
    if (!targetDimensions) return 'none';
    const w = targetDimensions.width || 0;
    const h = targetDimensions.height || 0;
    const d = targetDimensions.depth || 0;
    return `${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}`;
  }, [targetDimensions?.width, targetDimensions?.height, targetDimensions?.depth]);

  // Reset scale when URL or targetDimensions changes to prevent inheriting scale from previous model
  useEffect(() => {
    setScale(new THREE.Vector3(1, 1, 1));
    isInitializedRef.current = false;
  }, [url, targetDimensionsKey]);

  // Update scale when targetDimensions changes (e.g., when reopening with saved dimensions)
  // Only update if model is already initialized and targetDimensions are provided
  useEffect(() => {
    if (!isInitializedRef.current || !targetDimensions || !originalSize || 
        originalSize.x <= 0 || originalSize.y <= 0 || originalSize.z <= 0) {
      return;
    }
    
    const targetWidth = targetDimensions.width;
    const targetHeight = targetDimensions.height;
    const targetDepth = targetDimensions.depth;
    
    // Calculate new scale values
    const newScaleX = targetWidth && isFinite(targetWidth) && targetWidth > 0 
      ? targetWidth / originalSize.x 
      : scale.x;
    const newScaleY = targetHeight && isFinite(targetHeight) && targetHeight > 0 
      ? targetHeight / originalSize.y 
      : scale.y;
    const newScaleZ = targetDepth && isFinite(targetDepth) && targetDepth > 0 
      ? targetDepth / originalSize.z 
      : scale.z;
    
    // Only update if values are valid and different
    if (isFinite(newScaleX) && isFinite(newScaleY) && isFinite(newScaleZ) &&
        newScaleX > 0 && newScaleY > 0 && newScaleZ > 0) {
      setScale(new THREE.Vector3(newScaleX, newScaleY, newScaleZ));
    }
  }, [targetDimensions, originalSize]);

  // Calculate bounding box and original size (only when scene changes)
  useLayoutEffect(() => {
    if (scene) {
      scene.scale.set(1, 1, 1);
      scene.updateMatrixWorld(true);

      const box = new THREE.Box3();
      box.makeEmpty();
      
      let hasMesh = false;
      scene.traverse((child) => {
          if (child.isMesh) {
              const mesh = child;
              if (mesh.geometry) {
                  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
                  const meshBox = mesh.geometry.boundingBox;
                  if (meshBox && !meshBox.isEmpty()) {
                      const worldBox = meshBox.clone().applyMatrix4(mesh.matrixWorld);
                      box.union(worldBox);
                      hasMesh = true;
                  }
              }
          }
      });

      if (box.isEmpty() || !hasMesh) {
          box.setFromObject(scene);
      }
      
      if (box.isEmpty() || !isFinite(box.min.x)) {
          const defaultSz = new THREE.Vector3(1, 1, 1);
          setOriginalSize(defaultSz);
          setModelCenter(new THREE.Vector3(0,0,0));
          onDimensionsChangeRef.current({ x: 1, y: 1, z: 1 });
          return;
      }

      const sz = new THREE.Vector3();
      box.getSize(sz);
      const ctr = new THREE.Vector3();
      box.getCenter(ctr);

      if (sz.x === 0) sz.x = 0.01;
      if (sz.y === 0) sz.y = 0.01;
      if (sz.z === 0) sz.z = 0.01;
      
      setOriginalSize(sz);
      setModelCenter(ctr);
      
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
        if (!targetDimensions || !targetDimensions.width || !targetDimensions.height || !targetDimensions.depth) {
          // No target dimensions, use original size
          onDimensionsChangeRef.current({ x: sz.x, y: sz.y, z: sz.z });
        }
      }
    }
  }, [scene]);

  // Apply targetDimensions when they change (after originalSize is calculated)
  useEffect(() => {
    if (!originalSize || originalSize.x <= 0 || originalSize.y <= 0 || originalSize.z <= 0) {
      return;
    }
    
    if (targetDimensions && targetDimensions.width && targetDimensions.height && targetDimensions.depth) {
      // Calculate scale based on target dimensions
      const scaleX = originalSize.x > 0 ? targetDimensions.width / originalSize.x : 1;
      const scaleY = originalSize.y > 0 ? targetDimensions.height / originalSize.y : 1;
      const scaleZ = originalSize.z > 0 ? targetDimensions.depth / originalSize.z : 1;
      
      // Only set scale if all values are valid
      if (isFinite(scaleX) && isFinite(scaleY) && isFinite(scaleZ) &&
          scaleX > 0 && scaleY > 0 && scaleZ > 0) {
        setScale(new THREE.Vector3(scaleX, scaleY, scaleZ));
        // Notify parent of the target dimensions
        onDimensionsChangeRef.current({
          x: targetDimensions.width,
          y: targetDimensions.height,
          z: targetDimensions.depth
        });
      }
    }
  }, [targetDimensions, originalSize]);

  useEffect(() => {
     if (groupRef.current) setSceneRef(groupRef.current);
  }, [setSceneRef]);


  // Notify parent of changes - simplified approach matching TypeScript version
  // Always notify on scale changes (no threshold, no ref tracking)
  useEffect(() => {
      if (!isInitializedRef.current || originalSize.x <= 0) return;
      
      // Validate scale values
      if (!isFinite(scale.x) || !isFinite(scale.y) || !isFinite(scale.z)) return;
      if (scale.x <= 0 || scale.y <= 0 || scale.z <= 0) return;
      
      const currentDimX = originalSize.x * scale.x;
      const currentDimY = originalSize.y * scale.y;
      const currentDimZ = originalSize.z * scale.z;
      
      // Validate dimensions
      if (!isFinite(currentDimX) || !isFinite(currentDimY) || !isFinite(currentDimZ)) return;
      
      // Always notify parent of dimension changes (matching TypeScript version)
      // x = width, y = height, z = depth
      const dimensions = {
          x: currentDimX,  // width
          y: currentDimY,  // height
          z: currentDimZ   // depth
      };
      console.log('Viewer3D: Notifying dimension change:', dimensions);
      if (onDimensionsChangeRef.current) {
        onDimensionsChangeRef.current(dimensions);
      }
  }, [scale, originalSize]);

  const handleResize = (axis, delta) => {
    setScale(prev => {
        const next = prev.clone();
        const baseSize = originalSize[axis];
        if (baseSize === 0) return prev;

        const currentDim = baseSize * prev[axis];
        const newDim = Math.max(0.01, currentDim + delta);
        const newScale = newDim / baseSize;
        
        // Validate scale to prevent NaN, Infinity, or extreme values
        if (!isFinite(newScale) || newScale <= 0 || newScale > 1000) {
          return prev;
        }
        
        next[axis] = newScale;
        
        // Immediately notify parent of dimension change during drag
        const newDims = {
          x: axis === 'x' ? newDim : (originalSize.x * next.x),
          y: axis === 'y' ? newDim : (originalSize.y * next.y),
          z: axis === 'z' ? newDim : (originalSize.z * next.z),
        };
        console.log('Viewer3D: handleResize - notifying dimension change:', newDims);
        if (onDimensionsChangeRef.current) {
          onDimensionsChangeRef.current(newDims);
        }
        
        return next;
    });
  };

  const bounds = useMemo(() => {
     if (!isFinite(scale.x) || !isFinite(scale.y) || !isFinite(scale.z)) {
       return { dx: 0.5, dy: 0.5, dz: 0.5 };
     }
     const dx = (originalSize.x * scale.x) / 2;
     const dy = (originalSize.y * scale.y) / 2;
     const dz = (originalSize.z * scale.z) / 2;
     return { dx, dy, dz };
  }, [originalSize, scale]);

  // Calculate offset based on model size to position dimension handles properly
  const offsetDistance = useMemo(() => {
    const maxDim = Math.max(
      originalSize.x * scale.x,
      originalSize.y * scale.y,
      originalSize.z * scale.z
    );
    return Math.max(0.3, maxDim * 0.15); // At least 0.3 units, or 15% of largest dimension
  }, [originalSize, scale]);

  // Validate scale before rendering
  const isValidScale = useMemo(() => {
    return isFinite(scale.x) && isFinite(scale.y) && isFinite(scale.z) &&
           scale.x > 0 && scale.y > 0 && scale.z > 0 &&
           scale.x < 1000 && scale.y < 1000 && scale.z < 1000;
  }, [scale]);

  // Force re-render when scale changes by using scale values directly
  const scaleArray = useMemo(() => [scale.x, scale.y, scale.z], [scale.x, scale.y, scale.z]);

  if (!isValidScale || !scene) {
    return null;
  }
  
  return (
    <group ref={groupRef}>
        <group scale={scaleArray}>
            <primitive object={scene} position={modelCenter.clone().negate()} />
        </group>

        <group name="DimensionGizmos">
            {/* Depth Handle (Z-axis) - Front to Back */}
            <DimensionHandle
                axis="z"
                start={new THREE.Vector3(bounds.dx, -bounds.dy, bounds.dz)}
                end={new THREE.Vector3(bounds.dx, -bounds.dy, -bounds.dz)}
                offset={new THREE.Vector3(offsetDistance, 0, 0)} 
                label={`D ${(originalSize.z * scale.z).toFixed(2)}m`}
                onDrag={(d) => handleResize('z', d)} 
                setInteracting={setInteracting}
                color="#5555ff"
            />

            {/* Height Handle (Y-axis) - Bottom to Top */}
            <DimensionHandle
                axis="y"
                start={new THREE.Vector3(bounds.dx, -bounds.dy, -bounds.dz)}
                end={new THREE.Vector3(bounds.dx, bounds.dy, -bounds.dz)}
                offset={new THREE.Vector3(offsetDistance, 0, 0)}
                label={`H ${(originalSize.y * scale.y).toFixed(2)}m`}
                onDrag={(d) => handleResize('y', d)}
                setInteracting={setInteracting}
                color="#55ff55"
            />

            {/* Width Handle (X-axis) - Left to Right */}
            <DimensionHandle
                axis="x"
                start={new THREE.Vector3(-bounds.dx, bounds.dy, -bounds.dz)}
                end={new THREE.Vector3(bounds.dx, bounds.dy, -bounds.dz)}
                offset={new THREE.Vector3(0, offsetDistance, 0)}
                label={`W ${(originalSize.x * scale.x).toFixed(2)}m`}
                onDrag={(d) => handleResize('x', d)}
                setInteracting={setInteracting}
                color="#ff5555"
            />
        </group>
    </group>
  );
};

const SceneContent = ({ fileUrl, onDimensionsChange, setSceneToExport, targetDimensions }) => {
    const { gl, scene: threeScene } = useThree();
    const [isInteracting, setIsInteracting] = useState(false);

    return (
        <>
            <ambientLight intensity={0.8} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
            <Environment preset="city" />
            
            <Center>
                 <Suspense fallback={<Html><div className="model-dimension-loading">Loading Model...</div></Html>}>
                    <ModelViewer 
                        url={fileUrl} 
                        onDimensionsChange={onDimensionsChange} 
                        targetDimensions={targetDimensions}
                        setSceneRef={setSceneToExport}
                        setInteracting={setIsInteracting}
                    />
                 </Suspense>
            </Center>
            
            <ContactShadows resolution={1024} scale={50} blur={4} opacity={0.5} far={10} color="#000000" />
            
            <OrbitControls 
              makeDefault 
              enabled={!isInteracting}
              enablePan={false}
              enableZoom={true}
              enableRotate={true}
            />
            
            <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
                <GizmoViewport axisColors={['#ff5555', '#55ff55', '#5555ff']} labelColor="white" />
            </GizmoHelper>
        </>
    );
}

const Viewer3D = ({ fileUrl, onDimensionsChange, exportRef, targetDimensions }) => {
  const sceneRef = useRef(null);

  const handleExport = (filename) => {
      if (!sceneRef.current) return;
      
      const scene = sceneRef.current;
      const gizmos = scene.getObjectByName('DimensionGizmos');
      if (gizmos) gizmos.visible = false;

      const exporter = new GLTFExporter();
      exporter.parse(
          scene,
          (result) => {
              if (result instanceof ArrayBuffer) {
                  const blob = new Blob([result], { type: 'model/gltf-binary' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = filename.endsWith('.glb') ? filename : `${filename}.glb`;
                  link.click();
                  URL.revokeObjectURL(url);
              }
              if (gizmos) gizmos.visible = true;
          },
          (err) => {
              console.error(err);
              if (gizmos) gizmos.visible = true;
          },
          { binary: true }
      );
  };

  useEffect(() => {
      if (exportRef) {
        exportRef.current = handleExport;
      }
  }, [exportRef]);

  return (
    <div className="model-dimension-viewer">
      <Canvas shadows camera={{ position: [4, 4, 8], fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
        <SceneContent 
            fileUrl={fileUrl} 
            onDimensionsChange={onDimensionsChange} 
            targetDimensions={targetDimensions}
            setSceneToExport={(obj) => sceneRef.current = obj}
        />
      </Canvas>
    </div>
  );
};

export default Viewer3D;

