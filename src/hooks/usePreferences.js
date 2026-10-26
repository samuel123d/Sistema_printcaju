import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { DEFAULT_PREFERENCES, watchPreferences, watchProfile } from '../services/settings/settings.js'

export function applyBrandPreferences(preferences = DEFAULT_PREFERENCES) {
  const root = document.documentElement
  const color = /^#[0-9a-f]{6}$/i.test(preferences.accentColor) ? preferences.accentColor : DEFAULT_PREFERENCES.accentColor
  const channel = (value) => {
    const normalized = Number.parseInt(value, 16) / 255
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }
  const red = channel(color.slice(1, 3))
  const green = channel(color.slice(3, 5))
  const blue = channel(color.slice(5, 7))
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  const accentHover = `color-mix(in srgb, ${color} 82%, #17212f)`
  const accentSoft = `color-mix(in srgb, ${color} 9%, white)`
  const accentBorder = `color-mix(in srgb, ${color} 34%, white)`
  const accentShadow = `color-mix(in srgb, ${color} 17%, transparent)`
  const pageBackground = `color-mix(in srgb, ${color} 7%, #f6f7f8)`
  const surfaceBackground = `color-mix(in srgb, ${color} 1.5%, white)`
  const mutedSurface = `color-mix(in srgb, ${color} 4.5%, #f7f8fa)`
  const borderColor = `color-mix(in srgb, ${color} 10%, #dfe3e8)`
  root.style.setProperty('--accent', color)
  root.style.setProperty('--accent-rgb', `${Number.parseInt(color.slice(1, 3), 16)} ${Number.parseInt(color.slice(3, 5), 16)} ${Number.parseInt(color.slice(5, 7), 16)}`)
  root.style.setProperty('--accent-hover', accentHover)
  root.style.setProperty('--accent-soft', accentSoft)
  root.style.setProperty('--accent-border', accentBorder)
  root.style.setProperty('--accent-shadow', accentShadow)
  root.style.setProperty('--page-background', pageBackground)
  root.style.setProperty('--page-glow', `color-mix(in srgb, ${color} 13%, transparent)`)
  root.style.setProperty('--surface-background', surfaceBackground)
  root.style.setProperty('--surface-muted', mutedSurface)
  root.style.setProperty('--line', borderColor)
  root.style.setProperty('--brand-offwhite', pageBackground)
  root.style.setProperty('--purple', color)
  root.style.setProperty('--purple-dark', accentHover)
  root.style.setProperty('--purple-soft', accentSoft)
  root.style.setProperty('--brand-orange', color)
  root.style.setProperty('--accent-ink', luminance > 0.18 ? '#1E293B' : '#ffffff')
  root.style.setProperty('--accent-text', luminance > 0.18 ? '#1E293B' : color)
  root.dataset.fontScale = ['small', 'normal', 'large', 'largest'].includes(preferences.fontScale) ? preferences.fontScale : 'normal'
}

export default function usePreferences() {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [storedProfile, setStoredProfile] = useState({})
  const [photoURL, setPhotoURL] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.uid) { setPreferences(DEFAULT_PREFERENCES); setStoredProfile({}); applyBrandPreferences(DEFAULT_PREFERENCES); setLoading(false); return undefined }
    setStoredProfile({})
    setPhotoURL('')
    let preferencesLoaded = false
    let profileLoaded = false
    setLoading(true)
    setError('')
    const done = () => { if (preferencesLoaded && profileLoaded) setLoading(false) }
    const stopPreferences = watchPreferences(user.uid, (value) => { setPreferences(value); applyBrandPreferences(value); preferencesLoaded = true; done() }, (cause) => { console.error(cause); setError('Não foi possível carregar as preferências.'); preferencesLoaded = true; done() })
    const stopProfile = watchProfile(user.uid, (value) => { setStoredProfile(value); profileLoaded = true; done() }, (cause) => { console.error(cause); setError('Não foi possível carregar o perfil.'); profileLoaded = true; done() })
    return () => { stopPreferences(); stopProfile() }
  }, [user?.uid])

  useEffect(() => {
    const storedBytes = storedProfile.photoBytes
    if (!storedBytes) { setPhotoURL(''); return undefined }

    const bytes = typeof storedBytes.toUint8Array === 'function' ? storedBytes.toUint8Array() : storedBytes
    const objectURL = URL.createObjectURL(new Blob([bytes], { type: storedProfile.photoContentType || 'image/webp' }))
    setPhotoURL(objectURL)
    return () => URL.revokeObjectURL(objectURL)
  }, [storedProfile.photoBytes, storedProfile.photoContentType])

  const profile = useMemo(() => ({ ...storedProfile, photoURL }), [storedProfile, photoURL])
  const setProfile = (updates) => setStoredProfile((current) => ({ ...current, ...updates }))

  return { preferences, profile, loading, error, setPreferences, setProfile }
}
