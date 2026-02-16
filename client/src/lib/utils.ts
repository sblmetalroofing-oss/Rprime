import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatJobNumber(job: { referenceNumber?: string | null; id: string }): string {
  // If job has a reference number (e.g., "JOB-1234"), return it as-is
  // Otherwise, return "#" + last 8 chars of ID for legacy jobs
  return job.referenceNumber || `#${job.id.slice(-8).toUpperCase()}`;
}
