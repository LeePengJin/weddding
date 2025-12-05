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

## 8. VENUE CANCELLATION & DEPENDENT BOOKINGS (WITH GRACE PERIOD)

### Test: Venue Cancellation - Grace Period Setup

**Steps:**
1. **Setup**:
   - Couple books a venue (status: `confirmed`) ✅
   - Couple books other services that depend on the venue (e.g., photographer, caterer) ✅
   - Other services are also `confirmed` or `pending_deposit_payment` ✅
   - Note the original `depositDueDate` and `finalDueDate` for dependent bookings ✅
2. **Cancel Venue** (as vendor or couple):
   - Cancel the venue booking ✅
   - Reason: "Venue unavailable due to disaster" ✅
3. **Verify Grace Period Setup**:
   - Check database: Query dependent bookings ✅
   - Verify `isPendingVenueReplacement = true` ✅
   - Verify `originalDepositDueDate` and `originalFinalDueDate` are stored ✅
   - Verify `venueCancellationDate` is set ✅
   - Verify `gracePeriodEndDate` is calculated (min(14 days, days until wedding)) ✅
   - Verify `depositDueDate` and `finalDueDate` are extended to `gracePeriodEndDate` ✅

**Expected Results:**
- ✅ Dependent bookings are NOT immediately cancelled
- ✅ `isPendingVenueReplacement` flag is set to `true`
- ✅ Original due dates are preserved in `originalDepositDueDate` and `originalFinalDueDate`
- ✅ Current due dates are extended to `gracePeriodEndDate`
- ✅ Grace period is calculated correctly (14 days or until wedding date, whichever is shorter)
- ✅ Couple receives email notification about venue cancellation
- ✅ Each dependent vendor receives email notification

### Test: Payment Blocking During Grace Period

**Steps:**
1. **Setup**: Follow steps from "Venue Cancellation - Grace Period Setup" above
2. **Try to Make Payment**:
   - As Couple, go to "My Bookings" → "Pending Payment" ✅
   - Select a dependent booking (photographer, caterer, etc.) ✅
   - Try to pay deposit or final payment ✅
3. **Verify Payment Block**:
   - Check if payment button is disabled or shows error ✅
   - Try to make payment via API (if testing backend directly) ✅

**Expected Results:**
- ✅ Payment is completely blocked ✅
- ✅ Error message: "Payment paused due to venue cancellation. Please select a replacement venue first." ✅
- ✅ Booking status remains unchanged (e.g., `pending_deposit_payment` or `confirmed`) ✅
- ✅ UI shows warning indicator that venue replacement is pending ✅

### Test: Replacement Venue Found - Scenario A

**Steps:**
1. **Setup**: Follow steps from "Venue Cancellation - Grace Period Setup" above
2. **Couple Selects New Venue**:
   - As Couple, go to Project Dashboard ✅
   - If venue was cancelled, click "Change Venue" button ✅
   - Select a new venue from the venue selection modal ✅
   - Confirm selection ✅
3. **Verify Dependent Bookings Updated**:
   - Check database: Query dependent bookings ✅
   - Verify `isPendingVenueReplacement = false` ✅
   - Verify `dependsOnVenueBookingId` is updated to new venue booking ID ✅
   - Verify `depositDueDate` is recalculated:
     - Calculate: `remainingDays = originalDepositDueDate - venueCancellationDate` ✅
     - New `depositDueDate = today + remainingDays` (capped at wedding date - 1 day) ✅
   - Verify `finalDueDate = wedding date - 7 days` (or wedding date - 1 day if that's already passed) ✅
   - Verify grace period fields are cleared (`originalDepositDueDate`, `originalFinalDueDate`, `venueCancellationDate`, `gracePeriodEndDate` are null) ✅
4. **Verify Payments Unblocked**:
   - As Couple, try to make payment again ✅
   - Payment should now be allowed ✅

**Expected Results:**
- ✅ Dependent bookings are updated to depend on new venue ✅
- ✅ Due dates are recalculated correctly based on remaining days ✅
- ✅ Final due date is set to one week before wedding (or wedding - 1 day if passed) ✅
- ✅ Grace period fields are cleared ✅
- ✅ Payments are unblocked ✅
- ✅ Each dependent vendor receives email notification: "Good News: Replacement Venue Found" ✅
- ✅ Email includes new venue name and updated payment schedule ✅

### Test: Replacement Venue Found - Due Date Recalculation Edge Cases

**Steps:**
1. **Setup Edge Case A - Original Due Date Not Passed**:
   - Create booking with `depositDueDate` = 10 days from now
   - Cancel venue 5 days from now
   - Wait 2 days (so today is 3 days before original due date)
   - Select replacement venue
   - Verify new `depositDueDate` = today + 5 days (remaining days from cancellation)
2. **Setup Edge Case B - Original Due Date Would Pass**:
   - Create booking with `depositDueDate` = 3 days from now
   - Cancel venue 5 days from now
   - Wait 4 days (so today is 1 day before original due date)
   - Select replacement venue
   - Verify new `depositDueDate` = today + 2 days (remaining days, but capped appropriately)
3. **Setup Edge Case C - Final Due Date Already Passed**:
   - Create booking with `finalDueDate` = 2 days ago
   - Cancel venue (grace period extends final due date)
   - Select replacement venue
   - Verify new `finalDueDate` = wedding date - 1 day (minimum time)

**Expected Results:**
- ✅ Due dates are recalculated correctly in all edge cases
- ✅ No due dates are set in the past
- ✅ Final due date is always at least wedding date - 1 day

### Test: Auto-Cancellation When Grace Period Expires - Scenario B

**Steps:**
1. **Setup**: Follow steps from "Venue Cancellation - Grace Period Setup" above
2. **Wait for Grace Period to Expire**:
   - Option A: Wait until `gracePeriodEndDate` passes (or manually set `gracePeriodEndDate` to past date in database)
   - Option B: For testing, manually update `gracePeriodEndDate` to yesterday in database
3. **Trigger Auto-Cancellation**:
   - Wait for scheduled auto-cancellation service to run (runs daily)
   - OR manually trigger: Check `server/services/autoCancellationService.js` and call `checkVenueCancellationDependentBookings()`
4. **Verify Auto-Cancellation**:
   - Check database: Query dependent bookings
   - Verify bookings with expired grace period are cancelled
   - Verify status = `cancelled_by_vendor` (system auto-cancel)
   - Verify cancellation record is created with:
     - `cancellationReason` includes grace period end date
     - `refundRequired: true` if any payment was made
     - `refundStatus: 'pending'` if refund required
5. **Verify No Replacement Venue**:
   - Ensure no active venue booking exists for the project
   - If replacement venue exists, auto-cancellation should NOT occur

**Expected Results:**
- ✅ Only bookings with `gracePeriodEndDate` in the past are auto-cancelled
- ✅ Bookings with replacement venue are NOT auto-cancelled
- ✅ Cancellation reason mentions grace period end date
- ✅ Refunds are flagged for bookings with payments
- ✅ Couple receives email notification about auto-cancellation
- ✅ Email includes refund information if applicable

### Test: Grace Period Calculation

**Steps:**
1. **Test Case A - Wedding Far Away (>14 days)**:
   - Create project with wedding date = 30 days from now
   - Cancel venue booking
   - Verify `gracePeriodEndDate` = cancellation date + 14 days
2. **Test Case B - Wedding Soon (<14 days)**:
   - Create project with wedding date = 5 days from now
   - Cancel venue booking
   - Verify `gracePeriodEndDate` = wedding date (not 14 days)
3. **Test Case C - Wedding Very Soon (2 days)**:
   - Create project with wedding date = 2 days from now
   - Cancel venue booking
   - Verify `gracePeriodEndDate` = wedding date (2 days)

**Expected Results:**
- ✅ Grace period = min(14 days, days until wedding)
- ✅ Grace period never exceeds wedding date
- ✅ Due dates are extended to `gracePeriodEndDate`

### Test: Venue Cancellation Email Notifications

**Steps:**
1. **Cancel Venue**: ✅
   - Cancel a venue booking with dependent bookings
   - Check email inbox (or console logs)
2. **Verify Couple Email**: ✅
   - Subject: "Important: Venue Booking Cancelled - Action Required"
   - Contains venue name (not vendor name)
   - Contains grace period information
   - Contains list of dependent bookings
3. **Verify Vendor Email**: ✅
   - Each dependent vendor receives email
   - Subject: "Notice: Venue Cancelled for Your Booking"
   - Contains venue name (not vendor name)
   - Contains grace period information
   - Contains recommended actions

**Expected Results:**
- ✅ Couple receives well-designed HTML email ✅
- ✅ Vendors receive well-designed HTML email ✅
- ✅ Emails show correct venue name (from service listing, not vendor name) ✅
- ✅ Grace period is clearly explained ✅
- ✅ Next steps are provided ✅

### Test: Replacement Venue Notification

**Steps:**
1. **Select Replacement Venue**:
   - Follow steps from "Replacement Venue Found - Scenario A"
   - Check email inbox (or console logs)
2. **Verify Vendor Email**:
   - Each dependent vendor receives email
   - Subject: "Good News: Replacement Venue Found - Your Booking Continues"
   - Contains new venue name
   - Contains booking details
   - Mentions payment schedule has been updated

**Expected Results:**
- ✅ Vendors receive well-designed HTML email ✅
- ✅ Email has green/success theme ✅
- ✅ New venue name is clearly displayed ✅
- ✅ Booking continuation is confirmed ✅

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
  - `isPendingVenueReplacement` (Boolean, default: false)
  - `originalDepositDueDate` (DateTime?)
  - `originalFinalDueDate` (DateTime?)
  - `venueCancellationDate` (DateTime?)
  - `gracePeriodEndDate` (DateTime?)
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
- [x] Create listing with cancellation policy
- [x] Edit listing cancellation policy
- [x] Accept booking requests
- [x] View venue and time in booking requests
- [x] Cancel booking as vendor

### Couple Features
- [x] Venue-first booking rule enforcement
- [x] Book venue first, then other services
- [x] Contract review modal appears before checkout
- [x] Acknowledge contract terms
- [x] View booking requests with venue/time
- [x] Pay deposit payment
- [x] Pay final payment
- [x] Cancel booking with reason (no fee)
- [x] Cancel booking with reason and fee
- [x] View cancelled bookings tab
- [x] View venue details with 3D preview
- [x] Venue availability displays correctly

### Admin Features
- [x] View refunds and cancellations page
- [ ] Update refund status
- [ ] Add refund method and notes

### System Features
- [ ] Auto-cancellation for overdue payments
- [ ] Payment reminders sent
- [x] Venue cancellation with grace period setup
- [x] Payment blocking during grace period
- [x] Replacement venue found - dependent bookings updated
- [x] Due date recalculation when replacement venue found
- [ ] Auto-cancellation when grace period expires
- [x] Grace period calculation (14 days or until wedding)
- [x] Venue cancellation email notifications (couple & vendors)
- [x] Replacement venue found email notifications
- [ ] Dependent booking auto-cancellation
- [ ] Refund tracking and notifications
- [x] Email notifications sent correctly

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

### Issue: Payments not blocked during grace period
- **Check**: `booking.routes.js` - Payment endpoint checks `isPendingVenueReplacement`
- **Check**: Database migration applied - `isPendingVenueReplacement` field exists
- **Check**: Frontend shows payment blocked message

### Issue: Due dates not recalculated when replacement venue found
- **Check**: `project.routes.js` - PATCH `/projects/:id` handles venue update
- **Check**: New venue booking exists and is active
- **Check**: Dependent bookings have `isPendingVenueReplacement = true` before update
- **Check**: Calculation logic: `remainingDays = originalDepositDueDate - venueCancellationDate`

### Issue: Auto-cancellation not working
- **Check**: `autoCancellationService.js` - Uses `gracePeriodEndDate` not wedding date
- **Check**: Bookings have `isPendingVenueReplacement = true`
- **Check**: `gracePeriodEndDate` is in the past
- **Check**: No replacement venue booking exists

### Issue: Grace period not calculated correctly
- **Check**: `booking.routes.js` - Venue cancellation logic calculates grace period
- **Check**: Formula: `min(14 days, days until wedding)`
- **Check**: `gracePeriodEndDate` never exceeds wedding date

---

## Notes

- **Payment Gateway**: If using a test payment gateway, ensure test mode is enabled
- **Email Notifications**: If SMTP is not configured, check console logs for notification content
- **Auto-Cancellation Service**: Runs on a schedule; for testing, you may need to trigger it manually or wait for the scheduled time
- **Grace Period**: 
  - Duration: `min(14 days, days until wedding date)`
  - Dependent bookings remain active during grace period
  - Payments are blocked during grace period
  - Auto-cancel only occurs if no replacement venue is found by `gracePeriodEndDate`
  - Due dates are extended to `gracePeriodEndDate` during grace period
- **Replacement Venue**: When couple selects new venue, dependent bookings are automatically updated if an active venue booking exists
- **Due Date Recalculation**: 
  - Deposit: Based on remaining days from cancellation to original due date
  - Final: Always `wedding date - 7 days` (or `wedding date - 1 day` if that's already passed)

---

**Last Updated**: Based on implementation as of latest changes

