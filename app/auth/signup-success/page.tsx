'use client'

import Link from 'next/link'

export default function SignupSuccessPage() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-white rounded-lg shadow-soft p-8">
          <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✓</span>
          </div>

          <h1 className="font-poppins text-3xl font-bold text-primary mb-4">
            Welcome to Superb!
          </h1>
          <p className="text-muted-foreground mb-8">
            Your account has been created successfully. You can now login to your student dashboard.
          </p>

          <Link
            href="/auth/login"
            className="inline-block bg-primary text-white font-medium py-3 px-8 rounded-lg hover:bg-[#E05530]"
          >
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
