// Languages beyond German and English: flat key → text, falling back to English.
import { ar } from './ar'
import { tr } from './tr'
import { uk } from './uk'

export const OVERLAYS: Partial<Record<string, Record<string, string>>> = { tr, uk, ar }
