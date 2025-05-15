
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;
  const properties = path.split('.');
  return properties.reduce((prev, curr) => (prev && prev[curr] !== undefined ? prev[curr] : undefined), obj);
}

    