export const CATEGORY_COLORS = {
  SNG: '#1e3a8a', // Blue
  MUS: '#dc2626', // Red    
  PER: '#16a34a', // Green
} as const;

export const getCategoryColor = (category: 'SNG' | 'MUS' | 'PER') => {
  return CATEGORY_COLORS[category];
}