import React, { useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Helper function to trigger download
const saveArrayBuffer = (buffer, filename) => {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.style.display = 'none';
  document.body.appendChild(link);
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  document.body.removeChild(link);
};

const WallMesh = ({ start, end, thickness, height }) => {
  const length = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
  const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
  const cx = (start[0] + end[0]) / 2;
  const cy = (start[1] + end[1]) / 2;

  return (
    <mesh
      position={[cx / 20, height / 2, cy / 20]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[length / 20, height, thickness / 20]} />
      <meshStandardMaterial color="#cbd5e1" roughness={0.5} metalness={0.1} />
    </mesh>
  );
};

const FloorMesh = ({ data }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    if (data.walls.length < 3) return null;

    // Create an adjacency list to find a cycle
    const adj = new Map();
    data.walls.forEach(w => {
      if (!adj.has(w.startPointId)) adj.set(w.startPointId, []);
      if (!adj.has(w.endPointId)) adj.set(w.endPointId, []);
      adj.get(w.startPointId).push(w.endPointId);
      adj.get(w.endPointId).push(w.startPointId);
    });

    // Simple cycle detection (DFS) - Find the largest loop
    const startNodeId = Array.from(adj.keys()).find(k => adj.get(k).length >= 2);
    if (!startNodeId) return null;

    const path = [startNodeId];
    const visited = new Set();
    visited.add(startNodeId);

    let curr = startNodeId;
    let prev = null;
    
    // Try to walk the perimeter
    for(let i = 0; i < data.points.length * 2; i++) {
       const neighbors = adj.get(curr);
       if (!neighbors) break;

       const next = neighbors.find(n => n !== prev);
       
       if (next === startNodeId && path.length > 2) {
          break; 
       }

       if (next && !visited.has(next)) {
         visited.add(next);
         path.push(next);
         prev = curr;
         curr = next;
       } else {
         break; 
       }
    }

    if (path.length < 3) return null;

    const pathPoints = path.map(id => data.points.find(p => p.id === id)).filter(p => !!p);
    if (pathPoints.length !== path.length) return null;

    // FIX: Negate Y coordinate because plane is rotated -90deg X
    // SVG Y+ is down (World Z+). Rotated Plane local Y+ maps to World Z-.
    // To map SVG Y+ to World Z+, we must use negative Y in the shape.
    s.moveTo(pathPoints[0].x / 20, -pathPoints[0].y / 20);
    for (let i = 1; i < pathPoints.length; i++) {
      s.lineTo(pathPoints[i].x / 20, -pathPoints[i].y / 20);
    }
    s.closePath();
    return s;
  }, [data]);

  if (!shape) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color="#475569" side={THREE.DoubleSide} />
    </mesh>
  );
};

const CornerPost = ({ x, y, height }) => {
  return (
    <mesh position={[x/20, height/2, y/20]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, height, 16]} />
        <meshStandardMaterial color="#94a3b8" />
    </mesh>
  )
}

const SceneExporter = ({ onExportRef, onExport }) => {
  const { scene } = useThree();

  useEffect(() => {
    if (onExportRef) {
      onExportRef.current = () => {
        const roomContent = scene.getObjectByName('room-content');
        if (!roomContent) {
            console.error("Room content not found");
            return;
        }

        const exporter = new GLTFExporter();
        exporter.parse(
          roomContent,
          (result) => {
            if (result instanceof ArrayBuffer) {
              // If onExport callback is provided, call it with the blob
              if (onExport) {
                const blob = new Blob([result], { type: 'model/gltf-binary' });
                onExport({
                  glbBlob: blob,
                  glbFileName: 'venue-model.glb'
                });
              } else {
                // Otherwise, download directly
                saveArrayBuffer(result, 'plancraft-room.glb');
              }
            } else {
              console.error("Export failed: Output is not ArrayBuffer");
            }
          },
          (error) => {
            console.error('An error happened during export:', error);
          },
          { binary: true }
        );
      };
    }
    return () => {
      if (onExportRef) onExportRef.current = null;
    };
  }, [scene, onExportRef, onExport]);

  return null;
};

const SceneContent = ({ data }) => {
  const WALL_HEIGHT = 5;

  const center = useMemo(() => {
    if (data.points.length === 0) return [0, 0, 0];
    const xs = data.points.map(p => p.x);
    const ys = data.points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return [(minX + maxX) / 40, 0, (minY + maxY) / 40];
  }, [data.points]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 20, 10]} intensity={1} castShadow />
      
      <group name="room-content" position={[-center[0], 0, -center[2]]}>
        {data.walls.map(wall => {
          const s = data.points.find(p => p.id === wall.startPointId);
          const e = data.points.find(p => p.id === wall.endPointId);
          if (!s || !e) return null;
          return (
            <WallMesh 
              key={wall.id} 
              start={[s.x, s.y]} 
              end={[e.x, e.y]} 
              thickness={wall.thickness} 
              height={WALL_HEIGHT} 
            />
          );
        })}

        {data.points.map(p => (
           <CornerPost key={p.id} x={p.x} y={p.y} height={WALL_HEIGHT} /> 
        ))}

        <FloorMesh data={data} />
      </group>

      <Grid infiniteGrid sectionSize={5} cellColor="#334155" sectionColor="#475569" fadeDistance={50} />
      <Environment preset="city" />
    </>
  );
};

export const Room3D = ({ data, onExportRef, onExport }) => {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#fafafa', position: 'relative' }}>
      <Canvas shadows camera={{ position: [20, 25, 20], fov: 45 }} style={{ width: '100%', height: '100%' }}>
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />
        <SceneContent data={data} />
        <SceneExporter onExportRef={onExportRef} onExport={onExport} />
      </Canvas>
      <div style={{ position: 'absolute', bottom: 16, right: 16, pointerEvents: 'none', textAlign: 'right' }}>
        <h3 style={{ color: '#333', fontWeight: 'bold', fontSize: '1.25rem', margin: 0, textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>
          3D Visualization
        </h3>
        <p style={{ color: '#666', fontSize: '0.75rem', margin: '4px 0 0 0' }}>Orbit to rotate • Scroll to zoom</p>
      </div>
    </div>
  );
};

