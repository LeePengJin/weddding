export async function apiFetch(path, options = {}) {
  const response = await fetch(`http://localhost:4000${path}` , {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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


