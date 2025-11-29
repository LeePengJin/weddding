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
        // Fetch service listings to get pricing policy
        const serviceListings = await Promise.all(
          serviceListingIds.map(async (id) => {
            try {
              const listing = await apiFetch(`/service-listings/${id}`);
              return listing;
            } catch (err) {
              console.error(`Error fetching service listing ${id}:`, err);
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
              // Fallback to base price
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

