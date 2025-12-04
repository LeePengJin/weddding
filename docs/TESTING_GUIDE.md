# Testing Guide - Booking, Payment & Cancellation System

This guide covers all features implemented for the booking, payment, and cancellation system.

---

## Prerequisites

1. **Database Migration**: Ensure all migrations are applied
   ```bash
   cd server
   npx prisma migrate deploy
   ```

2. **Backend Server**: Start the backend server
   ```bash
   cd server
   npm run dev
   ```

3. **Frontend Server**: Start the frontend development server
   ```bash
   npm start
   ```

4. **Test Accounts**: Have test accounts ready for:
   - At least 2 Couple accounts
   - At least 2 Vendor accounts (different categories)
   - 1 Admin account

---

## 1. VENDOR: Listing Creation with Cancellation Policy

### Test: Create/Edit Service Listing with Cancellation Policy

**Steps:**
1. Log in as a Vendor
2. Navigate to "My Listings" or create a new listing
3. In Step 2 of the listing wizard, scroll to "Cancellation Policy" section
4. Fill in:
   - **Cancellation Policy Text**: Enter a description (e.g., "Cancellations must be made at least 7 days in advance...")
   - **Cancellation Fee Tiers**: 
     - More than 90 days: `0` (0%)
     - 30-90 days: `0.1` (10%)
     - 7-30 days: `0.25` (25%)
     - Less than 7 days: `0.5` (50%)
5. Complete the listing creation
6. Edit the listing and verify the cancellation policy fields are pre-filled

**Expected Results:**
- ✅ Cancellation policy text field accepts multi-line text
- ✅ Fee tier inputs accept decimal values (0-1 range)
- ✅ Default values are shown in helper text
- ✅ Policy is saved and retrievable when editing

---

## 2. COUPLE: Venue-First Booking Rule

### Test: Book Non-Venue Service Without Venue

**Steps:**
1. Log in as a Couple
2. Create a new Wedding Project (if needed)
3. Try to book a non-venue service (e.g., photographer, caterer) directly
   - Via catalog browsing
   - Via 3D venue designer (if venue not selected)

**Expected Results:**
- ✅ Error message: "You must book a confirmed venue before booking other services"
- ✅ Booking request is rejected

### Test: Book Venue First, Then Other Services

**Steps:**
1. Log in as a Couple
2. Create a new Wedding Project
3. **Step 1**: Book a venue service ✅
   - Select a venue from the venue selection screen
   - Submit booking request
4. **Step 2**: As Vendor, accept the venue booking ✅
   - Log in as the venue vendor
   - Go to "Booking Requests"
   - Accept the venue booking (status becomes `pending_deposit_payment`)
5. **Step 3**: As Couple, book other services ✅
   - Return to couple account
   - Try booking a photographer or caterer
   - Try adding items in 3D venue designer

**Expected Results:**
- ✅ After venue is accepted, couple can book other services
- ✅ Other service bookings are linked to the venue booking (`dependsOnVenueBookingId`)
- ✅ Booking requests are created successfully

---

## 3. COUPLE: Contract Review & Acknowledgment

### Test: Contract Review Modal in 3D Venue Designer

**Steps:**
1. Log in as a Couple ✅
2. Navigate to 3D Venue Designer (with a venue already selected) ✅
3. Add some services to the 3D design ✅ 
4. Click "Proceed to Checkout" in the Design Summary ✅
5. Review the Contract Review Modal ✅

**Expected Results:**
- ✅ Contract Review Modal appears **before** Checkout Modal
- ✅ Modal shows:
  - List of vendors with expandable sections
  - Services for each vendor with quantities and prices
  - Payment schedule (10% deposit, 90% final)
  - Cancellation policy for each vendor
  - Cancellation fee tiers
  - Liability terms
  - Total summary
- ✅ Checkbox for acknowledgment is required
- ✅ "Acknowledge & Continue" button is disabled until checkbox is checked
- ✅ Clicking "Acknowledge & Continue" opens the Checkout Modal

### Test: Contract Review for Non-3D Services

**Steps:**
1. Log in as a Couple
2. Browse catalog and add services to cart (non-3D flow)
3. Proceed to checkout
4. Verify contract review appears (if implemented for non-3D flow)

**Expected Results:**
- ✅ Contract review appears before payment (if implemented)

---

## 4. COUPLE: Booking Requests & Vendor Acceptance

### Test: Submit Booking Request

**Steps:** ✅
1. Log in as a Couple
2. Book a service (venue or other)
3. Submit booking request
4. Check "My Bookings" → "Pending" tab

**Expected Results:**
- ✅ Booking appears in "Pending" tab with status `pending_vendor_confirmation`
- ✅ Booking shows:
  - Venue name (if applicable)
  - Event date and time
  - Vendor name
  - Service details
  - Total amount

### Test: Vendor Accepts Booking

**Steps:** ✅
1. As Vendor, go to "Booking Requests"
2. View the booking request
3. Verify venue and time are displayed
4. Accept the booking

**Expected Results:**
- ✅ Booking status changes to `pending_deposit_payment`
- ✅ Deposit due date is set (7 days from acceptance)
- ✅ Couple receives notification
- ✅ Booking appears in couple's "Pending Payment" tab

---

## 5. COUPLE: Payment Flow

### Test: Deposit Payment

**Steps:** ✅
1. As Couple, go to "My Bookings" → "Pending Payment"
2. Click on a booking with status `pending_deposit_payment`
3. Pay the deposit (10% of total)
4. Complete payment

**Expected Results:**
- ✅ Payment is recorded
- ✅ Booking status changes to `confirmed`
- ✅ Vendor receives notification

### Test: Final Payment

**Steps:** ✅
1. Wait for booking to transition to `pending_final_payment` (1 week before wedding date)
   - OR manually update booking status in database for testing
2. As Couple, go to "My Bookings" → "Pending Payment"
3. Pay the final payment (90% remaining)
4. Complete payment

**Expected Results:**
- ✅ Payment is recorded
- ✅ Booking status changes to `completed`
- ✅ Vendor receives notification

---

## 6. COUPLE: Cancellation Flow

### Test: Cancel Booking (No Fee)

**Steps:** ✅
1. As Couple, go to "My Bookings"
2. Select a booking with status `pending_vendor_confirmation` or `pending_deposit_payment`
3. Click "Cancel Booking"
4. In the cancellation dialog:
   - **Required**: Select or type a cancellation reason
   - Preset options should auto-fill the text field
   - You can edit the reason after selecting a preset
5. Confirm cancellation

**Expected Results:**
- ✅ Cancellation reason field is required
- ✅ Preset reason chips are available (e.g., "Change of plans", "Found another vendor", etc.)
- ✅ Clicking a preset fills the text field
- ✅ Text field can be edited
- ✅ "Confirm" button is disabled until reason is provided
- ✅ If no fee: Booking is cancelled immediately
- ✅ Cancellation record is created
- ✅ Booking appears in "Cancelled" tab

### Test: Cancel Booking (With Fee)

**Steps:** ✅
1. As Couple, go to "My Bookings"
2. Select a booking with status `confirmed` or `pending_final_payment`
3. Click "Cancel Booking"
4. Review the cancellation fee preview
5. Provide cancellation reason (required)
6. Confirm cancellation
7. Pay the cancellation fee

**Expected Results:**
- ✅ Cancellation fee is calculated based on:
  - Days until wedding date
  - Cancellation fee tiers from service listing
- ✅ Fee preview shows the amount
- ✅ Reason is required
- ✅ After confirmation, payment modal appears for cancellation fee
- ✅ After payment, booking is cancelled
- ✅ Cancellation record includes fee amount

### Test: Cancelled Bookings Tab

**Steps:** ✅
1. As Couple, go to "My Bookings"
2. Click on "Cancelled" tab (5th tab)
3. View cancelled bookings

**Expected Results:**
- ✅ "Cancelled" tab exists and is functional
- ✅ Shows bookings with status `cancelled_by_couple` or `cancelled_by_vendor`
- ✅ Displays:
  - Venue name
  - Event date and time
  - Cancellation reason
  - Cancellation fee (if applicable)
  - Refund status (if applicable)

---

## 7. VENDOR: Cancellation Flow

### Test: Vendor Cancels Booking

**Steps:**
1. As Vendor, go to "Booking Requests"
2. Select an active booking
3. Cancel the booking
4. Provide reason (optional for vendor)

**Expected Results:** ✅
- ✅ Vendor can cancel their bookings
- ✅ No cancellation fee is charged
- ✅ Couple receives notification
- ✅ If refund is required, couple is notified
- ✅ Booking status changes to `cancelled_by_vendor`

---

## 8. VENUE CANCELLATION & DEPENDENT BOOKINGS

### Test: Venue Cancellation with Dependent Bookings

**Steps:**
1. **Setup**:
   - Couple books a venue (status: `confirmed`)
   - Couple books other services that depend on the venue
   - Other services are also `confirmed`
2. **Cancel Venue** (as vendor or couple):
   - Cancel the venue booking
   - Reason: "Venue unavailable due to disaster"
3. **Check Dependent Bookings**:
   - Dependent bookings should enter a "grace period"
   - Status should remain active (not immediately cancelled)
4. **Grace Period Scenario A - Couple Finds New Venue**:
   - Couple books a new venue
   - Dependent bookings should update to depend on the new venue
   - No auto-cancellation occurs
5. **Grace Period Scenario B - No New Venue by Wedding Date**:
   - Wait until wedding date arrives (or manually set date in database)
   - Run auto-cancellation service
   - Dependent bookings should auto-cancel
   - Refund should be flagged

**Expected Results:**
- ✅ When venue is cancelled, dependent bookings are notified
- ✅ Dependent bookings enter grace period (not immediately cancelled)
- ✅ If new venue is booked, dependencies update automatically
- ✅ If no new venue by wedding date, dependent bookings auto-cancel
- ✅ Auto-cancelled bookings have `refundRequired: true`
- ✅ Couple receives email about refund

---

## 9. AUTO-CANCELLATION SERVICE

### Test: Overdue Deposit Payment

**Steps:**
1. Create a booking with status `pending_deposit_payment`
2. Set `depositDueDate` to a past date (e.g., 2 days ago)
3. Wait for auto-cancellation service to run (or trigger manually)
4. Check booking status

**Expected Results:**
- ✅ Booking status changes to `cancelled_by_couple` (system auto-cancel)
- ✅ Cancellation record is created
- ✅ Couple receives notification
- ✅ No refund is required (no payment was made)

### Test: Overdue Final Payment

**Steps:**
1. Create a booking with status `pending_final_payment`
2. Set `finalDueDate` to a past date
3. Wait for auto-cancellation service to run
4. Check booking status

**Expected Results:**
- ✅ Booking status changes to `cancelled_by_couple`
- ✅ Cancellation record is created
- ✅ Refund is calculated (deposit amount)
- ✅ `refundRequired: true`, `refundStatus: 'pending'`
- ✅ Couple receives notification about refund

### Test: Payment Reminders

**Steps:**
1. Create bookings with:
   - `depositDueDate` = 3 days from now
   - `finalDueDate` = 3 days from now
2. Wait for payment reminder service to run
3. Check email notifications

**Expected Results:**
- ✅ Reminder emails are sent 3 days before due dates
- ✅ Emails include:
   - Booking details
   - Due date
   - Amount due
   - Payment link

---

## 10. ADMIN: Refund Management

### Test: View Cancellations Requiring Refunds

**Steps:**
1. Log in as Admin
2. Navigate to "Refunds & Cancellations" (in admin sidebar)
3. View the cancellations table

**Expected Results:**
- ✅ Table shows all cancellations
- ✅ Columns include:
  - Booking ID
  - Couple name/email
  - Vendor name
  - Cancellation reason
  - Refund Required (Yes/No)
  - Refund Amount
  - Refund Status (Not Applicable / Pending / Processed)
  - Cancelled Date
- ✅ Filterable/sortable table

### Test: Update Refund Status

**Steps:**
1. As Admin, go to "Refunds & Cancellations"
2. Find a cancellation with `refundStatus: 'pending'`
3. Click "Edit" or "Update Refund"
4. Update:
   - Refund Status: `processed`
   - Refund Method: "Bank transfer - Maybank xxxx"
   - Refund Notes: "Processed on [date]"
5. Save changes

**Expected Results:**
- ✅ Refund status updates successfully
- ✅ Refund method and notes are saved
- ✅ Changes are reflected in the table
- ✅ Couple can see updated status (if implemented in frontend)

---

## 11. VENUE SELECTION UI

### Test: Venue Availability Display

**Steps:**
1. As Couple, create a new project
2. Go to Step 2: Venue Selection
3. View available venues

**Expected Results:**
- ✅ Venues with no bookings show as "Available"
- ✅ Venues with existing bookings for the selected date show as "Unavailable"
- ✅ Images don't blink/refresh constantly
- ✅ Availability status is accurate

### Test: Venue Details Modal with 3D Preview

**Steps:**
1. As Couple, in venue selection screen
2. Click the "i" (info) button on a venue card
3. View the venue details modal

**Expected Results:**
- ✅ Modal shows:
  - Venue name and description
  - Venue images
  - Vendor information
  - **3D Model Preview** (if venue has 3D design)
- ✅ 3D preview loads and displays correctly
- ✅ If no 3D model, shows placeholder or message
- ✅ Modal can be closed

---

## 12. BOOKING DETAILS DISPLAY

### Test: Venue & Time in Booking Views

**Steps:**
1. As Couple, go to "My Bookings" → any tab
2. View booking cards
3. As Vendor, go to "Booking Requests"
4. View booking table/details

**Expected Results:**
- ✅ **Couple view**: Booking cards show:
  - Venue name (from `project.venueServiceListing.name`)
  - Event date and time (`project.eventStartTime` and `project.eventEndTime`)
- ✅ **Vendor view**: Booking details show:
  - Venue name
  - Event date and time
- ✅ Information is clearly displayed and readable

### Test: Booked Suppliers View

**Steps:**
1. As Couple, go to "Booked Suppliers"
2. View confirmed suppliers

**Expected Results:**
- ✅ Each supplier card shows:
  - Vendor name
  - Service name
  - **Venue name**
  - **Event date and time**
  - Status

---

## 13. NOTIFICATIONS

### Test: Email Notifications

**Steps:**
1. Perform various actions (booking created, accepted, cancelled, etc.)
2. Check email inbox (or console logs if SMTP is not configured)

**Expected Results:**
- ✅ **Booking Created**: Couple receives confirmation
- ✅ **Booking Accepted**: Couple receives notification with payment instructions
- ✅ **Booking Cancelled**: Both parties receive notification
- ✅ **Payment Reminder**: Sent 3 days before due dates
- ✅ **Venue Cancelled**: Couple and dependent booking vendors receive notification
- ✅ **Dependent Booking Auto-Cancelled**: Couple receives notification with refund info
- ✅ **Refund Required**: Couple receives email asking for preferred refund method

---

## 14. EDGE CASES & ERROR HANDLING

### Test: Cancel Already Cancelled Booking

**Steps:**
1. Cancel a booking
2. Try to cancel it again

**Expected Results:**
- ✅ Error: "Booking is already cancelled"

### Test: Cancel Completed Booking

**Steps:**
1. Complete a booking (status: `completed`)
2. Try to cancel it

**Expected Results:**
- ✅ Error: "Booking cannot be cancelled. Current status: completed"

### Test: Book Service with Inactive Listing

**Steps:**
1. As Vendor, deactivate a listing
2. As Couple, try to book that listing

**Expected Results:**
- ✅ Error: "Service listing not found or inactive"

### Test: Book Non-Venue Service When Venue is Pending

**Steps:**
1. Book a venue (status: `pending_vendor_confirmation`)
2. Try to book another service

**Expected Results:**
- ✅ Error: "You must book a confirmed venue before booking other services"
- ✅ Venue must be at least `pending_deposit_payment` status

---

## 15. DATABASE VERIFICATION

### Test: Database Schema

**Steps:**
1. Check Prisma schema for all new fields
2. Verify migrations are applied

**Expected Results:**
- ✅ `Booking` model has:
  - `dependsOnVenueBookingId` (String?)
  - Relations: `dependsOnVenue`, `dependentBookings`
- ✅ `Cancellation` model has:
  - `refundRequired` (Boolean)
  - `refundAmount` (Decimal?)
  - `refundStatus` (RefundStatus enum)
  - `refundMethod` (String?)
  - `refundNotes` (String?)
- ✅ `ServiceListing` model has:
  - `cancellationPolicy` (String?)
  - `cancellationFeeTiers` (Json?)

---

## Testing Checklist Summary

### Vendor Features
- [ ] Create listing with cancellation policy
- [ ] Edit listing cancellation policy
- [ ] Accept booking requests
- [ ] View venue and time in booking requests
- [ ] Cancel booking as vendor

### Couple Features
- [ ] Venue-first booking rule enforcement
- [ ] Book venue first, then other services
- [ ] Contract review modal appears before checkout
- [ ] Acknowledge contract terms
- [ ] View booking requests with venue/time
- [ ] Pay deposit payment
- [ ] Pay final payment
- [ ] Cancel booking with reason (no fee)
- [ ] Cancel booking with reason and fee
- [ ] View cancelled bookings tab
- [ ] View venue details with 3D preview
- [ ] Venue availability displays correctly

### Admin Features
- [ ] View refunds and cancellations page
- [ ] Update refund status
- [ ] Add refund method and notes

### System Features
- [ ] Auto-cancellation for overdue payments
- [ ] Payment reminders sent
- [ ] Venue cancellation with grace period
- [ ] Dependent booking auto-cancellation
- [ ] Refund tracking and notifications
- [ ] Email notifications sent correctly

---

## Troubleshooting

### Issue: Contract Review Modal doesn't appear
- **Check**: `VenueDesigner.js` - `onProceedToCheckout` should open `ContractReviewModal` first
- **Check**: `ContractReviewModal.jsx` is properly exported

### Issue: Venue-first rule not enforced
- **Check**: `booking.routes.js` - `POST /bookings` endpoint checks for venue booking
- **Check**: Venue booking status must be at least `pending_deposit_payment`

### Issue: Cancellation reason not required
- **Check**: `cancelBookingSchema` requires `reason` for couple cancellations
- **Check**: Frontend `MyBookings.jsx` has reason input field

### Issue: 3D preview not showing
- **Check**: `venue.routes.js` includes `designElement` and `components` in API response
- **Check**: `Model3DViewer` component receives proper data

### Issue: Refund status not updating
- **Check**: Admin route `PATCH /admin/cancellations/:id` is working
- **Check**: Frontend `RefundsAndCancellations.jsx` calls the correct endpoint

---

## Notes

- **Payment Gateway**: If using a test payment gateway, ensure test mode is enabled
- **Email Notifications**: If SMTP is not configured, check console logs for notification content
- **Auto-Cancellation Service**: Runs on a schedule; for testing, you may need to trigger it manually or wait for the scheduled time
- **Grace Period**: Dependent bookings remain active until wedding date if venue is cancelled; auto-cancel only occurs if no replacement venue is found

---

**Last Updated**: Based on implementation as of latest changes

