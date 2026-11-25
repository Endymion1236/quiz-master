import { THEMES } from './constants'

/**
 * Apply a theme by setting CSS custom properties on :root
 */
export function applyTheme(themeId = 'default') {
  const theme = THEMES[themeId] || THEMES.default
  const root = document.documentElement

  root.style.setProperty('--theme-bg', theme.bg)
  root.style.setProperty('--theme-card', theme.cardBg)
  root.style.setProperty('--theme-primary', theme.primary)
  root.style.setProperty('--theme-accent', theme.accent)

  // Also update body background
  document.body.style.background = theme.bg

  return theme
}

/**
 * Get current theme colors for use in components
 */
export function getThemeColors(themeId = 'default') {
  return THEMES[themeId] || THEMES.default
}
