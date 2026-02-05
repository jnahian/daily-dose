/**
 * Formats a date string into a user-friendly format
 * @param dateString - Date string in YYYY-MM-DD format or special values like 'TBD', 'Unreleased'
 * @returns Formatted date string (e.g., "February 5, 2026") or "Coming Soon" for special cases
 */
export const formatDate = (dateString: string): string => {
  // Handle special cases
  if (dateString === 'TBD' || dateString === 'Unreleased') {
    return 'Coming Soon';
  }

  try {
    // Parse YYYY-MM-DD format
    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString; // Return original if invalid
    }

    // Format as "Month Day, Year" (e.g., "February 5, 2026")
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (error) {
    return dateString; // Return original on error
  }
};

/**
 * Formats the current date into a user-friendly format
 * @returns Formatted current date string (e.g., "February 5, 2026")
 */
export const formatCurrentDate = (): string => {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
