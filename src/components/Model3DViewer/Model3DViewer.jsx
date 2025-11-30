import React, { Suspense, useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Box, Typography } from '@mui/material';
import * as THREE from 'three';

// Camera controller that adjusts to fit the model
function CameraController({ autoRotate = false }) {
  const { camera, scene } = useThree();
  const controlsRef = useRef();

  useEffect(() => {
    if (!scene || !camera) return;
    
    // Wait for scene to load
    const timer = setTimeout(() => {
      const box = new THREE.Box3();
      box.makeEmpty();
      
      scene.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) {
            if (!child.geometry.boundingBox) {
              child.geometry.computeBoundingBox();
            }
            const meshBox = child.geometry.boundingBox;
            if (meshBox && !meshBox.isEmpty()) {
              const worldBox = meshBox.clone().applyMatrix4(child.matrixWorld);
              box.union(worldBox);
            }
          }
        }
      });

      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Calculate distance to fit the model with some padding
        const distance = maxDim * 1.5;
        const fov = camera.fov * (Math.PI / 180);
        const cameraZ = Math.abs(distance / Math.sin(fov / 2));
        
        // Position camera to view the model from an angle
        camera.position.set(
          center.x + cameraZ * 0.5,
          center.y + cameraZ * 0.5,
          center.z + cameraZ * 0.8
        );
        camera.lookAt(center);
        camera.updateProjectionMatrix();
        
        // Update controls target
        if (controlsRef.current) {
          controlsRef.current.target.copy(center);
          controlsRef.current.update();
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [camera, scene]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableZoom={true}
      enableRotate={true}
      autoRotate={autoRotate}
      autoRotateSpeed={0.6}
      minDistance={0.5}
      maxDistance={10}
    />
  );
}

// Model loader component
function parseDimensions(dimensions) {
  if (!dimensions) return null;
  const parsed = {};
  ['width', 'height', 'depth'].forEach((axis) => {
    const value = dimensions[axis];
    if (value === '' || value === null || value === undefined) return;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      parsed[axis] = numeric;
    }
  });
  return Object.keys(parsed).length ? parsed : null;
}

function Model({ url, onError, targetDimensions }) {
  const { scene, error } = useGLTF(url);
  const modelRef = useRef();
  const parsedTargetDimensions = useMemo(() => parseDimensions(targetDimensions), [targetDimensions]);
  
  // Debug: log when dimensions change
  useEffect(() => {
    if (parsedTargetDimensions) {
      console.log('[Model3DViewer] Parsed target dimensions:', parsedTargetDimensions);
    } else if (targetDimensions) {
      console.log('[Model3DViewer] Target dimensions provided but not parsed:', targetDimensions);
    }
  }, [parsedTargetDimensions, targetDimensions]);

  // Calculate scale separately so React Three Fiber can detect changes
  const scaleArray = useMemo(() => {
    if (!scene) {
      return [1, 1, 1];
    }
    
    if (!parsedTargetDimensions) {
      // Default scale for fitting
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const fitScale = 2 / maxDim;
        return [fitScale, fitScale, fitScale];
      }
      return [1, 1, 1];
    }

    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    let scaleX = 1;
    let scaleY = 1;
    let scaleZ = 1;

    const ratioX =
      parsedTargetDimensions.width && size.x > 0
        ? parsedTargetDimensions.width / size.x
        : null;
    const ratioY =
      parsedTargetDimensions.height && size.y > 0
        ? parsedTargetDimensions.height / size.y
        : null;
    const ratioZ =
      parsedTargetDimensions.depth && size.z > 0
        ? parsedTargetDimensions.depth / size.z
        : null;

    const ratios = [ratioX, ratioY, ratioZ].filter((value) => Number.isFinite(value));

    if (ratios.length === 1) {
      const uniformScale = ratios[0] || 1;
      scaleX = scaleY = scaleZ = uniformScale;
    } else if (ratios.length > 1) {
      scaleX = ratioX || ratios[0] || 1;
      scaleY = ratioY || ratios[0] || 1;
      scaleZ = ratioZ || ratios[0] || 1;
    } else if (maxDim > 0) {
      const fitScale = 2 / maxDim;
      scaleX = scaleY = scaleZ = fitScale;
    }

    // Prevent zero/NaN
    const safeScale = (value) => (Number.isFinite(value) && value > 0 ? value : 1);
    scaleX = safeScale(scaleX);
    scaleY = safeScale(scaleY);
    scaleZ = safeScale(scaleZ);

    const result = [scaleX, scaleY, scaleZ];
    if (parsedTargetDimensions) {
      console.log('[Model3DViewer] Calculated scale:', result, 'for dimensions:', parsedTargetDimensions);
    }
    return result;
  }, [scene, parsedTargetDimensions]);

  // Clone and prepare the scene
  // Note: We don't need to include parsedTargetDimensions here because scale is applied via group
  const processedScene = useMemo(() => {
    if (!scene) return null;
    
    try {
      const copy = scene.clone(true);
      copy.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
        }
      });

      const box = new THREE.Box3().setFromObject(copy);
      const center = box.getCenter(new THREE.Vector3());
      copy.position.sub(center);

      // Align to ground (y=0) - will be done after scaling
      return copy;
    } catch (err) {
      console.error('Error processing 3D model:', err);
      if (onError) onError(err.message);
      return null;
    }
  }, [scene, onError]);

  // Apply alignment in a separate effect (scale is applied via group prop)
  // Recalculate alignment when scene or scale changes
  useEffect(() => {
    if (!processedScene) return;
    
    // Reset position to center first
    const box = new THREE.Box3().setFromObject(processedScene);
    const center = box.getCenter(new THREE.Vector3());
    processedScene.position.sub(center);
    
    // Align to ground (y=0) - calculate based on original size before scaling
    const alignedBox = new THREE.Box3().setFromObject(processedScene);
    processedScene.position.y -= alignedBox.min.y;
    
    // Force update
    processedScene.updateMatrixWorld(true);
  }, [processedScene, scaleArray]);

  useEffect(() => {
    if (error) {
      console.error('Error loading 3D model:', error);
      if (onError) onError('Failed to load 3D model');
    }
  }, [error, onError]);

  if (error || !processedScene) {
    return null;
  }

  // Use group with scale prop so React Three Fiber detects changes
  // The scale array changes when dimensions change, forcing a re-render
  return (
    <group ref={modelRef} scale={scaleArray}>
      <primitive object={processedScene} />
    </group>
  );
}

const Model3DViewer = ({
  modelUrl,
  width = '100%',
  height = '400px',
  borderless = false,
  autoRotate = false,
  targetDimensions,
}) => {
  const [loadError, setLoadError] = useState(null);

  // Convert relative URL to full backend URL
  const getFullUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/uploads')) {
      return `http://localhost:4000${url}`;
    }
    return url;
  };

  const fullUrl = getFullUrl(modelUrl);

  if (!fullUrl) {
    return (
      <Box
        sx={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          borderRadius: borderless ? 0 : 2,
          border: borderless ? 'none' : '1px solid #e0e0e0',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No 3D model available
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width,
        height,
        borderRadius: borderless ? 0 : 2,
        border: borderless ? 'none' : '1px solid #e0e0e0',
        overflow: 'hidden',
        backgroundColor: '#f5f5f5',
        position: 'relative',
      }}
    >
      {loadError ? (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <Typography variant="body2" color="error">
            {loadError}
          </Typography>
        </Box>
      ) : (
        <Canvas
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
          style={{ width: '100%', height: '100%' }}
        >
          <Suspense
            fallback={
              <mesh>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#e0e0e0" />
              </mesh>
            }
          >
            <CameraController autoRotate={autoRotate} />
            <ambientLight intensity={0.9} />
            <directionalLight position={[6, 8, 6]} intensity={1.1} />
            <directionalLight position={[-4, -6, -4]} intensity={0.6} />
            <directionalLight position={[0, 5, -6]} intensity={0.5} />
            <Model url={fullUrl} onError={setLoadError} targetDimensions={targetDimensions} />
          </Suspense>
        </Canvas>
      )}
      {!borderless && (
      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          px: 1.5,
          py: 0.5,
          borderRadius: 1,
          fontSize: '0.75rem',
        }}
      >
        Drag to rotate • Scroll to zoom
      </Box>
      )}
    </Box>
  );
};

export default Model3DViewer;

