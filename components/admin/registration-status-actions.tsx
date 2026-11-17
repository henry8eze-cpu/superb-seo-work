'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { updateRegistrationStatus } from '@/app/actions/registrations'

type RegistrationStatus = 'NEW' | 'CONTACTED' | 'ACCEPTED' | 'ON_HOLD' | 'ENROLLED' | 'REJECTED'

export function RegistrationStatusActions({
  registrationId,
  status,
}: {
  registrationId: string
  status: RegistrationStatus
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<RegistrationStatus>(status)
  const [isPending, startTransition] = useTransition()

  const handleUpdate = () => {
    if (selected === status) return

    startTransition(async () => {
      const result = await updateRegistrationStatus(registrationId, selected)
      if (result.success) {
        toast.success('Application status updated')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to update status')
        setSelected(status)
      }
    })
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={selected}
        disabled={isPending}
        onChange={(e) => setSelected(e.target.value as RegistrationStatus)}
        className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white disabled:opacity-50"
      >
        <option value="NEW">Pending</option>
        <option value="CONTACTED">Contacted</option>
        <option value="ACCEPTED">Approved</option>
        <option value="ON_HOLD">On Hold</option>
        <option value="ENROLLED">Enrolled</option>
        <option value="REJECTED">Rejected</option>
      </select>
      <button
        type="button"
        onClick={handleUpdate}
        disabled={isPending || selected === status}
        className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Update Status
      </button>
    </div>
  )
}
