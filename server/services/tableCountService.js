/**
 * Table Count Service
 * 
 * Provides functionality to count tables from 3D venue designs,
 * optionally filtered by service listing tags.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get table count from 3D design, optionally filtered by service listing
 * @param {String} venueDesignId - VenueDesign ID
 * @param {String} serviceListingId - Optional: filter by service tag
 * @returns {Promise<Number>} Table count
 */
async function getTableCount(venueDesignId, serviceListingId = null) {
  if (!venueDesignId) {
    throw new Error('Venue design ID is required');
  }

  // Verify venue design exists
  const venueDesign = await prisma.venueDesign.findUnique({
    where: { id: venueDesignId },
  });

  if (!venueDesign) {
    throw new Error('Venue design not found');
  }

  // Build where clause
  const where = {
    venueDesignId,
    designElement: {
      elementType: 'table', // Only count elements marked as tables
    },
  };

  // If serviceListingId is provided, filter by tags
  if (serviceListingId) {
    where.serviceListingIds = {
      has: serviceListingId, // PostgreSQL array contains operator
    };
  }

  // Count tables matching the criteria
  // Note: count() doesn't support include/select, only where clause
  const count = await prisma.placedElement.count({
    where,
  });

  return count;
}

/**
 * Get all tables in a venue design with their tags
 * @param {String} venueDesignId - VenueDesign ID
 * @returns {Promise<Array>} Array of placed elements that are tables
 */
async function getTables(venueDesignId) {
  if (!venueDesignId) {
    throw new Error('Venue design ID is required');
  }

  const tables = await prisma.placedElement.findMany({
    where: {
      venueDesignId,
      designElement: {
        elementType: 'table',
      },
    },
    include: {
      designElement: {
        select: {
          id: true,
          name: true,
          elementType: true,
        },
      },
    },
  });

  return tables;
}

/**
 * Tag tables with service listing IDs
 * @param {String} venueDesignId - VenueDesign ID
 * @param {Array<String>} placedElementIds - Array of placed element IDs to tag
 * @param {Array<String>} serviceListingIds - Array of service listing IDs to tag with
 * @returns {Promise<Number>} Number of tables updated
 */
async function tagTables(venueDesignId, placedElementIds, serviceListingIds) {
  if (!venueDesignId) {
    throw new Error('Venue design ID is required');
  }
  if (!placedElementIds || !Array.isArray(placedElementIds) || placedElementIds.length === 0) {
    throw new Error('Placed element IDs array is required');
  }
  if (!serviceListingIds || !Array.isArray(serviceListingIds) || serviceListingIds.length === 0) {
    throw new Error('Service listing IDs array is required');
  }

  // Verify all placed elements exist and belong to the venue design
  const placedElements = await prisma.placedElement.findMany({
    where: {
      id: { in: placedElementIds },
      venueDesignId,
      designElement: {
        elementType: 'table', // Only allow tagging tables
      },
    },
  });

  if (placedElements.length !== placedElementIds.length) {
    throw new Error('Some placed elements not found or are not tables');
  }

  // Verify all service listings exist
  const serviceListings = await prisma.serviceListing.findMany({
    where: {
      id: { in: serviceListingIds },
    },
    select: { id: true },
  });

  if (serviceListings.length !== serviceListingIds.length) {
    throw new Error('Some service listings not found');
  }

  // Update each placed element to add service listing IDs to tags
  // Note: This adds to existing tags, doesn't replace them
  const updatePromises = placedElementIds.map((elementId) =>
    prisma.placedElement.update({
      where: { id: elementId },
      data: {
        serviceListingIds: {
          set: serviceListingIds, // Replace existing tags with new ones
        },
      },
    })
  );

  await Promise.all(updatePromises);

  return placedElements.length;
}

/**
 * Remove service listing tags from tables
 * @param {String} venueDesignId - VenueDesign ID
 * @param {Array<String>} placedElementIds - Array of placed element IDs to untag
 * @param {Array<String>} serviceListingIds - Array of service listing IDs to remove
 * @returns {Promise<Number>} Number of tables updated
 */
async function untagTables(venueDesignId, placedElementIds, serviceListingIds) {
  if (!venueDesignId) {
    throw new Error('Venue design ID is required');
  }
  if (!placedElementIds || !Array.isArray(placedElementIds) || placedElementIds.length === 0) {
    throw new Error('Placed element IDs array is required');
  }
  if (!serviceListingIds || !Array.isArray(serviceListingIds) || serviceListingIds.length === 0) {
    throw new Error('Service listing IDs array is required');
  }

  // Get current placed elements with their tags
  const placedElements = await prisma.placedElement.findMany({
    where: {
      id: { in: placedElementIds },
      venueDesignId,
    },
    select: {
      id: true,
      serviceListingIds: true,
    },
  });

  if (placedElements.length !== placedElementIds.length) {
    throw new Error('Some placed elements not found');
  }

  // Remove service listing IDs from tags
  const updatePromises = placedElements.map((element) => {
    const currentTags = element.serviceListingIds || [];
    const newTags = currentTags.filter((tagId) => !serviceListingIds.includes(tagId));

    return prisma.placedElement.update({
      where: { id: element.id },
      data: {
        serviceListingIds: {
          set: newTags,
        },
      },
    });
  });

  await Promise.all(updatePromises);

  return placedElements.length;
}

module.exports = {
  getTableCount,
  getTables,
  tagTables,
  untagTables,
};

