/**
 * FloorplanEditor Component
 * 
 * Enhanced 2D floorplan editor with support for:
 * - Walls with height, thickness, and texture properties
 * - Doors and windows placement with collision detection
 * - Stage platforms with resize handles and rotation
 * - Zoom functionality (mouse wheel + buttons)
 * - Multiple drawing modes: SELECT, DRAW, PAN, DOOR, WINDOW, STAGE
 * 
 * Keyboard Shortcuts:
 * - V: Select Mode
 * - P: Draw Mode (walls)
 * - D: Door Mode
 * - W: Window Mode
 * - S: Stage Mode
 * - H: Pan Mode
 * - Space: Hold to pan
 * - ESC: Cancel current mode
 * - Delete/Backspace: Delete selected element
 * - CTRL+Z: Undo
 * - CTRL+Y: Redo
 * 
 * Data Format:
 * {
 *   points: [{ id, x, y }],
 *   walls: [{ id, startPointId, endPointId, thickness, height, texture }],
 *   doors: [{ id, wallId, offset, width, height }],
 *   windows: [{ id, wallId, offset, width, height, heightFromGround }],
 *   stages: [{ id, x, y, width, depth, height, rotation, color }]
 * }
 * 
 * Backward Compatible: Old floorplans without doors/windows will load with empty arrays.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Button, IconButton, TextField, Typography, Select, MenuItem } from '@mui/material';
import { 
  Delete as Trash2Icon, 
  Edit as PenToolIcon, 
  OpenWith as MousePointer2Icon, 
  Check as CheckIcon, 
  PanTool as HandIcon,
  DoorFront as DoorIcon,
  Window as WindowIcon,
  ZoomIn,
  ZoomOut
} from '@mui/icons-material';
import { 
  GRID_SIZE, 
  PIXELS_PER_METER, 
  DEFAULT_WALL_HEIGHT,
  DEFAULT_DOOR_WIDTH,
  DEFAULT_DOOR_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_ELEVATION,
  WALL_TEXTURES
} from './constants';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const FloorplanEditor = ({ data, onUpdate }) => {
  const svgRef = useRef(null);
  
  // Modes: 'SELECT' | 'DRAW' | 'PAN' | 'DOOR' | 'WINDOW'
  const [mode, setMode] = useState('SELECT');
  
  // Pan & Zoom State
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Select Mode State
  const [draggingPointId, setDraggingPointId] = useState(null);
  const [draggingWallId, setDraggingWallId] = useState(null);
  const [draggingDoorId, setDraggingDoorId] = useState(null);
  const [draggingWindowId, setDraggingWindowId] = useState(null);
  const [lastMousePos, setLastMousePos] = useState(null);
  const hasSavedHistoryRef = useRef(false);

  const [hoverPointId, setHoverPointId] = useState(null);
  const [hoverWallId, setHoverWallId] = useState(null);
  
  const [selectedWallId, setSelectedWallId] = useState(null);
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [selectedDoorId, setSelectedDoorId] = useState(null);
  const [selectedWindowId, setSelectedWindowId] = useState(null);

  // Property Inputs
  const [wallLengthInput, setWallLengthInput] = useState("");
  const [wallHeightInput, setWallHeightInput] = useState("");
  const [wallThicknessInput, setWallThicknessInput] = useState("");
  const [wallTextureInput, setWallTextureInput] = useState("default");
  
  const [doorWidthInput, setDoorWidthInput] = useState("");
  const [doorHeightInput, setDoorHeightInput] = useState("");

  const [windowWidthInput, setWindowWidthInput] = useState("");
  const [windowHeightInput, setWindowHeightInput] = useState("");
  const [windowElevationInput, setWindowElevationInput] = useState("");


  // Draw Mode State
  const [activeDrawId, setActiveDrawId] = useState(null);
  const [cursorPos, setCursorPos] = useState(null);

  // Door/Window Placement Mode State
  const [ghostOpening, setGhostOpening] = useState(null);

  // --- Utils ---

  const getMousePosition = useCallback((evt) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    const screenX = (evt.clientX - CTM.e) / CTM.a;
    const screenY = (evt.clientY - CTM.f) / CTM.d;
    return {
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom
    };
  }, [pan, zoom]);

  const getSnappedPosition = (evt) => {
    const pos = getMousePosition(evt);
    return {
      x: Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(pos.y / GRID_SIZE) * GRID_SIZE
    };
  };

  const getPoint = useCallback((id) => data.points.find(p => p.id === id), [data.points]);

  // Helper to calculate distance from point to line segment
  const pointToLineDistance = (px, py, x1, y1, x2, y2) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return { distance: Math.sqrt(dx * dx + dy * dy), x: xx, y: yy, offsetRatio: param };
  };

  // Collision detection for doors/windows
  const checkOverlap = (wallId, offset, width, type, excludeId) => {
    const min = offset - width / 2;
    const max = offset + width / 2;
    
    // 1. Check Collision with Different Type
    const blockers = type === 'DOOR' 
      ? (data.windows || []).filter(w => w.wallId === wallId) 
      : (data.doors || []).filter(d => d.wallId === wallId);
      
    for (const b of blockers) {
      const bMin = b.offset - b.width / 2;
      const bMax = b.offset + b.width / 2;
      
      if (Math.max(min, bMin) < Math.min(max, bMax)) {
        return { hasCollision: true };
      }
    }

    // 2. Check Merge with Same Type
    const sameType = type === 'DOOR' 
      ? (data.doors || []).filter(d => d.wallId === wallId && d.id !== excludeId)
      : (data.windows || []).filter(w => w.wallId === wallId && w.id !== excludeId);
      
    let newMin = min;
    let newMax = max;
    const idsToDelete = [];
    let hasMerge = false;

    for (const s of sameType) {
      const sMin = s.offset - s.width / 2;
      const sMax = s.offset + s.width / 2;
      
      if (Math.max(newMin, sMin) < Math.min(newMax, sMax)) {
        hasMerge = true;
        newMin = Math.min(newMin, sMin);
        newMax = Math.max(newMax, sMax);
        idsToDelete.push(s.id);
      }
    }

    if (hasMerge) {
      const mergedWidth = newMax - newMin;
      const mergedOffset = newMin + mergedWidth / 2;
      return { hasCollision: false, mergedWidth, mergedOffset, idsToDelete };
    }

    return { hasCollision: false };
  };

  // Sync inputs with selection
  useEffect(() => {
    if (selectedWallId) {
        const wall = data.walls.find(w => w.id === selectedWallId);
        if (wall) {
            const start = getPoint(wall.startPointId);
            const end = getPoint(wall.endPointId);
            if (start && end) {
                const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
                setWallLengthInput((length / PIXELS_PER_METER).toFixed(2));
                setWallHeightInput((wall.height || DEFAULT_WALL_HEIGHT).toString());
                setWallThicknessInput((wall.thickness / PIXELS_PER_METER).toFixed(2));
                setWallTextureInput(wall.texture || 'default');
            }
        }
    } else if (selectedDoorId && data.doors) {
      const door = data.doors.find(d => d.id === selectedDoorId);
      if (door) {
        setDoorWidthInput((door.width / PIXELS_PER_METER).toFixed(2));
        setDoorHeightInput(door.height.toString());
      }
    } else if (selectedWindowId && data.windows) {
      const win = data.windows.find(w => w.id === selectedWindowId);
      if (win) {
        setWindowWidthInput((win.width / PIXELS_PER_METER).toFixed(2));
        setWindowHeightInput(win.height.toString());
        setWindowElevationInput(win.heightFromGround.toString());
      }
    }
  }, [selectedWallId, selectedDoorId, selectedWindowId, data, getPoint]);

  // --- Handlers ---

  const handleWheel = (e) => {
    const scaleFactor = 0.001;
    const delta = -e.deltaY * scaleFactor;
    const newZoom = Math.min(Math.max(0.1, zoom + delta * zoom), 5);

    if (!svgRef.current) return;
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return;
    
    const mouseX = (e.clientX - CTM.e) / CTM.a;
    const mouseY = (e.clientY - CTM.f) / CTM.d;

    const worldX = (mouseX - pan.x) / zoom;
    const worldY = (mouseY - pan.y) / zoom;

    const newPanX = mouseX - worldX * newZoom;
    const newPanY = mouseY - worldY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleZoomBtn = (direction) => {
    const factor = 1.2;
    const newZoom = direction > 0 ? Math.min(zoom * factor, 5) : Math.max(zoom / factor, 0.1);
    
    if (!svgRef.current) return;
    const { width, height } = svgRef.current.getBoundingClientRect();
    const cx = width / 2;
    const cy = height / 2;

    const worldX = (cx - pan.x) / zoom;
    const worldY = (cy - pan.y) / zoom;

    const newPanX = cx - worldX * newZoom;
    const newPanY = cy - worldY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };


  const handlePointerMove = (e) => {
    if (isPanning) {
        setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
        return;
    }

    const mousePos = getMousePosition(e);
    const snapped = getSnappedPosition(e);
    setCursorPos(snapped);


    // Opening (Door/Window) Placement Logic
    if (mode === 'DOOR' || mode === 'WINDOW') {
      let closestDist = 20 / zoom;
      let foundWallId = null;
      let foundPos = { x: 0, y: 0 };
      let foundAngle = 0;
      let wallStart = null;

      data.walls.forEach(wall => {
        const start = getPoint(wall.startPointId);
        const end = getPoint(wall.endPointId);
        if (start && end) {
          const { distance, x, y } = pointToLineDistance(mousePos.x, mousePos.y, start.x, start.y, end.x, end.y);
          if (distance < closestDist) {
            closestDist = distance;
            foundWallId = wall.id;
            foundPos = { x, y };
            foundAngle = Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
            wallStart = start;
          }
        }
      });

      if (foundWallId && wallStart) {
        const dist = Math.sqrt(Math.pow(foundPos.x - wallStart.x, 2) + Math.pow(foundPos.y - wallStart.y, 2));
        const width = mode === 'DOOR' ? DEFAULT_DOOR_WIDTH : DEFAULT_WINDOW_WIDTH;
        
        const { hasCollision } = checkOverlap(foundWallId, dist, width, mode === 'DOOR' ? 'DOOR' : 'WINDOW');
        
        setGhostOpening({ 
            ...foundPos, 
            wallId: foundWallId, 
            angle: foundAngle, 
            valid: !hasCollision 
        });
        setHoverWallId(foundWallId);
      } else {
        setGhostOpening(null);
        setHoverWallId(null);
      }
    }

    if (mode === 'SELECT') {
      const draggingOpeningId = draggingDoorId || draggingWindowId;
      if (draggingOpeningId) {
        const isDoor = !!draggingDoorId;
        const list = isDoor ? (data.doors || []) : (data.windows || []);
        const item = list.find(x => x.id === draggingOpeningId);
        const wall = data.walls.find(w => w.id === item?.wallId);

        if (item && wall) {
          const start = getPoint(wall.startPointId);
          const end = getPoint(wall.endPointId);
          if (start && end) {
            const { offsetRatio } = pointToLineDistance(mousePos.x, mousePos.y, start.x, start.y, end.x, end.y);
            const wallLength = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
            const proposedOffset = Math.max(0, Math.min(wallLength, offsetRatio * wallLength));
            
            const collisionResult = checkOverlap(wall.id, proposedOffset, item.width, isDoor ? 'DOOR' : 'WINDOW', item.id);
            
            if (collisionResult.hasCollision) {
                return; 
            }

            if (!hasSavedHistoryRef.current) {
              onUpdate(data, true);
              hasSavedHistoryRef.current = true;
            }

            let finalOffset = proposedOffset;
            let finalWidth = item.width;
            let finalIdsToDelete = [];

            if (collisionResult.mergedWidth && collisionResult.mergedOffset) {
               finalWidth = collisionResult.mergedWidth;
               finalOffset = collisionResult.mergedOffset;
               finalIdsToDelete = collisionResult.idsToDelete || [];
            }

            if (isDoor) {
                let updatedDoors = (data.doors || []).filter(d => !finalIdsToDelete.includes(d.id))
                    .map(d => d.id === draggingDoorId ? { ...d, offset: finalOffset, width: finalWidth } : d);
                onUpdate({ ...data, doors: updatedDoors }, false);
            } else {
                let updatedWindows = (data.windows || []).filter(w => !finalIdsToDelete.includes(w.id))
                    .map(w => w.id === draggingWindowId ? { ...w, offset: finalOffset, width: finalWidth } : w);
                onUpdate({ ...data, windows: updatedWindows }, false);
            }
          }
        }
      } else if (draggingPointId) {
        if (!hasSavedHistoryRef.current) {
            onUpdate(data, true); 
            hasSavedHistoryRef.current = true;
        }
        const updatedPoints = data.points.map(p => 
          p.id === draggingPointId ? { ...p, x: snapped.x, y: snapped.y } : p
        );
        onUpdate({ ...data, points: updatedPoints }, false);
      } else if (draggingWallId && lastMousePos) {
        const dx = snapped.x - lastMousePos.x;
        const dy = snapped.y - lastMousePos.y;

        if (dx !== 0 || dy !== 0) {
            if (!hasSavedHistoryRef.current) {
                onUpdate(data, true);
                hasSavedHistoryRef.current = true;
            }
            const wall = data.walls.find(w => w.id === draggingWallId);
            if (wall) {
                const updatedPoints = data.points.map(p => {
                    if (p.id === wall.startPointId || p.id === wall.endPointId) {
                        return { ...p, x: p.x + dx, y: p.y + dy };
                    }
                    return p;
                });
                onUpdate({ ...data, points: updatedPoints }, false);
                setLastMousePos(snapped);
            }
        }
      }
    }
  };

  const handlePointerUp = (e) => {
    setIsPanning(false);
    setDraggingPointId(null);
    setDraggingWallId(null);
    setDraggingDoorId(null);
    setDraggingWindowId(null);
    setLastMousePos(null);
    hasSavedHistoryRef.current = false; 
    if (e.target instanceof Element) {
      e.target.releasePointerCapture(e.pointerId);
    }
  };

  const handleBackgroundClick = (e) => {
    // Handle Pan Start
    if (mode === 'PAN' || isSpacePressed || e.button === 1) {
        setIsPanning(true);
        e.target.setPointerCapture(e.pointerId);
        return;
    }

    if (mode === 'SELECT') {
      setSelectedWallId(null);
      setSelectedPointId(null);
      setSelectedDoorId(null);
      setSelectedWindowId(null);
    } else if (mode === 'DRAW') {
      const snapped = getSnappedPosition(e);
      onUpdate(data, true);

      const newPoint = {
        id: generateId(),
        x: snapped.x,
        y: snapped.y
      };

      let newWalls = [...data.walls];
      if (activeDrawId) {
        const newWall = {
          id: generateId(),
          startPointId: activeDrawId,
          endPointId: newPoint.id,
          thickness: 10,
          height: DEFAULT_WALL_HEIGHT
        };
        newWalls.push(newWall);
      }

      onUpdate({
        points: [...data.points, newPoint],
        walls: newWalls
      }, false); 
      
      setActiveDrawId(newPoint.id);
    } else if ((mode === 'DOOR' || mode === 'WINDOW') && ghostOpening && ghostOpening.valid) {
      onUpdate(data, true);
      const wall = data.walls.find(w => w.id === ghostOpening.wallId);
      if (wall) {
        const start = getPoint(wall.startPointId);
        if (start) {
          const dist = Math.sqrt(Math.pow(ghostOpening.x - start.x, 2) + Math.pow(ghostOpening.y - start.y, 2));
          
          if (mode === 'DOOR') {
            const { mergedWidth, mergedOffset, idsToDelete } = checkOverlap(wall.id, dist, DEFAULT_DOOR_WIDTH, 'DOOR');
            
            const newDoor = {
                id: generateId(),
                wallId: wall.id,
                offset: mergedOffset ?? dist,
                width: mergedWidth ?? DEFAULT_DOOR_WIDTH,
                height: DEFAULT_DOOR_HEIGHT
            };
            
            const updatedDoors = (data.doors || []).filter(d => !idsToDelete?.includes(d.id));
            onUpdate({ ...data, doors: [...updatedDoors, newDoor] }, false);

          } else {
            const { mergedWidth, mergedOffset, idsToDelete } = checkOverlap(wall.id, dist, DEFAULT_WINDOW_WIDTH, 'WINDOW');

            const newWindow = {
                id: generateId(),
                wallId: wall.id,
                offset: mergedOffset ?? dist,
                width: mergedWidth ?? DEFAULT_WINDOW_WIDTH,
                height: DEFAULT_WINDOW_HEIGHT,
                heightFromGround: DEFAULT_WINDOW_ELEVATION
            };

            const updatedWindows = (data.windows || []).filter(w => !idsToDelete?.includes(w.id));
            onUpdate({ ...data, windows: [...updatedWindows, newWindow] }, false);
          }
        }
      }
    }
  };

  const handlePointDown = (e, pointId) => {
    if (mode === 'PAN' || isSpacePressed || e.button === 1 || mode === 'DOOR' || mode === 'WINDOW') {
        return; 
    }
    
    e.stopPropagation();

    if (mode === 'SELECT') {
      setSelectedWallId(null);
      setSelectedDoorId(null);
      setSelectedWindowId(null);
      setSelectedPointId(pointId);
      setDraggingPointId(pointId);
      e.target.setPointerCapture(e.pointerId);
    } else if (mode === 'DRAW') {
      if (activeDrawId === pointId) {
        setActiveDrawId(null);
      } else if (activeDrawId) {
        onUpdate(data, true);
        const exists = data.walls.some(w => 
          (w.startPointId === activeDrawId && w.endPointId === pointId) ||
          (w.startPointId === pointId && w.endPointId === activeDrawId)
        );

        if (!exists) {
          const newWall = {
            id: generateId(),
            startPointId: activeDrawId,
            endPointId: pointId,
            thickness: 10,
            height: DEFAULT_WALL_HEIGHT
          };
          onUpdate({
            ...data,
            walls: [...data.walls, newWall]
          }, false);
        }
        setActiveDrawId(pointId);
      } else {
        setActiveDrawId(pointId);
      }
    }
  };

  const handleWallDown = (e, wallId) => {
    if (mode === 'PAN' || isSpacePressed || e.button === 1 || mode === 'DOOR' || mode === 'WINDOW') {
        return; 
    }

    e.stopPropagation();
    if (mode === 'SELECT') {
      const snapped = getSnappedPosition(e);
      setSelectedWallId(wallId);
      setSelectedPointId(null);
      setSelectedDoorId(null);
      setSelectedWindowId(null);
      
      setDraggingWallId(wallId);
      setLastMousePos(snapped);
      
      e.target.setPointerCapture(e.pointerId);
    }
  };

  const handleDoorDown = (e, doorId) => {
    if (mode === 'PAN' || isSpacePressed || e.button === 1 || mode === 'DOOR' || mode === 'WINDOW') return;
    e.stopPropagation();

    if (mode === 'SELECT') {
      setSelectedDoorId(doorId);
      setSelectedWallId(null);
      setSelectedPointId(null);
      setSelectedWindowId(null);
      setDraggingDoorId(doorId);
      e.target.setPointerCapture(e.pointerId);
    }
  };

  const handleWindowDown = (e, winId) => {
    if (mode === 'PAN' || isSpacePressed || e.button === 1 || mode === 'DOOR' || mode === 'WINDOW') return;
    e.stopPropagation();

    if (mode === 'SELECT') {
      setSelectedWindowId(winId);
      setSelectedDoorId(null);
      setSelectedWallId(null);
      setSelectedPointId(null);
      setDraggingWindowId(winId);
      e.target.setPointerCapture(e.pointerId);
    }
  };

  const deleteSelection = () => {
    onUpdate(data, true);
    if (selectedWallId) {
      const updatedWalls = data.walls.filter(w => w.id !== selectedWallId);
      const updatedDoors = (data.doors || []).filter(d => d.wallId !== selectedWallId);
      const updatedWindows = (data.windows || []).filter(w => w.wallId !== selectedWallId);
      onUpdate({ ...data, walls: updatedWalls, doors: updatedDoors, windows: updatedWindows }, false);
      setSelectedWallId(null);
    }
    if (selectedPointId) {
      const updatedPoints = data.points.filter(p => p.id !== selectedPointId);
      const connectedWalls = data.walls.filter(w => w.startPointId === selectedPointId || w.endPointId === selectedPointId);
      const connectedWallIds = connectedWalls.map(w => w.id);
      
      const remainingWalls = data.walls.filter(w => !connectedWallIds.includes(w.id));
      const remainingDoors = (data.doors || []).filter(d => !connectedWallIds.includes(d.wallId));
      const remainingWindows = (data.windows || []).filter(w => !connectedWallIds.includes(w.wallId));

      onUpdate({ points: updatedPoints, walls: remainingWalls, doors: remainingDoors, windows: remainingWindows }, false);
      setSelectedPointId(null);
    }
    if (selectedDoorId) {
      const updatedDoors = (data.doors || []).filter(d => d.id !== selectedDoorId);
      onUpdate({ ...data, doors: updatedDoors }, false);
      setSelectedDoorId(null);
    }
    if (selectedWindowId) {
      const updatedWindows = (data.windows || []).filter(w => w.id !== selectedWindowId);
      onUpdate({ ...data, windows: updatedWindows }, false);
      setSelectedWindowId(null);
    }
  };

  // --- Property Updates ---

  const applyWallChanges = (overrides) => {
    if (!selectedWallId) return;
    onUpdate(data, true);

    const lengthMeters = parseFloat(wallLengthInput);
    const heightMeters = parseFloat(wallHeightInput);
    const thicknessMeters = parseFloat(wallThicknessInput);
    const newTexture = overrides?.texture ?? wallTextureInput;
    
    let updatedWalls = data.walls.map(w => {
        if (w.id === selectedWallId) {
            return {
                ...w,
                height: isNaN(heightMeters) ? (w.height || DEFAULT_WALL_HEIGHT) : heightMeters,
                thickness: (!isNaN(thicknessMeters) && thicknessMeters > 0) ? thicknessMeters * PIXELS_PER_METER : w.thickness,
                texture: newTexture
            };
        }
        return w;
    });

    if (!isNaN(lengthMeters) && lengthMeters > 0) {
      const wall = data.walls.find(w => w.id === selectedWallId);
      if (wall) {
        const start = getPoint(wall.startPointId);
        const end = getPoint(wall.endPointId);
        if (start && end) {
          const currentLength = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
          if (currentLength > 0.001) {
            const newLengthPixels = lengthMeters * PIXELS_PER_METER;
            const dirX = (end.x - start.x) / currentLength;
            const dirY = (end.y - start.y) / currentLength;
            const newEndX = start.x + dirX * newLengthPixels;
            const newEndY = start.y + dirY * newLengthPixels;
            
            const updatedPoints = data.points.map(p => 
              p.id === end.id ? { ...p, x: newEndX, y: newEndY } : p
            );
            onUpdate({ ...data, walls: updatedWalls, points: updatedPoints }, false);
            return;
          }
        }
      }
    }
    onUpdate({ ...data, walls: updatedWalls }, false);
  };

  const applyDoorChanges = () => {
    if (!selectedDoorId) return;
    onUpdate(data, true);
    const widthMeters = parseFloat(doorWidthInput);
    const heightMeters = parseFloat(doorHeightInput);

    const updatedDoors = (data.doors || []).map(d => {
      if (d.id === selectedDoorId) {
        return {
          ...d,
          width: (!isNaN(widthMeters) && widthMeters > 0) ? widthMeters * PIXELS_PER_METER : d.width,
          height: (!isNaN(heightMeters) && heightMeters > 0) ? heightMeters : d.height
        }
      }
      return d;
    });
    onUpdate({ ...data, doors: updatedDoors }, false);
  };

  const applyWindowChanges = () => {
    if (!selectedWindowId) return;
    onUpdate(data, true);
    const widthMeters = parseFloat(windowWidthInput);
    const heightMeters = parseFloat(windowHeightInput);
    const elevationMeters = parseFloat(windowElevationInput);

    const updatedWindows = (data.windows || []).map(w => {
      if (w.id === selectedWindowId) {
        return {
          ...w,
          width: (!isNaN(widthMeters) && widthMeters > 0) ? widthMeters * PIXELS_PER_METER : w.width,
          height: (!isNaN(heightMeters) && heightMeters > 0) ? heightMeters : w.height,
          heightFromGround: (!isNaN(elevationMeters) && elevationMeters >= 0) ? elevationMeters : w.heightFromGround
        }
      }
      return w;
    });
    onUpdate({ ...data, windows: updatedWindows }, false);
  };


  // Handle Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }

      // Mode shortcuts
      if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        if (e.key === 'v' || e.key === 'V') {
          setMode('SELECT');
          setActiveDrawId(null);
        } else if (e.key === 'p' || e.key === 'P') {
          setMode('DRAW');
          setSelectedWallId(null);
          setSelectedPointId(null);
        } else if (e.key === 'h' || e.key === 'H') {
          setMode('PAN');
          setSelectedWallId(null);
          setSelectedPointId(null);
          setActiveDrawId(null);
        } else if (e.key === 'd' || e.key === 'D') {
          setMode('DOOR');
          setSelectedWallId(null);
          setSelectedPointId(null);
        } else if (e.key === 'w' || e.key === 'W') {
          setMode('WINDOW');
          setSelectedWallId(null);
          setSelectedPointId(null);
        }
      }

      if (mode === 'SELECT') {
        if ((e.key === 'Delete' || e.key === 'Backspace')) {
           if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
             deleteSelection();
           }
        }
      } else if (mode === 'DRAW' || mode === 'DOOR' || mode === 'WINDOW') {
        if (e.key === 'Escape') {
          setActiveDrawId(null);
          setMode('SELECT');
        }
      }
    };

    const handleKeyUp = (e) => {
        if (e.code === 'Space') {
            setIsSpacePressed(false);
            if (isPanning) setIsPanning(false);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedWallId, selectedPointId, selectedDoorId, selectedWindowId, mode, data, onUpdate, isPanning]);

  const activePoint = activeDrawId ? getPoint(activeDrawId) : null;

  // Determine Cursor
  let cursorClass = 'cursor-default';
  if (isPanning) cursorClass = 'cursor-grabbing';
  else if (mode === 'PAN' || isSpacePressed) cursorClass = 'cursor-grab';
  else if (mode === 'DRAW') cursorClass = 'cursor-crosshair';
  else if (mode === 'DOOR' || mode === 'WINDOW') cursorClass = 'cursor-copy';
  else if (draggingWallId || draggingPointId || draggingDoorId || draggingWindowId) cursorClass = 'cursor-move';

  return (
    <Box sx={{ width: '100%', height: '100%', bgcolor: '#ffffff', position: 'relative', overflow: 'hidden', userSelect: 'none' }}>
      {/* Grid Background */}
      <Box 
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          opacity: 0.3,
          backgroundImage: `linear-gradient(#d0d0d0 1px, transparent 1px), linear-gradient(90deg, #d0d0d0 1px, transparent 1px)`,
          backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`
        }}
      />
      
      <svg
        ref={svgRef}
        style={{
          width: '100%',
          height: '100%',
          touchAction: 'none',
          cursor: cursorClass === 'cursor-grabbing' ? 'grabbing' :
                  cursorClass === 'cursor-grab' ? 'grab' :
                  cursorClass === 'cursor-crosshair' ? 'crosshair' :
                  (mode === 'DOOR' || mode === 'WINDOW') ? 'copy' :
                  (draggingWallId || draggingPointId || draggingDoorId || draggingWindowId) ? 'move' : 'default'
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerDown={handleBackgroundClick}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()} 
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Existing Walls */}
          {data.walls.map(wall => {
            const start = getPoint(wall.startPointId);
            const end = getPoint(wall.endPointId);
            if (!start || !end) return null;
            
            const isSelected = wall.id === selectedWallId;
            const isDragging = wall.id === draggingWallId;

            return (
              <g key={wall.id} onPointerDown={(e) => handleWallDown(e, wall.id)}>
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="transparent"
                  strokeWidth={30}
                  style={{ cursor: mode === 'SELECT' && !isSpacePressed ? 'move' : 'pointer' }}
                />
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={isSelected ? "#ef4444" : (isDragging ? "#3b82f6" : ((mode === 'DOOR' || mode === 'WINDOW') && hoverWallId === wall.id ? "#60a5fa" : (() => {
                    const texture = WALL_TEXTURES.find(t => t.id === (wall.texture || 'default'));
                    return texture ? texture.color : "#94a3b8";
                  })()))}
                  strokeWidth={wall.thickness}
                  strokeLinecap="round"
                  style={{ 
                    opacity: isSelected ? 1 : 0.8,
                    transition: 'opacity 0.2s'
                  }}
                />
              </g>
            );
          })}

          {/* Windows */}
          {data.walls.map(wall => {
              const start = getPoint(wall.startPointId);
              const end = getPoint(wall.endPointId);
              if (!start || !end) return null;
              
              const angle = Math.atan2(end.y - start.y, end.x - start.x);
              const wallWindows = (data.windows || []).filter(w => w.wallId === wall.id);

              return wallWindows.map(win => {
                  const dx = Math.cos(angle) * win.offset;
                  const dy = Math.sin(angle) * win.offset;
                  const cx = start.x + dx;
                  const cy = start.y + dy;
                  const isSelected = selectedWindowId === win.id;
                  
                  return (
                      <g key={win.id} transform={`translate(${cx}, ${cy}) rotate(${angle * 180 / Math.PI})`}
                          onPointerDown={(e) => handleWindowDown(e, win.id)}
                          style={{ cursor: mode === 'SELECT' ? 'move' : 'default' }}
                      >
                           <rect x={-win.width / 2} y={-wall.thickness/2 - 1} width={win.width} height={wall.thickness + 2} fill="#ffffff" stroke={isSelected ? "#ef4444" : "none"} strokeWidth={2} />
                           <line x1={-win.width/2} y1={-2} x2={win.width/2} y2={-2} stroke="#64748b" strokeWidth={1} />
                           <line x1={-win.width/2} y1={2} x2={win.width/2} y2={2} stroke="#64748b" strokeWidth={1} />
                      </g>
                  )
              });
          })}

          {/* Doors */}
          {data.walls.map(wall => {
             const start = getPoint(wall.startPointId);
             const end = getPoint(wall.endPointId);
             if (!start || !end) return null;
             
             const angle = Math.atan2(end.y - start.y, end.x - start.x);
             const wallDoors = (data.doors || []).filter(d => d.wallId === wall.id);

             return wallDoors.map(door => {
                const dx = Math.cos(angle) * door.offset;
                const dy = Math.sin(angle) * door.offset;
                const cx = start.x + dx;
                const cy = start.y + dy;
                const isSelected = selectedDoorId === door.id;

                return (
                   <g key={door.id} transform={`translate(${cx}, ${cy}) rotate(${angle * 180 / Math.PI})`} 
                      onPointerDown={(e) => handleDoorDown(e, door.id)}
                      style={{ cursor: mode === 'SELECT' ? 'move' : 'default' }}
                   >
                      <rect x={-door.width / 2} y={-wall.thickness/2 - 2} width={door.width} height={wall.thickness + 4} fill="#ffffff" />
                      <rect x={-door.width / 2} y={-wall.thickness/2} width={door.width} height={wall.thickness} 
                            fill={isSelected ? "#ef4444" : "#cbd5e1"} 
                            opacity={isSelected ? 0.8 : 0.5} 
                            stroke={isSelected ? "#fff" : "none"}
                            strokeWidth={2}
                      />
                      <path d={`M ${-door.width/2} ${-wall.thickness/2} Q ${-door.width/2} ${-door.width} ${door.width/2} ${-door.width}`} fill="none" stroke="#64748b" strokeWidth={1} strokeDasharray="2 2" />
                      <line x1={-door.width/2} y1={-wall.thickness/2} x2={-door.width/2} y2={-door.width} stroke="#cbd5e1" strokeWidth={2} />
                   </g>
                );
             });
          })}

          {/* Ghost Opening (Placement Mode) */}
          {ghostOpening && (
             <g transform={`translate(${ghostOpening.x}, ${ghostOpening.y}) rotate(${ghostOpening.angle})`} style={{ pointerEvents: 'none' }}>
                 <rect x={-10} y={-6} width={20} height={12} fill={ghostOpening.valid ? "#60a5fa" : "#ef4444"} opacity={0.7} />
             </g>
          )}

          {/* Ghost Wall (Draw Mode) */}
          {mode === 'DRAW' && activePoint && cursorPos && (
            <line
              x1={activePoint.x}
              y1={activePoint.y}
              x2={cursorPos.x}
              y2={cursorPos.y}
              stroke="#3b82f6"
              strokeWidth={4}
              strokeDasharray="8 4"
              style={{ opacity: 0.6, pointerEvents: 'none' }}
            />
          )}

          {/* Points */}
          {data.points.map(point => {
            const isSelected = selectedPointId === point.id;
            return (
              <circle
                key={point.id}
                cx={point.x}
                cy={point.y}
                r={draggingPointId === point.id || hoverPointId === point.id || activeDrawId === point.id || isSelected ? 8 : 6}
                fill={isSelected ? "#ef4444" : (activeDrawId === point.id ? "#10b981" : (draggingPointId === point.id ? "#3b82f6" : "#f8fafc"))}
                stroke="#0f172a"
                strokeWidth={2}
                style={{ 
                  cursor: mode === 'SELECT' && !isSpacePressed ? 'move' : 'default',
                  transition: 'all 0.2s'
                }}
                onPointerDown={(e) => handlePointDown(e, point.id)}
                onPointerEnter={() => setHoverPointId(point.id)}
                onPointerLeave={() => setHoverPointId(null)}
              />
            );
          })}

          {/* Measurements */}
          {data.walls.map(wall => {
             const start = getPoint(wall.startPointId);
             const end = getPoint(wall.endPointId);
             if (!start || !end) return null;
             
             const mx = (start.x + end.x) / 2;
             const my = (start.y + end.y) / 2;
             const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
             const lengthInMeters = (length / PIXELS_PER_METER).toFixed(1);

             return (
               <text
                 key={`text-${wall.id}`}
                 x={mx}
                 y={my - 10}
                 textAnchor="middle"
                 fill={wall.id === selectedWallId ? "#ef4444" : "#94a3b8"}
                 fontSize="10"
                 style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'monospace' }}
               >
                 {lengthInMeters}m
               </text>
             )
          })}
        </g>
      </svg>
      
      {/* Editor Overlay UI */}
      <Box sx={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pointerEvents: 'none' }}>
        <Box sx={{ display: 'flex', gap: 1, pointerEvents: 'auto', alignItems: 'flex-end' }}>
             {/* Mode Toggle */}
             <Box sx={{ bgcolor: '#f5f5f5', borderRadius: 2, p: 0.5, display: 'flex', border: '1px solid #e0e0e0', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <IconButton
                  onClick={() => { setMode('SELECT'); setActiveDrawId(null); }}
                  sx={{ 
                    p: 1,
                    borderRadius: 1,
                    color: mode === 'SELECT' ? 'white' : '#666',
                    bgcolor: mode === 'SELECT' ? '#e16789' : 'transparent',
                    '&:hover': { 
                      color: 'white', 
                      bgcolor: mode === 'SELECT' ? '#d1537a' : '#e0e0e0' 
                    },
                    transition: 'all 0.2s'
                  }}
                  title="Select Mode (V)"
                >
                  <MousePointer2Icon sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton
                  onClick={() => { setMode('DRAW'); setSelectedWallId(null); setSelectedPointId(null); }}
                  sx={{ 
                    p: 1,
                    borderRadius: 1,
                    color: mode === 'DRAW' ? 'white' : '#666',
                    bgcolor: mode === 'DRAW' ? '#e16789' : 'transparent',
                    '&:hover': { 
                      color: 'white', 
                      bgcolor: mode === 'DRAW' ? '#d1537a' : '#e0e0e0' 
                    },
                    transition: 'all 0.2s'
                  }}
                  title="Draw Mode (P)"
                >
                  <PenToolIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton
                  onClick={() => { setMode('DOOR'); setSelectedWallId(null); setSelectedPointId(null); }}
                  sx={{ 
                    p: 1,
                    borderRadius: 1,
                    color: mode === 'DOOR' ? 'white' : '#666',
                    bgcolor: mode === 'DOOR' ? '#e16789' : 'transparent',
                    '&:hover': { 
                      color: 'white', 
                      bgcolor: mode === 'DOOR' ? '#d1537a' : '#e0e0e0' 
                    },
                    transition: 'all 0.2s'
                  }}
                  title="Add Door (D)"
                >
                  <DoorIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton
                  onClick={() => { setMode('WINDOW'); setSelectedWallId(null); setSelectedPointId(null); }}
                  sx={{ 
                    p: 1,
                    borderRadius: 1,
                    color: mode === 'WINDOW' ? 'white' : '#666',
                    bgcolor: mode === 'WINDOW' ? '#e16789' : 'transparent',
                    '&:hover': { 
                      color: 'white', 
                      bgcolor: mode === 'WINDOW' ? '#d1537a' : '#e0e0e0' 
                    },
                    transition: 'all 0.2s'
                  }}
                  title="Add Window (W)"
                >
                  <WindowIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton
                  onClick={() => { setMode('PAN'); setSelectedWallId(null); setSelectedPointId(null); setActiveDrawId(null); }}
                  sx={{ 
                    p: 1,
                    borderRadius: 1,
                    color: mode === 'PAN' ? 'white' : '#666',
                    bgcolor: mode === 'PAN' ? '#e16789' : 'transparent',
                    '&:hover': { 
                      color: 'white', 
                      bgcolor: mode === 'PAN' ? '#d1537a' : '#e0e0e0' 
                    },
                    transition: 'all 0.2s'
                  }}
                  title="Pan Tool (H)"
                >
                  <HandIcon sx={{ fontSize: 18 }} />
                </IconButton>
             </Box>

             {/* Zoom Controls */}
             <Box sx={{ bgcolor: '#f5f5f5', borderRadius: 2, p: 0.5, display: 'flex', border: '1px solid #e0e0e0', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <IconButton
                  onClick={() => handleZoomBtn(1)}
                  sx={{ 
                    p: 1,
                    borderRadius: 1,
                    color: '#666',
                    '&:hover': { 
                      color: '#333', 
                      bgcolor: '#e0e0e0' 
                    },
                    transition: 'all 0.2s'
                  }}
                  title="Zoom In"
                >
                  <ZoomIn sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton
                  onClick={() => handleZoomBtn(-1)}
                  sx={{ 
                    p: 1,
                    borderRadius: 1,
                    color: '#666',
                    '&:hover': { 
                      color: '#333', 
                      bgcolor: '#e0e0e0' 
                    },
                    transition: 'all 0.2s'
                  }}
                  title="Zoom Out"
                >
                  <ZoomOut sx={{ fontSize: 18 }} />
                </IconButton>
             </Box>

             {/* Property Panels */}
             {(selectedWallId || selectedDoorId || selectedWindowId) && mode === 'SELECT' && (
                 <Box sx={{ 
                   bgcolor: '#f8f9fa', 
                   p: 1.5, 
                   borderRadius: 2, 
                   border: '1px solid #e0e0e0', 
                   boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                   pointerEvents: 'auto',
                   display: 'flex',
                   flexDirection: 'column',
                   gap: 1,
                   minWidth: 200
                 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', mb: 0.5 }}>
                      {selectedWallId ? 'Wall Properties' : selectedDoorId ? 'Door Properties' : 'Window Properties'}
                    </Typography>
                    
                    {selectedWallId ? (
                        <>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>Length:</Typography>
                                <Box component="form" onSubmit={(e) => { e.preventDefault(); applyWallChanges(); }} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <TextField type="number" inputProps={{ step: 0.1 }} value={wallLengthInput} 
                                        onChange={(e) => setWallLengthInput(e.target.value)} onBlur={() => applyWallChanges()} 
                                        size="small" sx={{ width: 64, '& .MuiOutlinedInput-root': { bgcolor: '#ffffff', fontSize: '0.75rem', height: 28 } }} />
                                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>m</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>Height:</Typography>
                                <Box component="form" onSubmit={(e) => { e.preventDefault(); applyWallChanges(); }} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <TextField type="number" inputProps={{ step: 0.1 }} value={wallHeightInput} 
                                        onChange={(e) => setWallHeightInput(e.target.value)} onBlur={() => applyWallChanges()} 
                                        size="small" sx={{ width: 64, '& .MuiOutlinedInput-root': { bgcolor: '#ffffff', fontSize: '0.75rem', height: 28 } }} />
                                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>m</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>Thickness:</Typography>
                                <Box component="form" onSubmit={(e) => { e.preventDefault(); applyWallChanges(); }} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <TextField type="number" inputProps={{ step: 0.1 }} value={wallThicknessInput} 
                                        onChange={(e) => setWallThicknessInput(e.target.value)} onBlur={() => applyWallChanges()} 
                                        size="small" sx={{ width: 64, '& .MuiOutlinedInput-root': { bgcolor: '#ffffff', fontSize: '0.75rem', height: 28 } }} />
                                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>m</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>Texture:</Typography>
                                <Select value={wallTextureInput} onChange={(e) => { setWallTextureInput(e.target.value); applyWallChanges({ texture: e.target.value }); }}
                                    size="small" sx={{ width: '100%', bgcolor: '#ffffff', fontSize: '0.75rem', height: 28 }}>
                                    {WALL_TEXTURES.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                                </Select>
                            </Box>
                        </>
                    ) : selectedDoorId ? (
                        <>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>Width:</Typography>
                                <Box component="form" onSubmit={(e) => { e.preventDefault(); applyDoorChanges(); }} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <TextField type="number" inputProps={{ step: 0.1 }} value={doorWidthInput} 
                                        onChange={(e) => setDoorWidthInput(e.target.value)} onBlur={applyDoorChanges} 
                                        size="small" sx={{ width: 64, '& .MuiOutlinedInput-root': { bgcolor: '#ffffff', fontSize: '0.75rem', height: 28 } }} />
                                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>m</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>Height:</Typography>
                                <Box component="form" onSubmit={(e) => { e.preventDefault(); applyDoorChanges(); }} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <TextField type="number" inputProps={{ step: 0.1 }} value={doorHeightInput} 
                                        onChange={(e) => setDoorHeightInput(e.target.value)} onBlur={applyDoorChanges} 
                                        size="small" sx={{ width: 64, '& .MuiOutlinedInput-root': { bgcolor: '#ffffff', fontSize: '0.75rem', height: 28 } }} />
                                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>m</Typography>
                                </Box>
                            </Box>
                        </>
                    ) : selectedWindowId ? (
                        <>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>Width:</Typography>
                                <Box component="form" onSubmit={(e) => { e.preventDefault(); applyWindowChanges(); }} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <TextField type="number" inputProps={{ step: 0.1 }} value={windowWidthInput} 
                                        onChange={(e) => setWindowWidthInput(e.target.value)} onBlur={applyWindowChanges} 
                                        size="small" sx={{ width: 64, '& .MuiOutlinedInput-root': { bgcolor: '#ffffff', fontSize: '0.75rem', height: 28 } }} />
                                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>m</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>Height:</Typography>
                                <Box component="form" onSubmit={(e) => { e.preventDefault(); applyWindowChanges(); }} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <TextField type="number" inputProps={{ step: 0.1 }} value={windowHeightInput} 
                                        onChange={(e) => setWindowHeightInput(e.target.value)} onBlur={applyWindowChanges} 
                                        size="small" sx={{ width: 64, '& .MuiOutlinedInput-root': { bgcolor: '#ffffff', fontSize: '0.75rem', height: 28 } }} />
                                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>m</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>Elevation:</Typography>
                                <Box component="form" onSubmit={(e) => { e.preventDefault(); applyWindowChanges(); }} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <TextField type="number" inputProps={{ step: 0.1 }} value={windowElevationInput} 
                                        onChange={(e) => setWindowElevationInput(e.target.value)} onBlur={applyWindowChanges} 
                                        size="small" sx={{ width: 64, '& .MuiOutlinedInput-root': { bgcolor: '#ffffff', fontSize: '0.75rem', height: 28 } }} />
                                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>m</Typography>
                                </Box>
                            </Box>
                        </>
                    ) : null}
                 </Box>
             )}

             <Box sx={{ 
               bgcolor: '#f8f9fa', 
               p: 1.5, 
               borderRadius: 2, 
               fontSize: '0.75rem', 
               color: '#333', 
               border: '1px solid #e0e0e0',
               display: { xs: 'none', sm: 'block' }
             }}>
                {mode === 'SELECT' ? (
                  <>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#e16789', mb: 0.5, display: 'block' }}>
                      Select Mode
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#666' }}>Drag to move. Click to select.</Typography>
                    <Typography variant="caption" sx={{ color: '#999', mt: 0.5, display: 'block' }}>
                      Hold Space to Pan.
                    </Typography>
                  </>
                ) : mode === 'DRAW' ? (
                  <>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#e16789', mb: 0.5, display: 'block' }}>
                      Draw Mode
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#666' }}>Click to add walls.</Typography>
                    <Typography variant="caption" sx={{ color: '#999', mt: 0.5, display: 'block' }}>
                      ESC to stop.
                    </Typography>
                  </>
                ) : mode === 'DOOR' ? (
                  <>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#e16789', mb: 0.5, display: 'block' }}>
                      Door Mode
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#666' }}>Click on walls to place doors.</Typography>
                    <Typography variant="caption" sx={{ color: '#999', mt: 0.5, display: 'block' }}>
                      ESC to cancel.
                    </Typography>
                  </>
                ) : mode === 'WINDOW' ? (
                  <>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#e16789', mb: 0.5, display: 'block' }}>
                      Window Mode
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#666' }}>Click on walls to place windows.</Typography>
                    <Typography variant="caption" sx={{ color: '#999', mt: 0.5, display: 'block' }}>
                      ESC to cancel.
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#e16789', mb: 0.5, display: 'block' }}>
                      Pan Mode
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#666' }}>Drag canvas to move.</Typography>
                  </>
                )}
            </Box>
        </Box>

        {mode === 'SELECT' && (selectedWallId || selectedPointId || selectedDoorId || selectedWindowId) && (
          <Button
            onClick={deleteSelection}
            variant="contained"
            color="error"
            startIcon={<Trash2Icon sx={{ fontSize: 16 }} />}
            sx={{ 
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: '#dc2626',
              '&:hover': { bgcolor: '#b91c1c' },
              px: 2,
              py: 1,
              borderRadius: 2,
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s',
              '&:active': { transform: 'scale(0.95)' },
              textTransform: 'none'
            }}
          >
            {selectedWallId ? 'Delete Wall' : selectedPointId ? 'Delete Corner' : selectedDoorId ? 'Delete Door' : 'Delete Window'}
          </Button>
        )}
      </Box>
    </Box>
  );
};

