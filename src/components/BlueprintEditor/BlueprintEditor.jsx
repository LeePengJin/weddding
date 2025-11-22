import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Box, Button, IconButton, Typography, Snackbar, Alert } from '@mui/material';
import { Check as CheckIcon, Undo, Redo } from '@mui/icons-material';
import { FloorplanEditor } from './FloorplanEditor';
import { Room3D } from './Room3D';
import { ViewMode } from './types';
import ConfirmationDialog from '../ConfirmationDialog/ConfirmationDialog';
import './BlueprintEditor.css';


const BlueprintEditor = ({ 
  onExport, 
  onFloorplanChange,
  initialFloorplan = null
}) => {
  // Get initial floorplan data (plancraft format)
  const getInitialData = () => {
    if (!initialFloorplan) {
      return { points: [], walls: [] };
    }
    
    try {
      const parsed = typeof initialFloorplan === 'string' 
        ? JSON.parse(initialFloorplan) 
        : initialFloorplan;
      
      // Expect plancraft format: { points: [], walls: [] }
      if (parsed && Array.isArray(parsed.points) && Array.isArray(parsed.walls)) {
        return parsed;
      }
      
      // If format is invalid, return empty
      console.warn('Invalid floorplan format. Expected { points: [], walls: [] }');
      return { points: [], walls: [] };
    } catch (err) {
      console.warn('Failed to parse initial floorplan:', err);
      return { points: [], walls: [] };
    }
  };

  const [data, setData] = useState(getInitialData);
  
  // History Management
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  const [viewMode, setViewMode] = useState(ViewMode.SPLIT);
  
  // Ref to trigger GLB export in Room3D
  const exportRef = useRef(null);
  
  // Dialog states
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Notification states
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  // Modified update handler to support undo history
  const handleFloorplanUpdate = useCallback((newData, saveToHistory = false) => {
    if (saveToHistory) {
      setHistory(prev => [...prev, data]);
      setFuture([]); // Clear redo stack on new action
    }
    setData(newData);
    
    // Notify parent of changes (plancraft format)
    if (onFloorplanChange) {
      onFloorplanChange(newData);
    }
  }, [data, onFloorplanChange]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    setFuture(prev => [data, ...prev]);
    setData(previous);
    setHistory(newHistory);
    
    // Notify parent
    if (onFloorplanChange) {
      onFloorplanChange(previous);
    }
  }, [history, data, onFloorplanChange]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);

    setHistory(prev => [...prev, data]);
    setData(next);
    setFuture(newFuture);
    
    // Notify parent
    if (onFloorplanChange) {
      onFloorplanChange(next);
    }
  }, [future, data, onFloorplanChange]);

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        redo();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleExport = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmExport = () => {
    setShowConfirmDialog(false);
    if (exportRef.current) {
      exportRef.current();
      setNotification({
        open: true,
        message: 'Floorplan exported successfully!',
        severity: 'success'
      });
    } else {
      setNotification({
        open: true,
        message: 'Export function not ready yet.',
        severity: 'error'
      });
    }
  };

  const handleClearAll = () => {
    setShowClearDialog(true);
  };

  const handleConfirmClear = () => {
    setShowClearDialog(false);
    const emptyData = { points: [], walls: [] };
    handleFloorplanUpdate(emptyData, true);
    setNotification({
      open: true,
      message: 'All drawings cleared.',
      severity: 'info'
    });
  };

  return (
    <Box className="blueprint-editor-container" sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'flex-end', 
        px: 3, 
        py: 2, 
        bgcolor: '#ffffff', 
        borderBottom: '1px solid #e0e0e0',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Undo / Redo Controls */}
          <Box sx={{ display: 'flex', bgcolor: '#f5f5f5', p: 0.5, borderRadius: 2, mr: 2, border: '1px solid #e0e0e0' }}>
            <IconButton 
              onClick={undo} 
              disabled={history.length === 0}
              size="small"
              sx={{ 
                color: '#666',
                '&:hover': { color: '#333', bgcolor: '#e0e0e0' },
                '&.Mui-disabled': { opacity: 0.3 }
              }}
              title="Undo (Ctrl+Z)"
            >
              <Undo fontSize="small" />
            </IconButton>
            <IconButton 
              onClick={redo} 
              disabled={future.length === 0}
              size="small"
              sx={{ 
                color: '#666',
                '&:hover': { color: '#333', bgcolor: '#e0e0e0' },
                '&.Mui-disabled': { opacity: 0.3 }
              }}
              title="Redo (Ctrl+Y)"
            >
              <Redo fontSize="small" />
            </IconButton>
          </Box>

          {/* View Mode Toggle */}
          <Box sx={{ display: 'flex', bgcolor: '#f5f5f5', p: 0.5, borderRadius: 2, border: '1px solid #e0e0e0' }}>
            <Button
              size="small"
              onClick={() => setViewMode(ViewMode.EDITOR)}
              variant={viewMode === ViewMode.EDITOR ? 'contained' : 'text'}
              sx={{ 
                minWidth: '100px',
                textTransform: 'none',
                color: viewMode === ViewMode.EDITOR ? 'white' : '#666',
                bgcolor: viewMode === ViewMode.EDITOR ? '#e16789' : 'transparent',
                '&:hover': { bgcolor: viewMode === ViewMode.EDITOR ? '#d1537a' : '#e0e0e0' }
              }}
            >
              2D Blueprint
            </Button>
            <Button
              size="small"
              onClick={() => setViewMode(ViewMode.SPLIT)}
              variant={viewMode === ViewMode.SPLIT ? 'contained' : 'text'}
              sx={{ 
                minWidth: '100px',
                textTransform: 'none',
                color: viewMode === ViewMode.SPLIT ? 'white' : '#666',
                bgcolor: viewMode === ViewMode.SPLIT ? '#e16789' : 'transparent',
                '&:hover': { bgcolor: viewMode === ViewMode.SPLIT ? '#d1537a' : '#e0e0e0' }
              }}
            >
              Split View
            </Button>
            <Button
              size="small"
              onClick={() => setViewMode(ViewMode.PREVIEW_3D)}
              variant={viewMode === ViewMode.PREVIEW_3D ? 'contained' : 'text'}
              sx={{ 
                minWidth: '100px',
                textTransform: 'none',
                color: viewMode === ViewMode.PREVIEW_3D ? 'white' : '#666',
                bgcolor: viewMode === ViewMode.PREVIEW_3D ? '#e16789' : 'transparent',
                '&:hover': { bgcolor: viewMode === ViewMode.PREVIEW_3D ? '#d1537a' : '#e0e0e0' }
              }}
            >
              3D Preview
            </Button>
          </Box>

          <Box sx={{ width: '1px', height: '32px', bgcolor: '#e0e0e0', mx: 2 }} />

          <Button 
            onClick={handleClearAll}
            variant="outlined"
            color="error"
            size="small"
            sx={{ textTransform: 'none' }}
          >
            Clear All
          </Button>

          <Button 
            onClick={handleExport}
            variant="contained"
            startIcon={<CheckIcon />}
            sx={{ 
              bgcolor: '#e16789',
              '&:hover': { bgcolor: '#d1537a' },
              textTransform: 'none'
            }}
          >
            Confirm
          </Button>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar with Instructions */}
        <Box sx={{ 
          width: '288px', 
          bgcolor: '#ffffff', 
          borderRight: '1px solid #e0e0e0', 
          display: 'flex', 
          flexDirection: 'column',
          zIndex: 20,
          flexShrink: 0,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
            <Box sx={{ 
              mt: 4, 
              p: 2, 
              bgcolor: '#f8f9fa', 
              borderRadius: 2, 
              border: '1px solid #e0e0e0' 
            }}>
              <Typography variant="caption" sx={{ 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                color: '#333', 
                mb: 1.5,
                display: 'block',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Instructions
              </Typography>
              <Box component="ul" sx={{ 
                fontSize: '0.75rem', 
                color: '#666', 
                pl: 2,
                m: 0,
                '& li': { mb: 1 }
              }}>
                <li>Use <Box component="span" sx={{ color: '#e16789', fontWeight: 600 }}>Select Mode</Box> to drag corners/walls.</li>
                <li>Hold <Box component="span" sx={{ color: '#e16789', fontWeight: 600 }}>Space</Box> or Middle Mouse to Pan.</li>
                <li>Select a wall to manually input <Box component="span" sx={{ color: '#e16789', fontWeight: 600 }}>length</Box>.</li>
                <li>Click corners or walls to select and <Box component="span" sx={{ color: '#d32f2f', fontWeight: 600 }}>delete</Box> them.</li>
                <li>Use <Box component="span" sx={{ color: '#e16789', fontWeight: 600 }}>Draw Mode</Box> to create new layouts.</li>
                <li><Box component="span" sx={{ color: '#333', fontFamily: 'monospace', fontSize: '0.625rem' }}>CTRL+Z</Box> to Undo.</li>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Workspace */}
        <Box sx={{ flex: 1, position: 'relative', bgcolor: '#fafafa' }}>
          {/* 2D View Container */}
          <Box 
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              transition: 'all 0.5s ease-in-out',
              ...(viewMode === ViewMode.EDITOR 
                ? { zIndex: 10, opacity: 1 } 
                : viewMode === ViewMode.SPLIT 
                  ? { width: '50%', zIndex: 10, borderRight: '1px solid #e0e0e0' } 
                  : { zIndex: 0, opacity: 0, pointerEvents: 'none' }
              )
            }}
          >
            <FloorplanEditor data={data} onUpdate={handleFloorplanUpdate} />
            {viewMode === ViewMode.EDITOR && (
              <Box sx={{ 
                position: 'absolute', 
                top: 16, 
                right: 16, 
                bgcolor: '#e16789', 
                color: 'white', 
                px: 1.5, 
                py: 0.5, 
                borderRadius: 1,
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                Editor Active
              </Box>
            )}
          </Box>

          {/* 3D View Container */}
          <Box 
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: '#fafafa',
              transition: 'all 0.5s ease-in-out',
              ...(viewMode === ViewMode.PREVIEW_3D 
                ? { zIndex: 10, opacity: 1 } 
                : viewMode === ViewMode.SPLIT 
                  ? { left: '50%', width: '50%', zIndex: 10 } 
                  : { zIndex: 0, opacity: 0, pointerEvents: 'none' }
              )
            }}
          >
            <Box sx={{ width: '100%', height: '100%' }}>
              <Room3D data={data} onExportRef={exportRef} onExport={onExport} />
            </Box>
            {viewMode === ViewMode.PREVIEW_3D && (
              <Box sx={{ 
                position: 'absolute', 
                top: 16, 
                right: 16, 
                bgcolor: '#e16789', 
                color: 'white', 
                px: 1.5, 
                py: 0.5, 
                borderRadius: 1,
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                3D Active
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        onConfirm={handleConfirmClear}
        title="Clear All Drawings?"
        description="Are you sure you want to clear all drawings? This action cannot be undone."
        confirmText="Clear All"
        cancelText="Cancel"
      />

      <ConfirmationDialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmExport}
        title="Confirm Export"
        description="Are you sure you want to export this floorplan? The 3D model will be generated and saved."
        confirmText="Confirm"
        cancelText="Cancel"
      />

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BlueprintEditor;

