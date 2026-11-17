'use server'

import { signIn, signOut, auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { signupSchema, changePasswordSchema } from '@/lib/validations'
import { getActor, homePathFor } from '@/lib/session'
import { setFlash } from '@/lib/flash'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'

export async function registerUser(formData: unknown) {
  try {
    const validatedData = await signupSchema.parseAsync(formData)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return {
        success: false,
        error: 'Email already registered',
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        name: validatedData.name,
        password: hashedPassword,
        role: 'STUDENT',
        student: {
          create: {},
        },
      },
    })

    return {
      success: true,
      userId: user.id,
    }
  } catch (error) {
    console.error('[v0] Registration error:', error)
    return {
      success: false,
      error: 'Registration failed. Please try again.',
    }
  }
}

export async function loginUser(email: string, password: string) {
  try {
    const redirectUrl = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    const error = new URL(redirectUrl, 'http://localhost').searchParams.get('error')
    if (error) {
      return {
        success: false,
        error: 'Invalid email or password',
      }
    }

    const user = await prisma.user.findUnique({ where: { email } })

    return {
      success: true,
      role: user?.role ?? 'STUDENT',
      name: user?.name ?? '',
      redirectTo: user ? await homePathFor(user.id) : '/',
    }
  } catch (error) {
    console.error('[v0] Login error:', error)
    return {
      success: false,
      error: 'Login failed. Please try again.',
    }
  }
}

export async function logoutUser() {
  await signOut({ redirect: false })
  await setFlash('success', 'loggedOut')
}

export async function adminLogout() {
  await setFlash('success', 'loggedOut')
  await signOut({ redirectTo: '/' })
}

export async function getCurrentUser() {
  const session = await auth()
  return session?.user ?? null
}

export async function isAdmin() {
  const actor = await getActor()
  return actor?.role === 'PLATFORM_ADMIN'
}

// Checked against the database, not the session token, so revoked admins lose access immediately.
export async function requireAdmin() {
  const actor = await getActor()
  if (actor?.role !== 'PLATFORM_ADMIN') {
    redirect('/auth/login')
  }
  return { id: actor.userId, name: actor.name, email: actor.email, role: actor.role }
}

export async function requireAuth() {
  const session = await auth()
  if (!session) {
    redirect('/auth/login')
  }
  return session.user
}

export async function changeAdminPassword(formData: unknown) {
  const admin = await requireAdmin()

  try {
    const data = await changePasswordSchema.parseAsync(formData)

    const user = await prisma.user.findUnique({ where: { id: admin.id } })
    if (!user || !user.password) {
      return { success: false, error: 'Account not found' }
    }

    const isValid = await bcrypt.compare(data.currentPassword, user.password)
    if (!isValid) {
      return { success: false, error: 'Current password is incorrect' }
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 10)
    await prisma.user.update({
      where: { id: admin.id },
      data: { password: hashedPassword },
    })

    return { success: true }
  } catch (error) {
    console.error('[v0] Change password error:', error)
    return { success: false, error: 'Failed to change password. Please try again.' }
  }
}
