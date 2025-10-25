// Helper function to wrap hours >= 24 to next day for display
// e.g., 24:10 -> 00:10, 25:15 -> 01:15, 26:30 -> 02:30
export const formatTimeForDisplay = (time: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  const wrappedHours = hours >= 24 ? hours - 24 : hours;
  return `${wrappedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Helper function to convert time string to sortable numeric value (minutes since midnight)
// e.g., "24:10" -> 1450, "25:15" -> 1515
export const timeToSortValue = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};
