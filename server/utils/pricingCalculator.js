/**
 * Pricing Calculation Engine
 * 
 * Calculates total cost for service listings based on their pricing model.
 * Supports 4 pricing models: per_unit, per_table, fixed_package, time_based
 */

const { Decimal } = require('@prisma/client/runtime/library');

/**
 * Calculate total cost for a service listing based on pricing model
 * @param {Object} serviceListing - ServiceListing object with pricingPolicy, price, hourlyRate
 * @param {Object} context - Context object with:
 *   - quantity (Number, for per_unit) - Number of units placed/ordered
 *   - tableCount (Number, for per_table) - Number of tables tagged for this service
 *   - eventDuration (Number, for time_based) - Duration in hours
 * @returns {Decimal} Total cost
 * @throws {Error} If required context data is missing for the pricing model
 */
function calculatePrice(serviceListing, context = {}) {
  if (!serviceListing) {
    throw new Error('Service listing is required');
  }

  const { pricingPolicy, price, hourlyRate } = serviceListing;

  let basePrice;
  if (price instanceof Decimal) {
    basePrice = price;
  } else if (typeof price === 'string') {
    basePrice = new Decimal(price);
  } else if (typeof price === 'number') {
    basePrice = new Decimal(price.toString());
  } else {
    throw new Error('Invalid price format');
  }
  
  switch (pricingPolicy) {
    case 'per_unit': {
      if (context.quantity === undefined || context.quantity === null) {
        throw new Error('Quantity is required for per_unit pricing');
      }
      if (context.quantity < 0) {
        throw new Error('Quantity cannot be negative');
      }
      return basePrice.mul(context.quantity);
    }

    case 'per_table': {
      if (context.tableCount === undefined || context.tableCount === null) {
        throw new Error('Table count is required for per_table pricing');
      }
      if (context.tableCount < 0) {
        throw new Error('Table count cannot be negative');
      }
      return basePrice.mul(context.tableCount);
    }

    case 'fixed_package': {
      return basePrice;
    }

    case 'time_based': {
      if (!hourlyRate) {
        throw new Error('Hourly rate is required for time_based pricing');
      }
      if (context.eventDuration === undefined || context.eventDuration === null) {
        throw new Error('Event duration is required for time_based pricing');
      }
      if (context.eventDuration < 0) {
        throw new Error('Event duration cannot be negative');
      }
      
      // Handle hourly rate conversion
      let rate;
      if (hourlyRate instanceof Decimal) {
        rate = hourlyRate;
      } else if (typeof hourlyRate === 'string') {
        rate = new Decimal(hourlyRate);
      } else if (typeof hourlyRate === 'number') {
        rate = new Decimal(hourlyRate.toString());
      } else {
        throw new Error('Invalid hourly rate format');
      }
      return rate.mul(context.eventDuration);
    }

    default: {
      // Fallback to base price for unknown pricing policies
      console.warn(`Unknown pricing policy: ${pricingPolicy}. Using base price.`);
      return basePrice;
    }
  }
}

/**
 * Calculate event duration in hours from start and end times
 * @param {Date|string} eventStartTime - Event start time
 * @param {Date|string} eventEndTime - Event end time
 * @returns {Number} Duration in hours (rounded to 2 decimal places)
 */
function calculateEventDuration(eventStartTime, eventEndTime) {
  if (!eventStartTime || !eventEndTime) {
    throw new Error('Both event start time and end time are required');
  }

  const start = new Date(eventStartTime);
  const end = new Date(eventEndTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format');
  }

  if (end <= start) {
    throw new Error('Event end time must be after start time');
  }

  const durationMs = end - start;
  const durationHours = durationMs / (1000 * 60 * 60);
  
  // Round to 2 decimal places
  return Math.round(durationHours * 100) / 100;
}

/**
 * Validate pricing context for a given pricing policy
 * @param {String} pricingPolicy - Pricing policy type
 * @param {Object} context - Context object to validate
 * @returns {Object} Validation result with isValid and errors array
 */
function validatePricingContext(pricingPolicy, context) {
  const errors = [];

  switch (pricingPolicy) {
    case 'per_unit':
      if (context.quantity === undefined || context.quantity === null) {
        errors.push('Quantity is required');
      } else if (typeof context.quantity !== 'number' || context.quantity < 0) {
        errors.push('Quantity must be a non-negative number');
      }
      break;

    case 'per_table':
      if (context.tableCount === undefined || context.tableCount === null) {
        errors.push('Table count is required');
      } else if (typeof context.tableCount !== 'number' || context.tableCount < 0) {
        errors.push('Table count must be a non-negative number');
      }
      break;

    case 'time_based':
      if (context.eventDuration === undefined || context.eventDuration === null) {
        errors.push('Event duration is required');
      } else if (typeof context.eventDuration !== 'number' || context.eventDuration < 0) {
        errors.push('Event duration must be a non-negative number');
      }
      break;

    case 'fixed_package':
      // No context required for fixed package
      break;

    default:
      errors.push(`Unknown pricing policy: ${pricingPolicy}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = {
  calculatePrice,
  calculateEventDuration,
  validatePricingContext,
};

