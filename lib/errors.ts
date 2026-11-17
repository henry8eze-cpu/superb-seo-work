// Errors thrown by the service layer. Server actions translate `code` into a
// user-facing message via the `errors.*` translation keys.

export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'NO_SEATS'
  | 'INTAKE_NOT_BOOKABLE'
  | 'NOT_PARTNER'
  | 'HOLD_EXPIRED'
  | 'PAYMENT_FAILED'
  | 'INVITATION_INVALID'

export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    message?: string,
    public details?: Record<string, unknown>
  ) {
    super(message ?? code)
    this.name = 'AppError'
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

export type ActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? {} : { data: T }))
  | { success: false; error: string; code?: AppErrorCode }
