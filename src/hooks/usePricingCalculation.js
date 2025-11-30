import { useState, useEffect, useMemo } from 'react';
import { calculateServicePrice } from '../utils/pricingCalculator';
import { apiFetch } from '../lib/api';

/**
 * Hook to calculate prices for grouped items using the pricing engine
 * @param {Array} items - Array of items with serviceListingId
 * @param {string} venueDesignId - Venue design ID (for per_table pricing)
 * @param {Date} eventStartTime - Event start time (for time_based pricing)
 * @param {Date} eventEndTime - Event end time (for time_based pricing)
 * @returns {Object} { prices: Map, loading: boolean, error: string }
 */
export function usePricingCalculation(items, venueDesignId = null, eventStartTime = null, eventEndTime = null) {
  const [prices, setPrices] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get unique service listing IDs
  const serviceListingIds = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map((item) => item.serviceListingId)
          .filter(Boolean)
      )
    );
  }, [items]);

  useEffect(() => {
    if (serviceListingIds.length === 0) {
      setPrices(new Map());
      return;
    }

    let cancelled = false;

    const calculatePrices = async () => {
      setLoading(true);
      setError(null);

      try {
        // Try to get service listings from items first (if they already have the data)
        // Otherwise fetch from API
        const serviceListings = await Promise.all(
          serviceListingIds.map(async (id) => {
            // Check if we already have the service listing data in items
            const itemWithListing = items.find(item => item.serviceListingId === id && item.serviceListing);
            if (itemWithListing && itemWithListing.serviceListing) {
              return itemWithListing.serviceListing;
            }
            
            // Otherwise, try to fetch from API (may fail for couples, that's okay)
            try {
              const listing = await apiFetch(`/service-listings/${id}`);
              return listing;
            } catch (err) {
              // Silently fail - we'll use fallback pricing
              console.warn(`Could not fetch service listing ${id} for pricing calculation:`, err.message);
              return null;
            }
          })
        );

        if (cancelled) return;

        // Calculate prices for each service listing
        const priceMap = new Map();
        const pricePromises = serviceListings
          .filter(Boolean)
          .map(async (serviceListing) => {
            try {
              // Build context based on item quantity
              // For per_table services, tableCount will be fetched by calculateServicePrice
              // For other services, use quantity from items
              const itemsForService = items.filter((item) => item.serviceListingId === serviceListing.id);
              const context = {
                quantity: itemsForService.reduce((sum, item) => sum + (item.quantity || 1), 0),
              };

              const price = await calculateServicePrice(
                serviceListing,
                context,
                venueDesignId,
                eventStartTime,
                eventEndTime
              );

              return { id: serviceListing.id, price };
            } catch (err) {
              console.error(`Error calculating price for ${serviceListing.id}:`, err);
              // For per_table services with 0 tables, return 0 instead of base price
              // This prevents validation errors in checkout
              if (serviceListing.pricingPolicy === 'per_table') {
                return {
                  id: serviceListing.id,
                  price: 0,
                };
              }
              // Fallback to base price for other services
              return {
                id: serviceListing.id,
                price: parseFloat(serviceListing.price || 0),
              };
            }
          });

        const results = await Promise.all(pricePromises);
        if (cancelled) return;

        results.forEach(({ id, price }) => {
          priceMap.set(id, price);
        });

        setPrices(priceMap);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to calculate prices');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    calculatePrices();

    return () => {
      cancelled = true;
    };
  }, [serviceListingIds.join(','), venueDesignId, eventStartTime?.getTime(), eventEndTime?.getTime(), items.length]);

  return { prices, loading, error };
}

