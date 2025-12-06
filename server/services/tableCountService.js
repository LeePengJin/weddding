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

  // Get all placed elements in the venue design
  // We need to check multiple conditions to identify tables (matching frontend logic)
  const placedElements = await prisma.placedElement.findMany({
    where: {
      venueDesignId,
    },
    select: {
      id: true,
      elementType: true,
      serviceListingIds: true,
      designElement: {
        select: {
          elementType: true,
          name: true,
        },
      },
    },
  });

  // Filter to only tables - check both PlacedElement.elementType and DesignElement.elementType
  // Also check if name contains "table" as a fallback (matching frontend logic)
  const tables = placedElements.filter(pe => {
    const isTableByElementType = pe.elementType === 'table' || pe.designElement?.elementType === 'table';
    const isTableByName = pe.designElement?.name?.toLowerCase().includes('table');
    return isTableByElementType || isTableByName;
  });

  // If serviceListingId is provided, filter by tags
  if (serviceListingId) {
    const taggedTables = tables.filter(table => {
      const serviceListingIds = table.serviceListingIds || [];
      return serviceListingIds.includes(serviceListingId);
    });
    return taggedTables.length;
  }

  return tables.length;
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
  // First, get all placed elements to check what we have
  const allPlacedElements = await prisma.placedElement.findMany({
    where: {
      id: { in: placedElementIds },
      venueDesignId,
    },
    include: {
      designElement: {
        select: {
          elementType: true,
          name: true,
        },
      },
    },
  });

  if (allPlacedElements.length !== placedElementIds.length) {
    const foundIds = allPlacedElements.map(pe => pe.id);
    const missingIds = placedElementIds.filter(id => !foundIds.includes(id));
    throw new Error(`Some placed elements not found: ${missingIds.join(', ')}`);
  }

  // Filter to only tables - check both PlacedElement.elementType and DesignElement.elementType
  // Also check if name contains "table" as a fallback (matching frontend logic)
  const placedElements = allPlacedElements.filter(pe => {
    const isTableByElementType = pe.elementType === 'table' || pe.designElement?.elementType === 'table';
    const isTableByName = pe.designElement?.name?.toLowerCase().includes('table');
    return isTableByElementType || isTableByName;
  });

  if (placedElements.length !== placedElementIds.length) {
    const nonTableIds = allPlacedElements
      .filter(pe => {
        const isTableByElementType = pe.elementType === 'table' || pe.designElement?.elementType === 'table';
        const isTableByName = pe.designElement?.name?.toLowerCase().includes('table');
        return !(isTableByElementType || isTableByName);
      })
      .map(pe => pe.id);
    console.error('Non-table elements:', nonTableIds.map(id => {
      const pe = allPlacedElements.find(p => p.id === id);
      return {
        id,
        elementType: pe?.elementType,
        designElementType: pe?.designElement?.elementType,
        designElementName: pe?.designElement?.name,
      };
    }));
    throw new Error(`Some placed elements are not tables: ${nonTableIds.join(', ')}`);
  }

  // Verify all service listings exist and get their pricing policies
  const serviceListings = await prisma.serviceListing.findMany({
    where: {
      id: { in: serviceListingIds },
    },
    select: { 
      id: true,
      pricingPolicy: true,
    },
  });

  if (serviceListings.length !== serviceListingIds.length) {
    throw new Error('Some service listings not found');
  }

  // Get venue design to find project ID
  const venueDesign = await prisma.venueDesign.findUnique({
    where: { id: venueDesignId },
    select: {
      projectId: true,
    },
  });

  if (!venueDesign) {
    throw new Error('Venue design not found');
  }

  // For per_table services, ensure they exist in ProjectService
  // This is required for them to appear in checkout
  const perTableServiceIds = serviceListings
    .filter(sl => sl.pricingPolicy === 'per_table')
    .map(sl => sl.id);

  if (perTableServiceIds.length > 0) {
    const projectServicePromises = perTableServiceIds.map(async (serviceListingId) => {
      try {
        await prisma.projectService.upsert({
          where: {
            projectId_serviceListingId: {
              projectId: venueDesign.projectId,
              serviceListingId: serviceListingId,
            },
          },
          update: {
            // Don't update quantity - it's managed by table tags
          },
          create: {
            projectId: venueDesign.projectId,
            serviceListingId: serviceListingId,
            quantity: 0, // Quantity is managed by table tags, not ProjectService.quantity
          },
        });
      } catch (error) {
        console.error(`Error ensuring ProjectService for ${serviceListingId}:`, error);
        // Don't throw - this is a best-effort operation
      }
    });

    await Promise.all(projectServicePromises);
  }

  // Update each placed element to add service listing IDs to tags
  // Note: This replaces existing tags with new ones
  const updatePromises = placedElementIds.map(async (elementId) => {
    try {
      return await prisma.placedElement.update({
        where: { id: elementId },
        data: {
          serviceListingIds: {
            set: serviceListingIds, // Replace existing tags with new ones
          },
        },
      });
    } catch (error) {
      console.error(`Error updating placed element ${elementId}:`, error);
      throw new Error(`Failed to update placed element ${elementId}: ${error.message}`);
    }
  });

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

