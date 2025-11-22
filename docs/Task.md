# Venue Designer Phase 2 Notes

_Last updated: November 18, 2025_

## Core UI Rules
- Keep layouts elegant, airy, and consistent; avoid heavy colors, excessive border radius, or cramped spacing.
- 3D canvas must remain full-bleed (no container borders) with controls/catalog layered on top.
- Catalog sidebar stays left-docked, collapsible, two-card grid; availability must be visible, with hover actions for add/info.
- Budget tracker uses the slim bar style (white card, 1px border, uppercase labels) shared here.
- All new imagery should be local/public assets; normalize `/uploads/...` URLs before display.

## Architecture Snapshot (Phase 2)
1. `VenueDesigner.jsx` – container for data fetching, shared state, autosave hooks, and layout.
2. `CatalogSidebar.jsx` – receives catalog props, handles filters/collapse, renders `ServiceListingCard`s.
3. `ServiceListingCard.jsx` – reusable card (image, vendor, price, availability, hover actions, clickable title).
4. `ServiceListingDetailsModal.jsx` – detail view (close, add to 3D, message vendor link). **Pending**
5. `BudgetTracker.jsx` – new slim style, props: total, planned, remaining, progress.
6. `Scene3D` suite (`Scene3D.jsx`, `PlacedElement.jsx`) – currently stubbed with 2D placeholder; swap to R3F later.
7. `SummaryModal.jsx` – group placements by vendor, allow removals pre-checkout. **Pending**
8. `CheckoutModal.jsx` – choose vendors to book (individual/all). **Pending**

## Implementation Checklist
- [x] Phase 2 layout refactor (full-bleed canvas, overlay rails).
- [x] Catalog sidebar/cards redesigned per frame (hover + info button, two-card grid).
- [x] Budget tracker matches reference frame.
- [x] Introduce catalog detail drawer with inline media + 3D toggle.
- [x] Extract placeholder `DesignCanvas` (prep for Scene3D).
- [x] Build `SummaryModal.jsx` with vendor grouping/removal.
- [x] Scaffold `CheckoutModal.jsx`.
- [x] Wire autosave + availability highlighting into context once components land.

## Notes & References
- ID prefixes: `vnd_`, `ple_`, `pos_`, `cam_`, `bnd_` via `prefixedUlid`.
- Availability: show all listings but flag unavailable ones; highlight placed items if availability changes mid-design.
- Budget flow: "planned spend" updates when items add/remove; category allocation deferred.
- Messaging shortcut: details modal's "Message Vendor" should link to `/messages` (current system) until live chat arrives.
- Rendering strategy: target rasterization with DLOD; React Three Fiber integration scheduled for Phase 3.
- Use MUI for design

---

## Phase 3: React Three Fiber (R3F) 3D Scene Integration

### Objectives
- Replace placeholder `DesignCanvas` with real 3D rendering using React Three Fiber
- Implement interactive 3D scene manipulation (ray-casting, collision detection, spatial transformations)
- Enable drag-and-drop placement of 3D models in the scene
- Add camera controls (pan, zoom, orbit) for 3D navigation
- Render venue 3D model as foundation with placed items as 3D models

### Implementation Checklist
- [x] Install and configure `@react-three/fiber` and `@react-three/drei`
- [x] Create `Scene3D.jsx` component to replace `DesignCanvas.jsx`
- [x] Create `PlacedElement.jsx` for 3D model instances with controls
- [x] Implement GLTF/GLB model loading for venue and placed items
- [x] Add ray-casting for object selection in 3D space (pointer-based selection)
- [x] Implement collision detection to prevent overlapping placements
- [x] Add drag-and-drop functionality for placing items in 3D (TransformControls translate)
- [x] Implement move/rotate/scale controls for placed elements
- [x] Add camera controls (OrbitControls) for scene navigation
- [x] Integrate lock/unlock functionality with 3D elements
- [x] Add lighting setup for proper 3D model visibility
- [x] Load venue base model from `venueServiceListingId`
- [ ] Optimize rendering performance (frustum culling, LOD selection)
- [ ] Support parent-child attachments for stacked elements so children follow the surface when it moves

### Technical Notes
- Use `useGLTF` hook from `@react-three/drei` for model loading
- Implement `useFrame` for animation and interaction updates
- Use `Raycaster` from Three.js for object picking
- Store 3D positions in `Coordinates` table (x, y, z)
- Camera position stored in `VenueDesign.cameraPositionId`

### Pre-existing Structures (Stages, Fixed Furniture, etc.)

**Question**: How should vendors represent pre-existing structures like stages, podiums, or fixed furniture that are already in the venue?

**Current Approach**: The floorplan editor only allows drawing the space (walls, corners, rooms). Pre-existing structures are not currently supported.

**Proposed Solutions**:

1. **Option A: Add "Furniture/Items" Mode to BlueprintEditor**
   - Extend blueprint3d to support placing 3D items (stages, podiums, etc.) on the floorplan
   - These items would be part of the exported GLB model
   - Pros: Everything in one model, accurate representation
   - Cons: More complex implementation, requires extending blueprint3d

2. **Option B: Two-Step Process**
   - Step 1: Draw the floorplan (walls/space) → Export as base GLB
   - Step 2: In the main venue designer, place pre-existing structures as separate 3D models
   - Pros: Reuses existing 3D model placement system, simpler
   - Cons: Pre-existing structures not in the exported GLB, less accurate

3. **Option C: Hybrid Approach**
   - Draw floorplan in BlueprintEditor
   - After export, allow vendor to add "fixed elements" in a separate step
   - Fixed elements are marked as non-movable and included in the final GLB
   - Pros: Flexible, clear separation between space and furniture
   - Cons: More steps for vendor

**Recommendation**: Start with Option B (two-step process) for MVP, then consider Option C if vendors need pre-existing structures in the exported model.

**Future Enhancement**: If blueprint3d supports furniture placement, we can add Option A as an advanced feature.

### Task comes up to my mind
- (Couple) Complete the payment part
- (Couple) 3D venue design: When the user submit booking requests for a particular elements in the 3D venue design, it cannot be removed from the 3D venue design. Only can be removed if the booking is rejected.
- (Couple) Complete the Booked Suppliers part
- (Vendor) Manage booking requests
- (Admin) Complete the wedding package things 
- (Admin) Complete account management
- (Admin) Complete vendor payment
- Reporting functionality (Admin & Vendor)
- Couple profile view (from vendor)
- (General) Improve footer, add more pages (FaQ, About Us)