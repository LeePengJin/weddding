export function formatImageUrl(url) {
  if (!url) return '/images/default-product.jpg';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/uploads')) {
    return `http://localhost:4000${url}`;
  }
  return url;
}

