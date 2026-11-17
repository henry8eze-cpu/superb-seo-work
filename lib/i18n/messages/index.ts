import type { MessageTree } from '../core'
import { common, enums, errors, weekdays } from './common'
import { emails } from './emails'
import { admin } from './admin'
import { school } from './school'
import { market } from './market'
import { feedback } from './feedback'
import { home } from './home'

export const messages = {
  common,
  weekdays,
  enums,
  errors,
  emails,
  admin,
  school,
  market,
  feedback,
  home,
} satisfies MessageTree
