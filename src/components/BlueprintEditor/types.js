// Floorplan data types
export const ViewMode = {
  EDITOR: 'EDITOR',
  PREVIEW_3D: 'PREVIEW_3D',
  SPLIT: 'SPLIT'
};

// Point interface
export const Point = {
  id: String,
  x: Number,
  y: Number,
};

// Wall interface
export const Wall = {
  id: String,
  startPointId: String,
  endPointId: String,
  thickness: Number, // in pixels
  height: Number,    // in meters
  texture: String,  // Texture ID (optional)
};

// Door interface
export const Door = {
  id: String,
  wallId: String,
  offset: Number, // Distance from startPoint in pixels
  width: Number,  // Width of door in pixels
  height: Number, // Height of door in meters
};

// Window interface
export const Window = {
  id: String,
  wallId: String,
  offset: Number, // Distance from startPoint in pixels
  width: Number, // Width in pixels
  height: Number, // Height in meters
  heightFromGround: Number, // Elevation in meters
};

// Stage interface
export const Stage = {
  id: String,
  x: Number, // Center x
  y: Number, // Center y
  width: Number, // pixels
  depth: Number, // pixels
  height: Number, // meters
  rotation: Number, // degrees
  color: String, // Hex color code (optional)
};

// FloorplanData interface
export const FloorplanData = {
  points: Array,
  walls: Array,
  doors: Array,
  windows: Array,
  stages: Array,
};

