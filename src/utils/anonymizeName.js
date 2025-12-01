/**
 * Anonymizes a reviewer's name by showing only the first character followed by asterisks
 * Examples:
 * - "John & Jane Doe" -> "J***"
 * - "Mike Smith" -> "M***"
 * - "Sarah" -> "S***"
 */
export const anonymizeName = (name) => {
  if (!name || typeof name !== 'string') {
    return 'Anonymous';
  }

  // Get the first character (handles names with "&" like "John & Jane Doe")
  const firstChar = name.trim().charAt(0).toUpperCase();
  
  if (!firstChar) {
    return 'Anonymous';
  }

  // Return first character followed by 3 asterisks
  return `${firstChar}***`;
};

