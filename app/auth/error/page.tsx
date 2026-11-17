'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || 'An error occurred'

  return (
    <div className="w-full max-w-md text-center">
      <div className="bg-white rounded-lg shadow-soft p-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">!</span>
        </div>

        <h1 className="font-poppins text-3xl font-bold text-dark-gray mb-4">
          Authentication Error
        </h1>
        <p className="text-muted-foreground mb-8">
          {error === 'Callback' ? 'There was an issue with the authentication process.' : error}
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/login"
            className="inline-block bg-primary text-white font-medium py-2 px-6 rounded-lg hover:bg-[#E05530]"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="inline-block bg-secondary text-dark-gray font-medium py-2 px-6 rounded-lg hover:bg-[#F8A732]"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ErrorPage() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center py-12 px-4">
      <Suspense fallback={null}>
        <ErrorContent />
      </Suspense>
    </div>
  )
}
