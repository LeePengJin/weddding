export const GRID_SIZE = 20;
export const PIXELS_PER_METER = 20;
export const DEFAULT_WALL_HEIGHT = 5; // meters
export const DEFAULT_DOOR_WIDTH = 18; // ~0.9 meters (18px)
export const DEFAULT_DOOR_HEIGHT = 2.1; // meters
export const DEFAULT_WINDOW_WIDTH = 20; // 1 meter
export const DEFAULT_WINDOW_HEIGHT = 1.5; // meters
export const DEFAULT_WINDOW_ELEVATION = 1; // meters
export const SNAP_DISTANCE = 10;

export const DEFAULT_STAGE_WIDTH = 120; // 6 meters
export const DEFAULT_STAGE_DEPTH = 80;  // 4 meters
export const DEFAULT_STAGE_HEIGHT = 0.6; // 60cm
export const DEFAULT_STAGE_COLOR = '#8d5a36';

export const WALL_TEXTURES = [
  { id: 'default', name: 'Default (Gray)', color: '#cbd5e1', roughness: 0.5 },
  { id: 'brick', name: 'Brick Red', color: '#8d4004', roughness: 0.9 },
  { id: 'concrete', name: 'Concrete', color: '#94a3b8', roughness: 0.8 },
  { id: 'drywall', name: 'White Drywall', color: '#f8fafc', roughness: 0.5 },
  { id: 'wood', name: 'Wood Panel', color: '#a05a2c', roughness: 0.6 },
  { id: 'dark', name: 'Dark Slate', color: '#334155', roughness: 0.7 },
];
