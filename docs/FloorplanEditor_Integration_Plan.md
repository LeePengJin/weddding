# Floorplan Editor Integration Plan

## Overview
This document outlines the plan to integrate enhanced features from the new `floorplan_editor` folder into the existing `src/components/BlueprintEditor` implementation while preserving the current UI design and styling.

## New Features to Integrate

### 1. **Enhanced Drawing Modes**
- ✅ **DOOR Mode**: Place doors on walls with collision detection
- ✅ **WINDOW Mode**: Place windows on walls with collision detection  
- ✅ **STAGE Mode**: Place and resize stage platforms
- ✅ **Zoom Functionality**: Mouse wheel zoom + zoom buttons
- ✅ **Enhanced Wall Properties**: Height, thickness, texture selection

### 2. **New Data Structures**
- **Doors**: `{ id, wallId, offset, width, height }`
- **Windows**: `{ id, wallId, offset, width, height, heightFromGround }`
- **Stages**: `{ id, x, y, width, depth, height, rotation, color }`
- **Enhanced Walls**: `{ id, startPointId, endPointId, thickness, height, texture }`

### 3. **Advanced Features**
- Collision detection for doors/windows (prevents overlapping different types)
- Auto-merge for overlapping doors/windows of same type
- Stage resize handles (8 handles: n, s, e, w, ne, nw, se, sw)
- Stage rotation and color customization
- Wall texture selection (6 options: default, brick, concrete, drywall, wood, dark)

## System Impact Analysis

### Files That Will Be Modified

#### 1. **Core Components**
- `src/components/BlueprintEditor/FloorplanEditor.jsx` ⚠️ **MAJOR UPDATE**
  - Add DOOR, WINDOW, STAGE modes
  - Add zoom functionality
  - Add property panels for doors/windows/stages
  - Keep Material-UI styling (not Tailwind)
  - Keep current color scheme (#e16789 pink)

- `src/components/BlueprintEditor/constants.js` ✅ **MINOR UPDATE**
  - Already has door/window/stage constants
  - May need to verify all constants match

- `src/components/BlueprintEditor/types.js` ✅ **ALREADY COMPATIBLE**
  - Types already include doors, windows, stages
  - No changes needed

#### 2. **3D Rendering**
- `src/components/BlueprintEditor/Room3D.jsx` ⚠️ **MAJOR UPDATE**
  - Add door rendering (openings in walls)
  - Add window rendering (glass panels)
  - Add stage rendering (platforms)
  - Apply wall textures
  - Handle door/window heights and elevations

#### 3. **Data Storage & Backend**
- **Database Schema**: May need migration if storing floorplan data
  - Current: May store as JSON string
  - New: Needs to support doors[], windows[], stages[] arrays
  - **Impact**: Existing floorplans will have empty arrays (backward compatible)

- **API Endpoints**: 
  - `/api/listings/:id/floorplan` - May need to handle new fields
  - **Impact**: Should be backward compatible (empty arrays for old data)

#### 4. **Pages Using BlueprintEditor**
- `src/pages/VenueFloorplanEditor/VenueFloorplanEditor.jsx` ✅ **NO CHANGES**
  - Already passes initialFloorplan correctly
  - Already handles export

- `src/pages/ManageListings/ManageListings.jsx` ✅ **NO CHANGES**
  - Uses BlueprintEditor via modal
  - Should work with new features automatically

### Data Migration Considerations

#### Existing Floorplan Data
- **Current Format**: `{ points: [], walls: [] }`
- **New Format**: `{ points: [], walls: [], doors: [], windows: [], stages: [] }`
- **Migration Strategy**: 
  - BlueprintEditor already handles backward compatibility (see line 30-36)
  - Old floorplans will load with empty arrays for new fields
  - No data loss - existing floorplans remain functional
  - New features simply won't be available for old floorplans until user adds doors/windows/stages

#### Database Impact
- If floorplans are stored in database:
  - **Option 1**: Store as JSON string (no schema change needed)
  - **Option 2**: If normalized, may need new tables: `doors`, `windows`, `stages`
  - **Recommendation**: Check current storage method first

## Integration Steps

### Phase 1: Core Functionality (Keep Current UI)
1. **Add New Modes to FloorplanEditor.jsx**
   - Add DOOR, WINDOW, STAGE to mode state
   - Add mode buttons (keep Material-UI styling, use current color scheme)
   - Add keyboard shortcuts (D for door, W for window, S for stage)

2. **Implement Door Placement**
   - Add `handleDoorDown`, `handleWindowDown` functions
   - Add ghost opening preview
   - Add collision detection logic
   - Add door/window property panels (Material-UI styled)

3. **Implement Window Placement**
   - Similar to doors but with elevation support
   - Window-specific rendering

4. **Implement Stage Placement**
   - Add stage drawing mode
   - Add resize handles (8 handles)
   - Add stage property panel (width, depth, height, rotation, color)
   - Implement rotation logic

5. **Add Zoom Functionality**
   - Mouse wheel zoom
   - Zoom in/out buttons (Material-UI IconButtons)
   - Keep current grid background styling

### Phase 2: Enhanced Wall Properties
1. **Wall Property Panel Enhancement**
   - Add height input (meters)
   - Add thickness input (meters) 
   - Add texture dropdown (Material-UI Select)
   - Keep current styling (#e16789 theme)

2. **Update Wall Rendering**
   - Apply texture colors in 2D view
   - Update 3D rendering to use textures

### Phase 3: 3D Rendering Updates
1. **Update Room3D.jsx**
   - Add door openings (subtract from wall geometry)
   - Add window glass panels
   - Add stage platforms
   - Apply wall textures to 3D meshes

2. **Test 3D Export**
   - Ensure GLB export includes doors/windows/stages
   - Verify textures are exported correctly

### Phase 4: UI Polish
1. **Maintain Current Design**
   - Keep white background (#ffffff) instead of dark (#1e293b)
   - Keep pink/rose color scheme (#e16789)
   - Keep Material-UI components
   - Keep current button styles and layouts

2. **Update Instructions Panel**
   - Add instructions for door/window/stage modes
   - Update keyboard shortcuts list

## Key Differences to Address

### Styling Differences
| Current (Keep) | New Version (Replace) |
|----------------|----------------------|
| Material-UI components | Tailwind CSS classes |
| White background (#ffffff) | Dark background (#1e293b) |
| Pink theme (#e16789) | Blue theme |
| Material-UI icons | Lucide icons |
| Material-UI TextField/Select | Native HTML inputs |

### Code Structure Differences
- **Current**: JavaScript (.jsx)
- **New**: TypeScript (.tsx)
- **Solution**: Convert TypeScript logic to JavaScript, keep type safety via JSDoc comments

### Icon Library Differences
- **Current**: `@mui/icons-material`
- **New**: `lucide-react`
- **Solution**: Use Material-UI icons or add lucide-react as dependency
  - Door: `DoorOpen` from @mui/icons-material
  - Window: `Window` from @mui/icons-material  
  - Stage: `Square` or `ViewInAr` from @mui/icons-material

## Testing Checklist

### Functional Testing
- [ ] Door placement and editing
- [ ] Window placement and editing
- [ ] Stage placement, resize, and rotation
- [ ] Wall property editing (height, thickness, texture)
- [ ] Collision detection (doors vs windows)
- [ ] Auto-merge (overlapping doors/windows)
- [ ] Zoom in/out (mouse wheel + buttons)
- [ ] Undo/Redo with new features
- [ ] Export GLB with all features

### Data Compatibility
- [ ] Load old floorplans (without doors/windows/stages)
- [ ] Save new floorplans (with all features)
- [ ] Edit existing floorplans (add new features)
- [ ] Export old floorplans (should work)

### UI/UX Testing
- [ ] All buttons match current design
- [ ] Color scheme consistent (#e16789)
- [ ] Material-UI components used throughout
- [ ] Responsive design maintained
- [ ] Keyboard shortcuts work
- [ ] Instructions panel updated

## Risk Assessment

### Low Risk ✅
- Adding new modes (DOOR, WINDOW, STAGE)
- Adding zoom functionality
- Property panels (UI only)

### Medium Risk ⚠️
- Collision detection logic (complex algorithms)
- Stage resize handles (coordinate transformations)
- 3D rendering updates (may affect performance)

### High Risk 🔴
- Data migration (if database schema changes needed)
- Backward compatibility with existing floorplans
- GLB export with new features (3D geometry changes)

## Estimated Impact

### Development Time
- Phase 1: 4-6 hours
- Phase 2: 2-3 hours  
- Phase 3: 3-4 hours
- Phase 4: 2-3 hours
- **Total**: ~12-16 hours

### Breaking Changes
- **None expected** - All changes are additive
- Backward compatible with existing floorplan data
- No API changes required (if using JSON storage)

### User Impact
- **Positive**: More features for venue vendors
- **Neutral**: Existing floorplans continue to work
- **Learning Curve**: Users need to learn new modes (D, W, S keys)

## Recommendations

1. **Start with Phase 1** - Core functionality first
2. **Test thoroughly** - Especially collision detection and 3D rendering
3. **Keep current UI** - Don't change styling/colors
4. **Document new features** - Update user instructions
5. **Consider user training** - New features may need explanation

## Next Steps

1. Review this plan with team
2. Check database schema (if applicable)
3. Create feature branch: `feature/enhanced-floorplan-editor`
4. Begin Phase 1 implementation
5. Test incrementally after each phase

