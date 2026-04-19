export function pad(n) { return String(n).padStart(2, '0') }

// Backend stores naive UTC datetimes (no Z) — force UTC parsing
export function parseDate(s) {
  if (!s) return new Date()
  if (s.endsWith('Z') || s.includes('+')) return new Date(s)
  return new Date(s + 'Z')
}
