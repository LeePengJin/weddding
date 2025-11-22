# Blueprint3D Serialization Schema

This document describes the JSON serialization format used by blueprint3d to save and load floorplans and 3D scenes.

## Overview

The complete serialized format is a JSON object with two main sections:
- `floorplan`: The 2D floorplan structure (walls, corners, textures)
- `items`: Array of 3D items/furniture placed in the scene

## Complete Schema

```json
{
  "floorplan": {
    "corners": {
      "<corner-id>": {
        "x": <number>,
        "y": <number>
      }
    },
    "walls": [
      {
        "corner1": "<corner-id>",
        "corner2": "<corner-id>",
        "frontTexture": {
          "url": "<string>",
          "stretch": <boolean>,
          "scale": <number>
        },
        "backTexture": {
          "url": "<string>",
          "stretch": <boolean>,
          "scale": <number>
        }
      }
    ],
    "wallTextures": [],
    "floorTextures": {
      "<room-uuid>": {
        "url": "<string>",
        "scale": <number>
      }
    },
    "newFloorTextures": {
      "<room-uuid>": {
        "url": "<string>",
        "scale": <number>
      }
    }
  },
  "items": [
    {
      "item_name": "<string>",
      "item_type": "<string>",
      "model_url": "<string>",
      "xpos": <number>,
      "ypos": <number>,
      "zpos": <number>,
      "rotation": <number>,
      "scale_x": <number>,
      "scale_y": <number>,
      "scale_z": <number>,
      "fixed": <boolean>,
      "resizable": <boolean>
    }
  ]
}
```

## Field Descriptions

### Floorplan Section

#### `corners` (object)
- **Type**: Object mapping corner IDs to coordinate objects
- **Keys**: Unique corner identifier (UUID string)
- **Values**: 
  - `x` (number): X coordinate in 2D floorplan space
  - `y` (number): Y coordinate in 2D floorplan space (note: in 3D this becomes Z)

#### `walls` (array)
- **Type**: Array of wall objects
- Each wall object contains:
  - `corner1` (string): ID of the start corner
  - `corner2` (string): ID of the end corner
  - `frontTexture` (object, optional): Texture for the front side of the wall
    - `url` (string): Path to texture image
    - `stretch` (boolean): Whether texture should stretch to fill wall
    - `scale` (number): Texture scale factor
  - `backTexture` (object, optional): Texture for the back side of the wall (same structure as `frontTexture`)

#### `wallTextures` (array)
- **Type**: Array (currently appears to be unused/legacy)
- **Purpose**: Historical texture storage (may be empty)

#### `floorTextures` (object)
- **Type**: Object mapping room UUIDs to floor texture definitions
- **Keys**: Room UUID (string)
- **Values**:
  - `url` (string): Path to floor texture image
  - `scale` (number): Texture scale factor

#### `newFloorTextures` (object)
- **Type**: Object mapping room UUIDs to floor texture definitions
- **Purpose**: Same as `floorTextures`, but used for newly added textures
- **Structure**: Same as `floorTextures`

### Items Section

#### `items` (array)
- **Type**: Array of 3D item/furniture objects
- Each item object contains:
  - `item_name` (string): Display name of the item
  - `item_type` (string): Category/type identifier (e.g., "chair", "table", "sofa")
  - `model_url` (string): Path to the 3D model file (GLTF/OBJ/JS format)
  - `xpos` (number): X position in 3D space
  - `ypos` (number): Y position in 3D space (vertical/height)
  - `zpos` (number): Z position in 3D space
  - `rotation` (number): Rotation around Y-axis in radians
  - `scale_x` (number): Scale factor along X-axis
  - `scale_y` (number): Scale factor along Y-axis
  - `scale_z` (number): Scale factor along Z-axis
  - `fixed` (boolean): Whether the item is locked/fixed in place
  - `resizable` (boolean, optional): Whether the item can be resized

## Coordinate System

- **2D Floorplan**: Uses X/Y coordinates (where Y in 2D becomes Z in 3D)
- **3D Scene**: Uses X/Y/Z coordinates where:
  - X: Left/Right
  - Y: Up/Down (vertical)
  - Z: Forward/Back (depth)

## Example

```json
{
  "floorplan": {
    "corners": {
      "corner-1": { "x": 0, "y": 0 },
      "corner-2": { "x": 500, "y": 0 },
      "corner-3": { "x": 500, "y": 300 },
      "corner-4": { "x": 0, "y": 300 }
    },
    "walls": [
      {
        "corner1": "corner-1",
        "corner2": "corner-2",
        "frontTexture": {
          "url": "rooms/textures/wallmap.png",
          "stretch": true,
          "scale": 0
        },
        "backTexture": {
          "url": "rooms/textures/wallmap.png",
          "stretch": true,
          "scale": 0
        }
      }
    ],
    "wallTextures": [],
    "floorTextures": {},
    "newFloorTextures": {}
  },
  "items": [
    {
      "item_name": "Round Table",
      "item_type": "table",
      "model_url": "models/js/cb-scholartable_baked.js",
      "xpos": 250,
      "ypos": 0,
      "zpos": 150,
      "rotation": 0,
      "scale_x": 1,
      "scale_y": 1,
      "scale_z": 1,
      "fixed": false
    }
  ]
}
```

## API Methods

### Exporting
```javascript
// Get the serialized JSON string
const jsonString = blueprint3dInstance.model.exportSerialized();

// Or get just the floorplan
const floorplanData = blueprint3dInstance.model.floorplan.saveFloorplan();
```

### Importing
```javascript
// Load from JSON string
blueprint3dInstance.model.loadSerialized(jsonString);

// Or load just the floorplan
blueprint3dInstance.model.floorplan.loadFloorplan(floorplanData);
```

## Notes for Integration

1. **For Vendor Venue Builder**: We primarily need the `floorplan` section. The `items` array is for furniture placement, which vendors won't be doing in this tool (that happens in the couple-facing designer).

2. **Corner IDs**: These are UUIDs generated by blueprint3d. When loading, if you provide IDs, they'll be preserved; otherwise new UUIDs are generated.

3. **Texture Paths**: These are relative paths from the `textureDir` option passed to the Blueprint3d constructor. We'll need to ensure our texture assets are accessible at those paths, or normalize them to our upload system.

4. **Room Detection**: Rooms are automatically detected from the wall graph by blueprint3d's `findRooms()` algorithm. We don't need to explicitly store room definitions—they're computed from the corners and walls.

5. **Units**: The coordinate system appears to be in pixels/arbitrary units. We'll need to establish a scale factor (e.g., 1 unit = 1 meter) when exporting to GLB for our venue models.

