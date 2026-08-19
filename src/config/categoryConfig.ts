export const CATEGORY_COLORS = {
  SNG: '#1e3a8a', // Blue
  MUS: '#dc2626', // Red    
  PER: '#16a34a', // Green
} as const;

/** Light hex + muted dark: pair for on-screen judge headers. */
export const CATEGORY_HEADER_CLASSES = {
  SNG: 'bg-[#1e3a8a] dark:bg-blue-800',
  MUS: 'bg-[#dc2626] dark:bg-red-800',
  PER: 'bg-[#16a34a] dark:bg-green-800',
} as const;

export const DEFAULT_JUDGE_HEADER_CLASS = 'bg-gray-700 dark:bg-gray-600';

export const getCategoryColor = (category: 'SNG' | 'MUS' | 'PER') => {
  return CATEGORY_COLORS[category];
};

export const getCategoryHeaderClass = (category?: 'SNG' | 'MUS' | 'PER') => {
  if (category) return CATEGORY_HEADER_CLASSES[category];
  return DEFAULT_JUDGE_HEADER_CLASS;
};
