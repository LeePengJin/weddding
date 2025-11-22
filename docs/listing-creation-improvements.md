# Listing Creation Improvements

## Current Issues
1. **Complexity**: All fields shown at once, overwhelming for vendors
2. **Confusing Options**: Availability type and pricing policy are not well explained
3. **Venue Confusion**: Venues don't need bundle service options
4. **Service Listing Availability**: Not implemented yet

## Proposed Solution: Step-by-Step Wizard

### Step 1: Type & Availability
- Choose listing category first
- Choose availability type with clear explanations and examples
- For venues: Auto-set to "exclusive" availability
- Hide bundle service option for venues

### Step 2: Basic Information
- Name, description, price
- Pricing policy with clear explanations
- For venues: Only show "Flat Rate" pricing
- For other services: Show relevant pricing options based on availability type

### Step 3: Media & 3D Model
- Images upload
- 3D model options (existing, upload, floorplan for venues)
- For venues: Show floorplan editor option prominently
- Hide bundle components section for venues

## Service Listing Availability

**Question**: Should service listings have their own availability calendar (like vendors)?

**Recommendation**: 
- **Not necessary for MVP**: Service availability is already handled through:
  - Exclusive services: One booking per date (handled by booking system)
  - Reusable services: Multiple bookings allowed (no calendar needed)
  - Quantity-based: Tracked through maxQuantity field
  
- **Optional Enhancement**: Could add a calendar for:
  - Blocking specific dates (e.g., venue closed for maintenance)
  - Setting different prices for peak/off-peak dates
  - Managing seasonal availability

**Suggestion**: Defer this feature unless there's a specific business need. The current availability types should be sufficient for most use cases.

