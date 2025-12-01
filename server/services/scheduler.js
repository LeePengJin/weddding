/* eslint-disable no-console */
const autoCancellationService = require('./autoCancellationService');

// Configuration
const AUTO_CANCELLATION_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour in milliseconds

let autoCancellationInterval = null;

/**
 * Start the auto-cancellation scheduler
 */
function startAutoCancellationScheduler() {
  if (autoCancellationInterval) {
    console.log('⚠️  Auto-cancellation scheduler is already running');
    return;
  }

  console.log('🚀 Starting auto-cancellation scheduler...');
  console.log(`   Check interval: ${AUTO_CANCELLATION_CHECK_INTERVAL_MS / 1000 / 60} minutes`);

  // Run immediately on startup
  autoCancellationService.runAutoCancellationChecks().catch((err) => {
    console.error('❌ Error in initial auto-cancellation check:', err);
  });
  autoCancellationService.runPaymentReminderChecks().catch((err) => {
    console.error('❌ Error in initial payment reminder check:', err);
  });

  // Then run periodically
  autoCancellationInterval = setInterval(() => {
    autoCancellationService.runAutoCancellationChecks().catch((err) => {
      console.error('❌ Error in scheduled auto-cancellation check:', err);
    });
    autoCancellationService.runPaymentReminderChecks().catch((err) => {
      console.error('❌ Error in scheduled payment reminder check:', err);
    });
  }, AUTO_CANCELLATION_CHECK_INTERVAL_MS);

  console.log('✅ Auto-cancellation scheduler started');
}

/**
 * Stop the auto-cancellation scheduler
 */
function stopAutoCancellationScheduler() {
  if (autoCancellationInterval) {
    clearInterval(autoCancellationInterval);
    autoCancellationInterval = null;
    console.log('🛑 Auto-cancellation scheduler stopped');
  }
}

/**
 * Gracefully shutdown scheduler
 */
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, stopping scheduler...');
  stopAutoCancellationScheduler();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, stopping scheduler...');
  stopAutoCancellationScheduler();
  process.exit(0);
});

module.exports = {
  startAutoCancellationScheduler,
  stopAutoCancellationScheduler,
};

