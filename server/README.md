# Wedding Platform Server

## Database Setup

### Running Migrations

```bash
# Reset database and run all migrations + seed
npx prisma migrate reset

# Or run migrations only
npx prisma migrate dev

# Run seed separately
npx prisma db seed
```

## Test Credentials

All test accounts use the password: **`password123`**

### Couple Accounts
- **Couple 1**: `couple1@example.com` / `password123`
  - Project: "Summer Wedding 2025"
  - Has booking with venue vendor
  
- **Couple 2**: `couple2@example.com` / `password123`
  - Project: "Garden Wedding"

### Vendor Accounts
- **Venue Vendor**: `venue@example.com` / `password123`
  - Services: Grand Ballroom A (fixed_package), Premium Table Set (per_unit)
  
- **Caterer**: `caterer@example.com` / `password123`
  - Service: Premium Buffet Catering (tiered_package)
  
- **Florist**: `florist@example.com` / `password123`
  - Service: Premium Rose Centerpieces (per_table)
  
- **Photographer**: `photographer@example.com` / `password123`
  - Service: Full Day Wedding Photography (fixed_package)
  
- **DJ**: `dj@example.com` / `password123`
  - Service: Professional DJ & Sound System (time_based)

### System Admin
- Configured via `.env` variables:
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD`

## Seed Data Overview

The seed script creates:

- **7 Users**: 2 couples + 5 vendors
- **6 Service Listings**: Covering all 5 pricing models
  - `fixed_package`: Photographer, Venue
  - `per_table`: Centerpieces
  - `per_unit`: Table Set (with components)
  - `tiered_package`: Catering (with tiered pricing JSON)
  - `time_based`: DJ (with hourly rate)
- **3 Design Elements**: Table, Chair, Centerpiece (with 3D model references)
- **2 Wedding Projects**: With budgets, categories, expenses, and tasks
- **1 Booking**: With payments
- **1 Conversation**: With sample messages

## Pricing Models

The database supports 5 pricing models:

1. **`fixed_package`**: One unit per booking (e.g., photographer, venue)
2. **`per_table`**: Units = number of tables placed in design (e.g., centerpieces)
3. **`per_unit`**: Units = number of items placed (e.g., table sets)
4. **`tiered_package`**: Advanced volume pricing with JSON rules
5. **`time_based`**: Pricing based on event duration (uses `hourlyRate`)

## Development

```bash
# Start development server
npm run dev

# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

