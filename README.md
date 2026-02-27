# Wedding Planning Platform

A comprehensive full-stack wedding planning application that connects couples with wedding vendors, featuring 3D venue design, budget tracking, booking management, and vendor reviews.

## Features

### For Couples
- **3D Venue Design**: Interactive 3D venue planning with drag-and-drop elements
- **Budget Management**: Track expenses, manage categories, and monitor spending
- **Vendor Discovery**: Browse and compare wedding vendors by category
- **Booking System**: Reserve services with secure payment processing
- **Review System**: Rate and review vendors after completed services

### For Vendors
- **Service Listings**: Create detailed service offerings with pricing models
- **3D Design Elements**: Upload and manage 3D models for venue design
- **Booking Management**: Handle reservations and payment processing
- **Availability Management**: Set time slots and manage capacity
- **Review Management**: Respond to customer feedback

### For Administrators
- **User Management**: Manage couples, vendors, and system users
- **Analytics Dashboard**: Monitor platform usage and revenue
- **Payment Oversight**: Track transactions and manage payouts

## Tech Stack

### Frontend
- **React** - UI framework with hooks and context
- **React Router** - Client-side routing
- **CSS Modules** - Component-scoped styling

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Prisma** - ORM and database toolkit
- **PostgreSQL** - Primary database
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing

### Additional Tools
- **Multer** - File upload handling
- **Nodemailer** - Email notifications
- **Zod** - Schema validation
- **WebSocket** - Real-time messaging

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL database
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd wedding-platform
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   npm install

   # Install backend dependencies
   cd server
   npm install
   cd ..
   ```

3. **Environment Setup**
   ```bash
   # Copy environment template
   cp server/.env.example server/.env

   # Edit server/.env with your configuration
   # Required: DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
   ```

4. **Database Setup**
   ```bash
   cd server

   # Generate Prisma client
   npx prisma generate

   # Run database migrations
   npx prisma migrate dev

   # Seed the database with test data
   npx prisma db seed
   ```

### Development

1. **Start the backend server**
   ```bash
   cd server
   npm run dev
   ```
   Server runs on `http://localhost:4000`

2. **Start the frontend (in a new terminal)**
   ```bash
   npm start
   ```
   Frontend runs on `http://localhost:3000`

## Project Structure

```
wedding-platform/
├── public/                 # Static assets
│   ├── images/            # Image assets
│   └── favicon files
├── src/                   # React frontend
│   ├── components/        # Reusable UI components
│   ├── pages/            # Page components
│   ├── services/         # API service functions
│   ├── utils/            # Utility functions
│   └── App.js            # Main app component
├── server/                # Node.js backend
│   ├── middleware/        # Express middleware
│   ├── routes/           # API route handlers
│   ├── services/         # Business logic services
│   ├── utils/            # Server utilities
│   ├── prisma/           # Database schema and migrations
│   └── app.js            # Express app setup
├── assets/               # (Should be removed - IDE cache)
├── scripts/              # (Should be removed - test data scripts)
└── README.md             # This file
```

## Test Accounts

All test accounts use password: **`password123`**

### Couples
- `couple1@example.com` - Has wedding project and bookings
- `couple2@example.com` - Basic couple account

### Vendors
- `venue@example.com` - Venue services
- `photographer@example.com` - Photography services
- `caterer@example.com` - Catering services
- `florist@example.com` - Floral services
- `dj@example.com` - DJ/music services

### Admin
- Configured via `.env` file (`ADMIN_EMAIL`, `ADMIN_PASSWORD`)