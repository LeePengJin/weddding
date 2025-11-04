export async function apiFetch(path, options = {}) {
  const response = await fetch(`http://localhost:4000${path}` , {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === 'string' ? body : (body && body.error) || 'Request failed';
    throw new Error(message);
  }
  return body;
}


