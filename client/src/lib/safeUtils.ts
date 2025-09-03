// Safe array utility to prevent crashes from undefined/null arrays
export const safe = <T,>(value: T[] | null | undefined): T[] => 
  Array.isArray(value) ? value : [];

// Safe object accessor with defaults
export const safeGet = <T>(obj: any, path: string, defaultValue: T): T => {
  try {
    return path.split('.').reduce((current, key) => current?.[key], obj) ?? defaultValue;
  } catch {
    return defaultValue;
  }
};

// Safe number with default
export const safeNumber = (value: any, defaultValue: number = 0): number => {
  const num = typeof value === 'number' ? value : parseInt(value);
  return !isNaN(num) ? num : defaultValue;
};

// Safe boolean with default  
export const safeBool = (value: any, defaultValue: boolean = false): boolean => {
  return typeof value === 'boolean' ? value : defaultValue;
};