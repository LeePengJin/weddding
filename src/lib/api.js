export async function apiFetch(path, options = {}) {
  // Don't set Content-Type for FormData - browser will set it with boundary
  const isFormData = options.body instanceof FormData;
  const headers = isFormData 
    ? { ...(options.headers || {}) }
    : { 'Content-Type': 'application/json', ...(options.headers || {}) };
  
  const response = await fetch(`http://localhost:4000${path}` , {
    credentials: 'include',
    headers,
    ...options,
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    let message = 'Request failed';
    if (typeof body === 'string') {
      message = body;
    } else if (body) {
      if (Array.isArray(body.issues) && body.issues.length > 0) {
        message = body.issues[0].message || body.error || message;
      } else if (body.error) {
        message = body.error;
      }
    }
    throw new Error(message);
  }
  return body;
}

// Venue design APIs
export function getVenueDesign(projectId) {
  return apiFetch(`/venue-designs/${projectId}`);
}

export function addDesignElement(projectId, payload) {
  return apiFetch(`/venue-designs/${projectId}/elements`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateDesignElement(projectId, elementId, payload) {
  return apiFetch(`/venue-designs/${projectId}/elements/${elementId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteDesignElement(projectId, elementId, scope = 'single') {
  const params = new URLSearchParams({ scope });
  return apiFetch(`/venue-designs/${projectId}/elements/${elementId}?${params.toString()}`, {
    method: 'DELETE',
  });
}

export function updateVenueCamera(projectId, payload) {
  return apiFetch(`/venue-designs/${projectId}/camera`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function saveVenueDesign(projectId, payload) {
  return apiFetch(`/venue-designs/${projectId}/save`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getVenueCatalog(projectId, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });
  const qs = params.toString();
  const path = qs ? `/venue-designs/${projectId}/catalog?${qs}` : `/venue-designs/${projectId}/catalog`;
  return apiFetch(path);
}

export function getVenueAvailability(projectId, serviceListingIds = []) {
  const params = new URLSearchParams();
  if (serviceListingIds.length > 0) {
    params.append('serviceListingIds', serviceListingIds.join(','));
  }
  return apiFetch(`/venue-designs/${projectId}/availability?${params.toString()}`);
}

// Package design APIs
export function getPackageDesign(packageId) {
  return apiFetch(`/admin/package-design/${packageId}`);
}

export function addPackageDesignElement(packageId, payload) {
  return apiFetch(`/admin/package-design/${packageId}/elements`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updatePackageDesignElement(packageId, elementId, payload) {
  return apiFetch(`/admin/package-design/${packageId}/elements/${elementId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deletePackageDesignElement(packageId, elementId, scope = 'single') {
  const params = new URLSearchParams({ scope });
  return apiFetch(`/admin/package-design/${packageId}/elements/${elementId}?${params.toString()}`, {
    method: 'DELETE',
  });
}

export function savePackageDesign(packageId, payload) {
  return apiFetch(`/admin/package-design/${packageId}/save`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getPackageCatalog(packageId, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });
  const qs = params.toString();
  const path = qs ? `/admin/package-design/${packageId}/catalog?${qs}` : `/admin/package-design/${packageId}/catalog`;
  return apiFetch(path);
}

export function getPackageVenues(packageId) {
  return apiFetch(`/admin/package-design/${packageId}/venues`);
}

export function setPackageVenue(packageId, venueServiceListingId) {
  return apiFetch(`/admin/package-design/${packageId}/venue`, {
    method: 'PATCH',
    body: JSON.stringify({ venueServiceListingId }),
  });
}

export function uploadPackagePreview(packageId, imageData) {
  return apiFetch(`/admin/package-design/${packageId}/preview`, {
    method: 'POST',
    body: JSON.stringify({ imageData }),
  });
}

// Booking APIs
export function createBooking(payload) {
  return apiFetch('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}


