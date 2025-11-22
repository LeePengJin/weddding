import React, { Suspense, useRef, useEffect, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Box, Typography } from '@mui/material';
import * as THREE from 'three';

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
  const clonedScene = useMemo(() => {
    if (!scene) return null;
    const copy = scene.clone(true);
    copy.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
      }
    });
    return copy;
  }, [scene]);

  // Calculate bounding box to center and scale the model
  useEffect(() => {
    if (clonedScene) {
      try {
        const box = new THREE.Box3().setFromObject(clonedScene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        let scaleX = 1;
        let scaleY = 1;
        let scaleZ = 1;

        if (parsedTargetDimensions) {
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
            scaleX = ratioX || ratios[0];
            scaleY = ratioY || ratios[0];
            scaleZ = ratioZ || ratios[0];
          } else if (maxDim > 0) {
            const fitScale = 2 / maxDim;
            scaleX = scaleY = scaleZ = fitScale;
          }
        } else if (maxDim > 0) {
          const fitScale = 2 / maxDim;
          scaleX = scaleY = scaleZ = fitScale;
        }

        // Prevent zero/NaN
        const safeScale = (value) => (Number.isFinite(value) && value > 0 ? value : 1);
        scaleX = safeScale(scaleX);
        scaleY = safeScale(scaleY);
        scaleZ = safeScale(scaleZ);

        clonedScene.position.set(
          -center.x * scaleX,
          -center.y * scaleY,
          -center.z * scaleZ
        );
        clonedScene.scale.set(scaleX, scaleY, scaleZ);
      } catch (err) {
        console.error('Error processing 3D model:', err);
        if (onError) onError(err.message);
      }
    }
  }, [clonedScene, onError, parsedTargetDimensions]);

  useEffect(() => {
    if (error) {
      console.error('Error loading 3D model:', error);
      if (onError) onError('Failed to load 3D model');
    }
  }, [error, onError]);

  if (error || !clonedScene) {
    return null;
  }

  return <primitive object={clonedScene} ref={modelRef} />;
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
            <PerspectiveCamera makeDefault position={[0, 0, 2.5]} fov={50} />
            <ambientLight intensity={0.9} />
            <directionalLight position={[6, 8, 6]} intensity={1.1} />
            <directionalLight position={[-4, -6, -4]} intensity={0.6} />
            <directionalLight position={[0, 5, -6]} intensity={0.5} />
            <Model url={fullUrl} onError={setLoadError} targetDimensions={targetDimensions} />
            <OrbitControls
              enablePan
              enableZoom
              enableRotate
              autoRotate={autoRotate}
              autoRotateSpeed={0.6}
              minDistance={1}
              maxDistance={8}
            />
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

