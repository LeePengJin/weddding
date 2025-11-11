require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const uploadRoutes = require('./routes/upload.routes');
const serviceListingRoutes = require('./routes/serviceListing.routes');
const timeSlotRoutes = require('./routes/timeSlot.routes');
const bookingRoutes = require('./routes/booking.routes');
const availabilityRoutes = require('./routes/availability.routes');
const projectRoutes = require('./routes/project.routes');
const venueRoutes = require('./routes/venue.routes');

const app = express();

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/upload', uploadRoutes);
app.use('/service-listings', serviceListingRoutes);
app.use('/time-slots', timeSlotRoutes);
app.use('/bookings', bookingRoutes);
app.use('/availability', availabilityRoutes);
app.use('/projects', projectRoutes);
app.use('/venues', venueRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

module.exports = app;

