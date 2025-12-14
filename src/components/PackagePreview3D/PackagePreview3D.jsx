import React, { Suspense, useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Box, CircularProgress, Typography } from '@mui/material';
import PlacedElement from '../../pages/VenueDesigner/PlacedElement';
import { VenueDesignerProvider } from '../../pages/VenueDesigner/VenueDesignerContext';

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

    const alignedBox = new THREE.Box3().setFromObject(copy);
    const minY = alignedBox.min.y;
    copy.position.y -= minY;

    return copy;
  }, [scene]);

  if (!venueScene) return null;

  return <primitive object={venueScene} />;
};

const PackagePreview3D = ({ packageId, height = '500px' }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [designData, setDesignData] = useState(null);

  useEffect(() => {
    const fetchDesign = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:4000/packages/${packageId}/preview`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to load package preview');
        }
        const data = await response.json();
        setDesignData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (packageId) {
      fetchDesign();
    }
  }, [packageId]);

  const venueModelUrl = useMemo(
    () => (designData?.venue?.modelFile ? normalizeUrl(designData.venue.modelFile) : null),
    [designData?.venue?.modelFile]
  );

  const placements = useMemo(() => designData?.design?.placedElements || [], [designData?.design?.placedElements]);

  // Minimal context for preview mode (PlacedElement needs this but won't use most values)
  // Must be called before any early returns (React hooks rule)
  const previewContextValue = useMemo(() => ({
    projectId: null,
    packageId: packageId || null,
    mode: 'package',
    resourceId: packageId || null,
    placements: placements,
    projectServices: [],
    isLoading: false,
    availabilityMap: {},
    venueInfo: designData?.venue || null,
    venueDesignId: null, // Not needed for preview
    refreshAvailability: () => {},
    onToggleLock: () => {},
    onRemovePlacement: () => {},
    onRemoveProjectService: () => {},
    setToastNotification: () => {},
    onUpdatePlacement: () => {},
    onDuplicatePlacement: undefined,
    onDuplicateMultiple: undefined,
    onDeleteMultiple: undefined,
    onLockMultiple: () => {},
    onReloadDesign: () => {},
    savingState: { loading: false, lastSaved: null },
    designLayout: {},
  }), [packageId, placements, designData?.venue]);

  if (loading) {
    return (
      <Box
        sx={{
          width: '100%',
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          borderRadius: 2,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error || !designData) {
    return (
      <Box
        sx={{
          width: '100%',
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          borderRadius: 2,
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {error || 'Preview not available'}
        </Typography>
      </Box>
    );
  }

  return (
    <VenueDesignerProvider value={previewContextValue}>
      <Box
        sx={{
          width: '100%',
          height,
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: '#cbd2de',
          position: 'relative',
          border: '1px solid #e0e0e0',
        }}
      >
        <Canvas shadows camera={{ position: [14, 16, 18], fov: 42, near: 0.1, far: 500 }} dpr={[1, 2]}>
        <color attach="background" args={['#cbd2de']} />
        <fog attach="fog" args={['#efe9e4', 60, 220]} />
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[18, 30, 20]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
          shadow-camera-near={0.1}
          shadow-camera-far={100}
          shadow-bias={-0.0001}
        />
        <directionalLight position={[-20, 15, -10]} intensity={0.4} />

        <SceneGround size={200} />

        {venueModelUrl && (
          <Suspense fallback={null}>
            <VenueModel modelUrl={venueModelUrl} />
          </Suspense>
        )}

        {/* ContactShadows positioned very low to prevent overlay on elements */}
        <ContactShadows position={[0, 0.001, 0]} opacity={0.12} width={200} height={200} blur={3.5} far={50} scale={1.2} />

        <Suspense fallback={null}>
          {placements.map((placement) => (
            <PlacedElement
              key={placement.id}
              placement={placement}
              isSelected={false}
              onSelect={() => {}}
              availability={null}
              snapIncrement={null}
              onOrbitToggle={() => {}}
              onTransformCommit={() => {}}
              allPlacements={placements}
              removable={false}
              onDelete={() => {}}
              onToggleLock={() => {}}
              onShowDetails={null}
              onClose={() => {}}
            />
          ))}
        </Suspense>

        <Environment preset="sunset" />

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={45}
          minPolarAngle={0.05}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 2, 0]}
        />
      </Canvas>
      <Box
        sx={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          px: 1.5,
          py: 0.75,
          borderRadius: 1,
          fontSize: '0.75rem',
        }}
      >
        Drag to rotate • Scroll to zoom
      </Box>
      </Box>
    </VenueDesignerProvider>
  );
};

export default PackagePreview3D;

