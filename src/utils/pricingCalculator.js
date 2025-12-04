import { apiFetch, getTableCount } from '../lib/api';

/**
 * Calculate price for a service listing using the pricing engine
 * @param {Object} serviceListing - Service listing object with pricingPolicy
 * @param {Object} context - Context for price calculation
 * @param {string} venueDesignId - Venue design ID (for per_table pricing)
 * @param {Date} eventStartTime - Event start time (for time_based pricing)
 * @param {Date} eventEndTime - Event end time (for time_based pricing)
 * @returns {Promise<number>} Calculated price
 */
export async function calculateServicePrice(serviceListing, context = {}, venueDesignId = null, eventStartTime = null, eventEndTime = null) {
  if (!serviceListing || !serviceListing.id) {
    throw new Error('Service listing is required');
  }

  const { pricingPolicy } = serviceListing;

  // Build context for pricing calculation
  const pricingContext = { ...context };
  
  // Validate context before making API call
  // For per_unit pricing, ensure quantity is valid
  if (pricingPolicy === 'per_unit') {
    if (pricingContext.quantity === undefined || pricingContext.quantity === null) {
      console.warn(`Invalid context for per_unit pricing: quantity is ${pricingContext.quantity}`);
      return parseFloat(serviceListing.price || 0);
    }
    const qty = typeof pricingContext.quantity === 'number' ? pricingContext.quantity : parseFloat(pricingContext.quantity);
    if (isNaN(qty) || qty < 0) {
      console.warn(`Invalid quantity for per_unit pricing: ${pricingContext.quantity}`);
      return parseFloat(serviceListing.price || 0);
    }
    pricingContext.quantity = Math.max(1, Math.floor(qty)); // Ensure at least 1 for per_unit
  }

  // For per_table pricing, get table count from venue design
  if (pricingPolicy === 'per_table' && venueDesignId) {
    try {
      const tableCountResponse = await getTableCount(venueDesignId, serviceListing.id);
      pricingContext.tableCount = tableCountResponse.count || 0;
    } catch (error) {
      console.error('Error fetching table count:', error);
      pricingContext.tableCount = 0;
    }
  }

  // For time_based pricing, calculate duration from event times
  if (pricingPolicy === 'time_based' && eventStartTime && eventEndTime) {
    const start = new Date(eventStartTime);
    const end = new Date(eventEndTime);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
      const diffMs = end.getTime() - start.getTime();
      pricingContext.eventDuration = diffMs / (1000 * 60 * 60); // Convert to hours
    }
  }
  

  // Call the pricing calculation API
  try {
    const response = await apiFetch(`/service-listings/${serviceListing.id}/calculate-price`, {
      method: 'POST',
      body: JSON.stringify({ context: pricingContext }),
    });

    return parseFloat(response.totalPrice || 0);
  } catch (error) {
    console.error('Error calculating price:', error);
    console.error('Context sent:', pricingContext);
    console.error('Service listing:', { id: serviceListing.id, pricingPolicy, price: serviceListing.price });
    // Fallback to base price if calculation fails
    return parseFloat(serviceListing.price || 0);
  }
}

/**
 * Calculate prices for multiple service listings
 * @param {Array} serviceListings - Array of service listing objects
 * @param {Object} contextMap - Map of serviceListingId -> context
 * @param {string} venueDesignId - Venue design ID
 * @param {Date} eventStartTime - Event start time
 * @param {Date} eventEndTime - Event end time
 * @returns {Promise<Map>} Map of serviceListingId -> calculated price
 */
export async function calculateServicePrices(serviceListings, contextMap = {}, venueDesignId = null, eventStartTime = null, eventEndTime = null) {
  const priceMap = new Map();

  // Calculate prices in parallel
  const pricePromises = serviceListings.map(async (serviceListing) => {
    const context = contextMap[serviceListing.id] || {};
    const price = await calculateServicePrice(serviceListing, context, venueDesignId, eventStartTime, eventEndTime);
    return { id: serviceListing.id, price };
  });

  const results = await Promise.all(pricePromises);
  results.forEach(({ id, price }) => {
    priceMap.set(id, price);
  });

  return priceMap;
}

