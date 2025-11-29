# Pricing Model Implementation Plan

## Overview
This document outlines the implementation of the new pricing logic system with 3D-level table tagging.

---

## 1. Database Schema Changes

### 1.1 Update `PricingPolicy` Enum
**Current:** `flat`, `per_table`, `per_set`, `per_guest`, `tiered`  
**New:** `per_unit`, `per_table`, `fixed_package`, `tiered_package`, `time_based`

**File:** `server/prisma/schema.prisma`

```prisma
enum PricingPolicy {
  per_unit        // Per Unit Pricing
  per_table       // Per Table Pricing
  fixed_package   // Fixed Package Pricing
  tiered_package  // Tiered Package Pricing
  time_based      // Time-Based Pricing
}
```

### 1.2 Add Fields to `ServiceListing`
- `hourlyRate` (Decimal, nullable) - For time-based pricing
- `tieredPricing` (JSON, nullable) - Store tier definitions for tiered packages
  ```json
  [
    { "name": "4 hours", "price": 2000 },
    { "name": "8 hours", "price": 3500 },
    { "name": "Full day", "price": 5000 }
  ]
  ```

### 1.3 Add Event Times to `WeddingProject`
- `eventStartTime` (DateTime, nullable) - Start time of the event
- `eventEndTime` (DateTime, nullable) - End time of the event
- Note: `weddingDate` currently stores datetime, we'll keep it but add separate time fields for clarity

### 1.4 Add Table Tagging to `PlacedElement`
- `serviceListingIds` (String[], default: []) - Array of service listing IDs that this table is tagged for
- `elementType` (String, nullable) - Mark as "table" to identify banquet tables
- Note: We need to identify which placed elements are tables vs other furniture

### 1.5 Add Helper Field to `VenueDesign`
- `tableCount` (Int, nullable) - Cached count of banquet tables (auto-calculated)

---

## 2. Migration Strategy

### Step 1: Create Migration
```bash
npx prisma migrate dev --name add_pricing_models_and_table_tagging
```

### Step 2: Data Migration
- Map old `PricingPolicy` values to new ones:
  - `flat` → `fixed_package`
  - `per_table` → `per_table` (unchanged)
  - `per_set` → `per_unit`
  - `per_guest` → `per_unit` (with manual quantity input)
  - `tiered` → `tiered_package`

---

## 3. Backend Implementation

### 3.1 Pricing Calculation Engine
**File:** `server/utils/pricingCalculator.js`

```javascript
/**
 * Calculate total cost for a service listing based on pricing model
 * @param {Object} serviceListing - ServiceListing object
 * @param {Object} context - Context object with:
 *   - quantity (for per_unit)
 *   - tableCount (for per_table)
 *   - selectedTier (for tiered_package)
 *   - eventDuration (for time_based)
 * @returns {Decimal} Total cost
 */
function calculatePrice(serviceListing, context) {
  switch (serviceListing.pricingPolicy) {
    case 'per_unit':
      return serviceListing.price * context.quantity;
    
    case 'per_table':
      return serviceListing.price * context.tableCount;
    
    case 'fixed_package':
      return serviceListing.price;
    
    case 'tiered_package':
      const tier = serviceListing.tieredPricing.find(t => t.id === context.selectedTierId);
      return tier ? tier.price : serviceListing.price;
    
    case 'time_based':
      return serviceListing.hourlyRate * context.eventDuration;
    
    default:
      return serviceListing.price;
  }
}
```

### 3.2 Table Count Service
**File:** `server/services/tableCountService.js`

```javascript
/**
 * Get table count from 3D design, optionally filtered by service listing
 * @param {String} venueDesignId - VenueDesign ID
 * @param {String} serviceListingId - Optional: filter by service tag
 * @returns {Number} Table count
 */
async function getTableCount(venueDesignId, serviceListingId = null) {
  const where = {
    venueDesignId,
    designElement: {
      elementType: 'table' // Assuming we mark tables with this type
    }
  };
  
  if (serviceListingId) {
    where.serviceListingIds = { has: serviceListingId };
  }
  
  const tables = await prisma.placedElement.count({ where });
  return tables;
}
```

### 3.3 Update Booking Route
**File:** `server/routes/booking.routes.js`

- Before creating booking, calculate prices using new pricing engine
- For per-table services, fetch table count from venue design
- For time-based services, calculate duration from project event times

---

## 4. Frontend Implementation

### 4.1 Vendor Listing Creation Form
**File:** `src/pages/ManageListings/ManageListings.jsx`

**New Fields:**
- Pricing Model dropdown (5 options)
- Conditional fields:
  - If `time_based`: Show "Hourly Rate" input
  - If `tiered_package`: Show tier builder (add/remove tiers with name and price)
  - If `per_unit` or `per_table`: Show base price input

### 4.2 3D Planner Table Tagging UI
**File:** `src/pages/VenueDesigner/VenueDesigner.js`

**New Features:**
1. **Table Selection Mode:**
   - Click on a table in 3D view
   - Show popup: "Tag this table for:"
   - Multi-select checkboxes for all per-table services in the project
   - Save tags to `PlacedElement.serviceListingIds`

2. **Visual Indicators:**
   - Highlight tagged tables with colored borders
   - Different colors for different services
   - Show count badge: "15 tables tagged for Catering"

3. **Bulk Tagging:**
   - Select multiple tables
   - Apply same tags to all selected

### 4.3 Booking Flow Updates
**File:** `src/pages/VenueDesigner/CheckoutModal.jsx`

**Changes:**
- For `per_table` services: Auto-fetch table count from tagged tables
- For `per_unit` services: Auto-count from 3D placements
- For `time_based` services: Auto-calculate from project event times
- Show confirmation dialog if manual override is needed

---

## 5. API Endpoints

### 5.1 Get Table Count
```
GET /api/venue-designs/:venueDesignId/table-count?serviceListingId=:id
Response: { count: 15 }
```

### 5.2 Tag Tables
```
POST /api/venue-designs/:venueDesignId/tag-tables
Body: {
  placedElementIds: ["id1", "id2"],
  serviceListingIds: ["service1", "service2"]
}
```

### 5.3 Calculate Service Price
```
POST /api/service-listings/:id/calculate-price
Body: {
  context: {
    quantity?: number,
    tableCount?: number,
    selectedTierId?: string,
    eventDuration?: number
  }
}
Response: { totalPrice: 5000.00 }
```

---

## 6. Implementation Order

1. ✅ Database schema changes and migration
2. ✅ Backend pricing calculation engine
3. ✅ Table count service
4. ✅ Update booking routes
5. ✅ Vendor listing form updates
6. ✅ 3D planner tagging UI
7. ✅ Booking flow integration
8. ✅ Testing and refinement

---

## 7. Testing Checklist

- [ ] Create listing with each pricing model
- [ ] Tag tables in 3D planner
- [ ] Verify table count calculation
- [ ] Test booking flow with all pricing models
- [ ] Verify price calculations are correct
- [ ] Test edge cases (no 3D layout, manual input)
- [ ] Test time-based duration calculation
- [ ] Test tiered package selection

---

## 8. Open Questions

1. **Table Identification:** How do we identify which `DesignElement` is a table?
   - Option A: Add `elementType` field to `DesignElement` (vendor sets when uploading)
   - Option B: Check `name` field for keywords like "table"
   - **Recommendation:** Option A - explicit type field

2. **Multiple Table Types:** What if there are different table types (round, rectangular)?
   - All count as "banquet tables" for pricing purposes
   - Tagging applies to all table types

3. **Table Removal:** When a table is removed from 3D, should tags persist?
   - No - tags are removed with the element
   - Count automatically updates

4. **Service Deletion:** What happens to tags if a service listing is deleted?
   - Tags are removed (cascade or cleanup job)

---

## Next Steps

1. Review and approve this plan
2. Start with database schema changes
3. Implement backend services
4. Build frontend UI components
5. Integration and testing

