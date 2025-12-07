/**
 * Room3D Component
 * 
 * 3D visualization and export of floorplan data.
 * 
 * Features:
 * - Renders walls with doors and windows as openings
 * - Window glass panels with transparency
 * - Wall textures applied from WALL_TEXTURES
 * - GLB export including all features
 * 
 * The component splits walls into segments around doors/windows,
 * creating proper openings while maintaining wall structure.
 */

import React, { useMemo, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { PIXELS_PER_METER, WALL_TEXTURES, DEFAULT_WALL_HEIGHT } from './constants';

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

// Material cache to avoid recreating materials
const materialCache = new Map();

// Get wall material from cache or create new one
const getWallMaterial = (textureId) => {
  if (materialCache.has(textureId)) {
    return materialCache.get(textureId);
  }
  const tex = WALL_TEXTURES.find(t => t.id === textureId) || WALL_TEXTURES[0];
  const material = new THREE.MeshStandardMaterial({
    color: tex.color,
    roughness: tex.roughness,
    metalness: 0.1
  });
  materialCache.set(textureId, material);
  return material;
};

// Wall segment mesh (used for complex walls with openings)
const WallSegmentMesh = ({ length, height, thickness, position, rotation, texture, enableShadows = true }) => {
  const material = useMemo(() => getWallMaterial(texture), [texture]);
  
  return (
    <mesh 
      position={position} 
      rotation={rotation} 
      castShadow={enableShadows}
      receiveShadow={enableShadows}
      material={material}
    >
      <boxGeometry args={[length, height, thickness]} />
    </mesh>
  );
};

// Complex wall mesh that handles doors and windows by splitting into segments
const ComplexWallMesh = ({ wall, start, end, doors, windows, enableShadows = true }) => {
  const { totalLength, thickness, height, angle, midX, midY, segments } = useMemo(() => {
    const len = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / PIXELS_PER_METER;
    const thick = wall.thickness / PIXELS_PER_METER;
    const h = wall.height || DEFAULT_WALL_HEIGHT;
    const ang = Math.atan2(end.y - start.y, end.x - start.x);
    const mx = (start.x + end.x) / 2 / PIXELS_PER_METER;
    const my = (start.y + end.y) / 2 / PIXELS_PER_METER;

    // Combine and sort openings
    const openings = [
      ...(doors || []).map(d => ({ type: 'DOOR', offset: d.offset, width: d.width, height: d.height, elevation: 0, id: d.id })),
      ...(windows || []).map(w => ({ type: 'WINDOW', offset: w.offset, width: w.width, height: w.height, elevation: w.heightFromGround || 0, id: w.id }))
    ].sort((a, b) => a.offset - b.offset);
    
    const segs = [];
    let currentPos = 0;

    openings.forEach(op => {
      const opStart = (op.offset - op.width / 2) / PIXELS_PER_METER;
      const opEnd = (op.offset + op.width / 2) / PIXELS_PER_METER;
      const opWidth = op.width / PIXELS_PER_METER;

      // 1. Wall before opening
      if (opStart > currentPos) {
        const segLen = opStart - currentPos;
        segs.push({
          length: segLen,
          height: h,
          centerX: currentPos + segLen / 2,
          centerY: h / 2,
        });
      }

      // 2. Opening segments
      if (op.type === 'WINDOW') {
        // Sill (below window)
        if (op.elevation > 0) {
          segs.push({
            length: opWidth,
            height: op.elevation,
            centerX: opStart + opWidth / 2,
            centerY: op.elevation / 2
          });
        }
        // Header (above window)
        const topH = h - (op.elevation + op.height);
        if (topH > 0) {
          segs.push({
            length: opWidth,
            height: topH,
            centerX: opStart + opWidth / 2,
            centerY: h - topH / 2
          });
        }
      } else { // DOOR
        // Header (above door)
        const topH = h - op.height;
        if (topH > 0) {
          segs.push({
            length: opWidth,
            height: topH,
            centerX: opStart + opWidth / 2,
            centerY: h - topH / 2
          });
        }
      }

      currentPos = opEnd;
    });

    // 3. Final segment after last opening
    if (currentPos < len) {
      const segLen = len - currentPos;
      segs.push({
        length: segLen,
        height: h,
        centerX: currentPos + segLen / 2,
        centerY: h / 2
      });
    }

    return { totalLength: len, thickness: thick, height: h, angle: ang, midX: mx, midY: my, segments: segs };
  }, [wall, start, end, doors, windows]);

  return (
    <group position={[midX, 0, midY]} rotation={[0, -angle, 0]}>
      {segments.map((seg, idx) => (
        <WallSegmentMesh
          key={`${wall.id}-${idx}`}
          length={seg.length}
          height={seg.height}
          thickness={thickness}
          position={[seg.centerX - totalLength / 2, seg.centerY, 0]}
          rotation={[0, 0, 0]}
          texture={wall.texture}
          enableShadows={enableShadows}
        />
      ))}
    </group>
  );
};

// Window glass material (cached)
const windowGlassMaterial = new THREE.MeshStandardMaterial({
  color: "#87ceeb",
  transparent: true,
  opacity: 0.3,
  roughness: 0.1,
  metalness: 0.8
});

// Window glass panel
const WindowGlass = ({ window, wall, start, end }) => {
  const { angle, cx, cy, width, height, elevation } = useMemo(() => {
    const ang = Math.atan2(end.y - start.y, end.x - start.x);
    const dx = Math.cos(ang) * window.offset;
    const dy = Math.sin(ang) * window.offset;
    return {
      angle: ang,
      cx: (start.x + dx) / PIXELS_PER_METER,
      cy: (start.y + dy) / PIXELS_PER_METER,
      width: window.width / PIXELS_PER_METER,
      height: window.height,
      elevation: window.heightFromGround || 0
    };
  }, [window, start, end]);

  return (
    <group position={[cx, 0, cy]} rotation={[0, -angle, 0]}>
      <mesh position={[0, elevation + height / 2, 0]} receiveShadow material={windowGlassMaterial}>
        <boxGeometry args={[width, height, 0.01]} />
      </mesh>
    </group>
  );
};

// Helper function to get room shape (reused for floor and ceiling)
const useRoomShape = (data) => {
  return useMemo(() => {
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
    s.moveTo(pathPoints[0].x / PIXELS_PER_METER, -pathPoints[0].y / PIXELS_PER_METER);
    for (let i = 1; i < pathPoints.length; i++) {
      s.lineTo(pathPoints[i].x / PIXELS_PER_METER, -pathPoints[i].y / PIXELS_PER_METER);
    }
    s.closePath();
    return s;
  }, [data]);
};

const FloorMesh = ({ data, enableShadows = true }) => {
  const shape = useRoomShape(data);

  if (!shape) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow={false}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color="#f3f4f6" side={THREE.DoubleSide} />
    </mesh>
  );
};

// Corner post material (cached)
const cornerPostMaterial = new THREE.MeshStandardMaterial({ color: "#64748b" });

// Adaptive geometry based on camera distance
const CornerPost = ({ x, y, walls, cameraDistance }) => {
  const { maxHeight, position, segments } = useMemo(() => {
    const h = walls && walls.length > 0 
      ? Math.max(...walls.map(w => w.height || DEFAULT_WALL_HEIGHT))
      : DEFAULT_WALL_HEIGHT;
    // Reduce segments when far away for better performance
    const segs = cameraDistance > 15 ? 8 : cameraDistance > 8 ? 12 : 16;
    return {
      maxHeight: h,
      position: [x/PIXELS_PER_METER, h/2, y/PIXELS_PER_METER],
      segments: segs
    };
  }, [x, y, walls, cameraDistance]);
  
  const geometry = useMemo(() => 
    new THREE.CylinderGeometry(0.15, 0.15, maxHeight, segments),
    [maxHeight, segments]
  );
  
  return (
    <mesh position={position} castShadow={cameraDistance < 20} material={cornerPostMaterial} geometry={geometry} />
  );
};

const SceneExporter = ({ onExportRef, onExport, data }) => {
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
              // If onExport callback is provided, call it with the blob and floorplan data
              if (onExport) {
                const blob = new Blob([result], { type: 'model/gltf-binary' });
                onExport({
                  glbBlob: blob,
                  glbFileName: 'venue-model.glb',
                  floorplan: data // Include full floorplan data with doors, windows, stages
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
  }, [scene, onExportRef, onExport, data]);

  return null;
};

const SceneContent = ({ data, cameraDistance = 20, onDistanceChange }) => {
  const { camera } = useThree();
  const roomContentRef = React.useRef();
  
  const center = useMemo(() => {
    if (data.points.length === 0) return [0, 0, 0];
    const xs = data.points.map(p => p.x);
    const ys = data.points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return [(minX + maxX) / (2 * PIXELS_PER_METER), 0, (minY + maxY) / (2 * PIXELS_PER_METER)];
  }, [data.points]);

  // Track camera distance to room center
  useFrame(() => {
    if (roomContentRef.current && onDistanceChange) {
      const roomCenter = new THREE.Vector3(-center[0], 0, -center[2]);
      const distance = camera.position.distanceTo(roomCenter);
      onDistanceChange(distance);
    }
  });

  // Shadows are disabled to prevent blue box artifacts

  // Pre-compute wall data to avoid multiple iterations
  const wallData = useMemo(() => {
    return data.walls.map(wall => {
      const s = data.points.find(p => p.id === wall.startPointId);
      const e = data.points.find(p => p.id === wall.endPointId);
      if (!s || !e) return null;
      
      const wallDoors = (data.doors || []).filter(d => d.wallId === wall.id);
      const wallWindows = (data.windows || []).filter(w => w.wallId === wall.id);
      
      return { wall, start: s, end: e, doors: wallDoors, windows: wallWindows };
    }).filter(Boolean);
  }, [data.walls, data.points, data.doors, data.windows]);

  // Pre-compute point connections
  const pointConnections = useMemo(() => {
    return data.points.map(p => {
      const connectedWalls = data.walls.filter(w => w.startPointId === p.id || w.endPointId === p.id);
      return connectedWalls.length > 0 ? { point: p, walls: connectedWalls } : null;
    }).filter(Boolean);
  }, [data.points, data.walls]);

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight 
        position={[10, 20, 10]} 
        intensity={1.2} 
        castShadow={false}
      />
      <directionalLight position={[-10, 10, -5]} intensity={0.6} />
      
      <group ref={roomContentRef} name="room-content" position={[-center[0], 0, -center[2]]}>
        {wallData.map(({ wall, start, end, doors, windows }) => (
          <ComplexWallMesh 
            key={wall.id} 
            wall={wall}
            start={start} 
            end={end} 
            doors={doors}
            windows={windows}
            enableShadows={false}
          />
        ))}

        {/* Window Glass Panels - only render when not too close */}
        {cameraDistance > 2 && wallData.map(({ wall, start, end, windows }) => 
          windows.map(win => (
            <WindowGlass key={win.id} window={win} wall={wall} start={start} end={end} />
          ))
        )}

        {pointConnections.map(({ point, walls }) => (
          <CornerPost key={point.id} x={point.x} y={point.y} walls={walls} cameraDistance={cameraDistance} />
        ))}

        <FloorMesh data={data} enableShadows={false} />
      </group>

      <Grid infiniteGrid sectionSize={5} cellColor="#334155" sectionColor="#475569" fadeDistance={50} />
      <Environment preset="sunset" />
    </>
  );
};

export const Room3D = ({ data, onExportRef, onExport }) => {
  const [cameraDistance, setCameraDistance] = useState(20);

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#fafafa', position: 'relative' }}>
      <Canvas 
        shadows={false}
        camera={{ position: [20, 25, 20], fov: 45 }} 
        style={{ width: '100%', height: '100%' }}
        gl={{ 
          antialias: cameraDistance > 5, // Disable antialiasing when very close
          powerPreference: "high-performance",
          stencil: false,
          depth: true
        }}
        dpr={cameraDistance < 5 ? [1, 1.5] : [1, 2]} // Lower DPR when close
        performance={{ min: 0.5 }}
      >
        <OrbitControls 
          makeDefault 
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 2.1}
          enableDamping={true}
          dampingFactor={0.05}
        />
        <SceneContent data={data} cameraDistance={cameraDistance} onDistanceChange={setCameraDistance} />
        <SceneExporter onExportRef={onExportRef} onExport={onExport} data={data} />
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

