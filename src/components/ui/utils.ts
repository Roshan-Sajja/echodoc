/**
 * Tiny helper that merges conditional class names without duplicating Tailwind
 * tokens. Used by most of the UI primitives.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
