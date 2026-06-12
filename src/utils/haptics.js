const STORAGE_KEY = 'demi-cercle:haptics'

export function isHapticsEnabled() {
  return localStorage.getItem(STORAGE_KEY) !== 'off'
}

export function setHapticsEnabled(enabled) {
  localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
}

// Fait vibrer l'appareil seulement si l'option est activée (et si le
// navigateur le permet — iOS Safari ignore navigator.vibrate).
export function vibrate(pattern) {
  if (isHapticsEnabled()) navigator.vibrate?.(pattern)
}
