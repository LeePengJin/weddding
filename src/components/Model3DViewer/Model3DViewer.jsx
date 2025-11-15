import React, { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, useGLTF } from '@react-three/drei';
import { Box, Typography, CircularProgress } from '@mui/material';
import * as THREE from 'three';

// Model loader component
function Model({ url, onError }) {
  const { scene, error } = useGLTF(url);
  const modelRef = useRef();

  // Calculate bounding box to center and scale the model
  useEffect(() => {
    if (scene) {
      try {
        const box = new THREE.Box3().setFromObject(scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = maxDim > 0 ? 2 / maxDim : 1; // Scale to fit in a 2-unit space

        scene.position.x = -center.x * scale;
        scene.position.y = -center.y * scale;
        scene.position.z = -center.z * scale;
        scene.scale.set(scale, scale, scale);
      } catch (err) {
        console.error('Error processing 3D model:', err);
        if (onError) onError(err.message);
      }
    }
  }, [scene, onError]);

  useEffect(() => {
    if (error) {
      console.error('Error loading 3D model:', error);
      if (onError) onError('Failed to load 3D model');
    }
  }, [error, onError]);

  if (error) {
    return null;
  }

  return <primitive object={scene} ref={modelRef} />;
}

const Model3DViewer = ({ modelUrl, width = '100%', height = '400px' }) => {
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
          borderRadius: 2,
          border: '1px solid #e0e0e0',
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
        borderRadius: 2,
        border: '1px solid #e0e0e0',
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
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <directionalLight position={[-10, -10, -5]} intensity={0.5} />
            <Environment preset="city" />
            <Model url={fullUrl} onError={setLoadError} />
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={1}
              maxDistance={8}
            />
          </Suspense>
        </Canvas>
      )}
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
    </Box>
  );
};

export default Model3DViewer;

