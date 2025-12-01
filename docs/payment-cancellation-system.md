# Payment & Cancellation System Design

_Last updated: Based on final discussion_

## Overview

This document outlines the payment due dates, auto-cancellation, and cancellation fee system for the wedding booking platform.

## Database Schema Changes

### 1. BookingStatus Enum Updates
- **Removed**: `cancelled`
- **Added**: 
  - `cancelled_by_couple` - When couple cancels the booking
  - `cancelled_by_vendor` - When vendor cancels the booking

### 2. PaymentType Enum Updates
- **Added**: `cancellation_fee` - For cancellation fee payments

### 3. ServiceListing Model Additions
- `cancellationPolicy` (String?) - Text description of cancellation policy
- `cancellationFeeTiers` (Json?) - Date-based fee tiers:
  ```json
  {
    ">90": 0.0,      // No fee if cancelled >90 days before wedding
    "30-90": 0.10,   // 10% fee if cancelled 30-90 days before
    "7-30": 0.25,    // 25% fee if cancelled 7-30 days before
    "<7": 0.50       // 50% fee if cancelled <7 days before
  }
  ```

### 4. Booking Model
- `depositDueDate` (DateTime?) - Due date for deposit payment
- `finalDueDate` (DateTime?) - Due date for final payment (already exists)
- `cancellation` (Cancellation?) - One-to-one relation

### 5. New Cancellation Model
```prisma
model Cancellation {
  id               String   @id @default(uuid()) // Use prefixedUlid('cncl') when creating
  bookingId        String   @unique
  cancelledAt      DateTime @default(now())
  cancelledBy      String   // Must be either booking.coupleId or booking.vendorId
  cancellationReason String?
  cancellationFee  Decimal? @db.Decimal(12, 2) // null if vendor cancelled or fee = 0
  cancellationFeePaymentId String? // Reference to Payment (null if fee = 0 or vendor cancelled)
  
  booking Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
}
```

## Status Flow

### Normal Booking Flow
```
pending_vendor_confirmation
  → pending_deposit_payment (after vendor confirms)
  → confirmed (after deposit paid)
  → pending_final_payment (1 week before wedding date)
  → completed (after final payment and wedding date passed)
```

### Auto-Cancellation Flow

#### Deposit Payment Overdue
- If `depositDueDate` has passed and deposit is unpaid:
  - Status changes to `cancelled_by_couple` (auto-cancel)
  - No cancellation fee (booking not confirmed yet)

#### Final Payment Overdue
- When booking enters 1 week before wedding:
  - Status automatically changes from `confirmed` to `pending_final_payment`
- If `finalDueDate` has passed and final payment is unpaid:
  - Status changes to `cancelled_by_couple` (permanent auto-cancel)
  - No cancellation fee (since final payment wasn't made)

### Couple Cancellation Flow

```
any status (except cancelled/rejected/completed)
  → User clicks "Cancel"
  → Calculate fee based on days until reservedDate:
      - >90 days: 0% (no fee)
      - 30-90 days: 10%
      - 7-30 days: 25%
      - <7 days: 50%
  → Calculate: feeAmount = (totalBookingAmount * feePercentage)
  → Calculate: amountAlreadyPaid = sum of all payments
  → Calculate: feeDifference = feeAmount - amountAlreadyPaid
  
  → If feeDifference > 0:
      - Require payment of feeDifference
      - After payment confirmed:
          - Create Payment record (type: cancellation_fee)
          - Create Cancellation record
          - Update booking status to cancelled_by_couple
      - If payment not completed: No changes (booking stays in current status)
  
  → If feeDifference ≤ 0:
      - Create Cancellation record (no payment needed)
      - Update booking status to cancelled_by_couple
  
  → If fee = 0 (cancelled >90 days before):
      - Create Cancellation record immediately
      - Update booking status to cancelled_by_couple
```

### Vendor Cancellation Flow

```
any status (except cancelled/rejected/completed)
  → Vendor clicks "Cancel"
  → Create Cancellation record:
      - cancelledBy = vendorId
      - cancellationFee = null (no fee for vendor cancellation)
      - cancellationFeePaymentId = null
  → Update booking status to cancelled_by_vendor
```

## Validation Rules

1. **`cancelledBy` Validation**:
   - Must be either `booking.coupleId` or `booking.vendorId`
   - Enforced at application level

2. **Cancellation Fee Calculation**:
   - If `cancelledBy` = `vendorId` → fee = null (no fee)
   - If `cancelledBy` = `coupleId` → calculate based on:
     - `cancellationFeeTiers` from `ServiceListing`
     - Days until `booking.reservedDate`
     - Total booking amount (sum of `SelectedService.totalPrice`)

3. **Payment Requirement**:
   - Fee is deducted from amount already paid (Option B)
   - If `feeAmount > amountAlreadyPaid` → require payment of difference
   - If `feeAmount ≤ amountAlreadyPaid` → no additional payment needed

4. **Cancellation ID**:
   - Must use `prefixedUlid('cncl')` when creating
   - Must match `bookingId` format (though they're different fields)

## Implementation Checklist

### Phase 1: Database Migration
- [x] Update `BookingStatus` enum
- [x] Update `PaymentType` enum
- [x] Add `cancellationPolicy` and `cancellationFeeTiers` to `ServiceListing`
- [x] Create `Cancellation` model
- [ ] Create and run migration

### Phase 2: Auto-Cancellation Logic
- [ ] Implement scheduled job to check deposit due dates
- [ ] Implement scheduled job to check final due dates
- [ ] Implement status transition: `confirmed` → `pending_final_payment` (1 week before)
- [ ] Implement auto-cancel for overdue deposit
- [ ] Implement auto-cancel for overdue final payment

### Phase 3: Cancellation Flow
- [ ] Implement cancellation fee calculation utility
- [ ] Implement couple cancellation endpoint
- [ ] Implement vendor cancellation endpoint
- [ ] Implement cancellation fee payment flow
- [ ] Add validation: `cancelledBy` must match `coupleId` or `vendorId`

### Phase 4: UI/UX
- [ ] Add cancellation button/action in booking details
- [ ] Display cancellation policy in service listing
- [ ] Show cancellation fee calculation before confirmation
- [ ] Payment flow for cancellation fees
- [ ] Display cancellation records in booking history

### Phase 5: Notifications
- [ ] Send reminder for deposit due date (e.g., 3 days before)
- [ ] Send reminder for final payment due date (e.g., 3 days before)
- [ ] Send notification when booking auto-cancelled
- [ ] Send notification when cancellation fee is required
- [ ] Send notification when cancellation is completed

## Notes

- **Cancellation Policy**: Per listing (each `ServiceListing` can have its own policy)
- **No Refund**: When cancellation fee is deducted from paid amount, no refund is issued
- **Vendor Cancellation**: No fee, no payment required
- **Auto-Cancel**: Permanent cancellation (no recovery)
- **Final Payment Timing**: Automatically transitions to `pending_final_payment` 1 week before wedding date

