import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, IconButton, TextField, Typography } from '@mui/material';
import { Delete as Trash2Icon, Edit as PenToolIcon, OpenWith as MousePointer2Icon, Check as CheckIcon, PanTool as HandIcon } from '@mui/icons-material';

const GRID_SIZE = 20;
const generateId = () => Math.random().toString(36).substr(2, 9);

export const FloorplanEditor = ({ data, onUpdate }) => {
  const svgRef = useRef(null);
  
  // Modes: 'SELECT' | 'DRAW' | 'PAN'
  const [mode, setMode] = useState('SELECT');
  
  // Pan State
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Select Mode State
  const [draggingPointId, setDraggingPointId] = useState(null);
  const [draggingWallId, setDraggingWallId] = useState(null);
  const [lastMousePos, setLastMousePos] = useState(null);
  const hasSavedHistoryRef = useRef(false);

  const [hoverPointId, setHoverPointId] = useState(null);
  
  const [selectedWallId, setSelectedWallId] = useState(null);
  const [selectedPointId, setSelectedPointId] = useState(null);

  // Manual Length Input State
  const [wallLengthInput, setWallLengthInput] = useState("");

  // Draw Mode State
  const [activeDrawId, setActiveDrawId] = useState(null);
  const [cursorPos, setCursorPos] = useState(null);

  // --- Utils ---

  const getMousePosition = (evt) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    // Calculate screen-space coordinates first
    const screenX = (evt.clientX - CTM.e) / CTM.a;
    const screenY = (evt.clientY - CTM.f) / CTM.d;
    // Apply pan offset to get "world" coordinates
    return {
      x: screenX - pan.x,
      y: screenY - pan.y
    };
  };

  const getSnappedPosition = (evt) => {
    const pos = getMousePosition(evt);
    return {
      x: Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(pos.y / GRID_SIZE) * GRID_SIZE
    };
  };

  const getPoint = (id) => data.points.find(p => p.id === id);

  // Update Wall Length Input when selection changes
  useEffect(() => {
    if (selectedWallId) {
        const wall = data.walls.find(w => w.id === selectedWallId);
        if (wall) {
            const start = getPoint(wall.startPointId);
            const end = getPoint(wall.endPointId);
            if (start && end) {
                const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
                const lengthInMeters = (length / 20).toFixed(2);
                setWallLengthInput(lengthInMeters);
            }
        }
    }
  }, [selectedWallId, data]);

  // --- Handlers ---

  const handlePointerMove = (e) => {
    if (isPanning) {
        setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
        return;
    }

    const snapped = getSnappedPosition(e);
    setCursorPos(snapped);

    if (mode === 'SELECT') {
      if (draggingPointId) {
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
    if (isPanning) {
        setIsPanning(false);
    }

    if (mode === 'SELECT') {
      setDraggingPointId(null);
      setDraggingWallId(null);
      setLastMousePos(null);
      hasSavedHistoryRef.current = false; 
      if (e.target instanceof Element) {
        e.target.releasePointerCapture(e.pointerId);
      }
    }
  };

  const handleBackgroundClick = (e) => {
    // Handle Pan Start
    if (mode === 'PAN' || isSpacePressed || e.button === 1) { // 1 = Middle Mouse
        setIsPanning(true);
        e.target.setPointerCapture(e.pointerId);
        return;
    }

    if (mode === 'SELECT') {
      setSelectedWallId(null);
      setSelectedPointId(null);
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
          thickness: 10
        };
        newWalls.push(newWall);
      }

      onUpdate({
        points: [...data.points, newPoint],
        walls: newWalls
      }, false); 
      
      setActiveDrawId(newPoint.id);
    }
  };

  const handlePointDown = (e, pointId) => {
    if (mode === 'PAN' || isSpacePressed || e.button === 1) {
        // Pass through to background handler for panning
        return; 
    }
    
    e.stopPropagation();

    if (mode === 'SELECT') {
      setSelectedWallId(null);
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
            thickness: 10
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
    if (mode === 'PAN' || isSpacePressed || e.button === 1) {
        return; 
    }

    e.stopPropagation();
    if (mode === 'SELECT') {
      const snapped = getSnappedPosition(e);
      setSelectedWallId(wallId);
      setSelectedPointId(null);
      
      setDraggingWallId(wallId);
      setLastMousePos(snapped);
      
      e.target.setPointerCapture(e.pointerId);
    }
  };

  const deleteSelection = () => {
    onUpdate(data, true);

    if (selectedWallId) {
      const updatedWalls = data.walls.filter(w => w.id !== selectedWallId);
      onUpdate({ ...data, walls: updatedWalls }, false);
      setSelectedWallId(null);
    }
    if (selectedPointId) {
      const updatedPoints = data.points.filter(p => p.id !== selectedPointId);
      const updatedWalls = data.walls.filter(w => w.startPointId !== selectedPointId && w.endPointId !== selectedPointId);
      onUpdate({ points: updatedPoints, walls: updatedWalls }, false);
      setSelectedPointId(null);
    }
  };

  // Handle Manual Length Change Logic
  const applyLengthChange = () => {
    if (!selectedWallId || !wallLengthInput) return;

    const wall = data.walls.find(w => w.id === selectedWallId);
    if (!wall) return;

    const start = getPoint(wall.startPointId);
    const end = getPoint(wall.endPointId);
    if (!start || !end) return;

    const newLengthMeters = parseFloat(wallLengthInput);
    if (isNaN(newLengthMeters) || newLengthMeters <= 0) return;

    const newLengthPixels = newLengthMeters * 20; 

    const currentLength = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    
    let dirX = 1, dirY = 0;
    if (currentLength > 0.001) {
        dirX = (end.x - start.x) / currentLength;
        dirY = (end.y - start.y) / currentLength;
    }

    const newEndX = start.x + dirX * newLengthPixels;
    const newEndY = start.y + dirY * newLengthPixels;

    if (Math.abs(newEndX - end.x) < 0.1 && Math.abs(newEndY - end.y) < 0.1) return;

    onUpdate(data, true);

    const updatedPoints = data.points.map(p => 
        p.id === end.id ? { ...p, x: newEndX, y: newEndY } : p
    );

    onUpdate({ ...data, points: updatedPoints }, false);
  };

  const handleLengthSubmit = (e) => {
    e.preventDefault();
    applyLengthChange();
  };

  // Handle Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }

      if (mode === 'SELECT') {
        if ((e.key === 'Delete' || e.key === 'Backspace')) {
           if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
             deleteSelection();
           }
        }
      } else if (mode === 'DRAW') {
        if (e.key === 'Escape') {
          setActiveDrawId(null);
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
  }, [selectedWallId, selectedPointId, mode, data, onUpdate, isPanning]);

  const activePoint = activeDrawId ? getPoint(activeDrawId) : null;

  // Determine Cursor
  let cursorClass = 'cursor-default';
  if (isPanning) cursorClass = 'cursor-grabbing';
  else if (mode === 'PAN' || isSpacePressed) cursorClass = 'cursor-grab';
  else if (mode === 'DRAW') cursorClass = 'cursor-crosshair';
  else if (draggingWallId || draggingPointId) cursorClass = 'cursor-move';

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
          backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
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
                  cursorClass === 'cursor-move' ? 'move' : 'default'
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerDown={handleBackgroundClick}
        onContextMenu={(e) => e.preventDefault()} 
      >
        <g transform={`translate(${pan.x}, ${pan.y})`}>
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
                  stroke={isSelected ? "#ef4444" : (isDragging ? "#3b82f6" : "#60a5fa")}
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
             const lengthInMeters = (length / 20).toFixed(1);

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

             {/* Wall Properties (Manual Length) */}
             {selectedWallId && mode === 'SELECT' && (
                 <Box sx={{ 
                   bgcolor: '#f8f9fa', 
                   p: 1.5, 
                   borderRadius: 2, 
                   border: '1px solid #e0e0e0', 
                   boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                   pointerEvents: 'auto',
                   display: 'flex',
                   alignItems: 'center',
                   gap: 1
                 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666', fontWeight: 500, ml: 0.5 }}>
                      Length:
                    </Typography>
                    <Box component="form" onSubmit={handleLengthSubmit} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TextField
                            type="number" 
                            inputProps={{ step: 0.1 }}
                            value={wallLengthInput}
                            onChange={(e) => setWallLengthInput(e.target.value)}
                            onBlur={applyLengthChange}
                            size="small"
                            sx={{ 
                              width: 64,
                              '& .MuiOutlinedInput-root': {
                                bgcolor: '#ffffff',
                                borderColor: '#e0e0e0',
                                color: '#333',
                                fontSize: '0.75rem',
                                height: 28,
                                '& fieldset': { borderColor: '#e0e0e0' },
                                '&:hover fieldset': { borderColor: '#e16789' },
                                '&.Mui-focused fieldset': { borderColor: '#e16789' }
                              }
                            }}
                        />
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666' }}>m</Typography>
                        <IconButton 
                          type="submit" 
                          sx={{ 
                            ml: 0.5, 
                            p: 0.5, 
                            bgcolor: '#e16789', 
                            color: 'white',
                            '&:hover': { bgcolor: '#d1537a' },
                            transition: 'all 0.2s'
                          }}
                          title="Apply Length"
                        >
                          <CheckIcon sx={{ fontSize: 12 }} />
                        </IconButton> 
                    </Box>
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

        {mode === 'SELECT' && (selectedWallId || selectedPointId) && (
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
            {selectedWallId ? 'Delete Wall' : 'Delete Corner'}
          </Button>
        )}
      </Box>
    </Box>
  );
};

