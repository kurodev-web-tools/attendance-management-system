import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

export function calculateWorkHours(checkIn: Date, checkOut: Date, breakMinutes: number = 0): number {
  const diffMs = checkOut.getTime() - checkIn.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  return Math.max(0, diffHours - (breakMinutes / 60))
}
