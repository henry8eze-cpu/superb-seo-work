'use client'

import { useState, useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

export function ConfirmDeleteButton({
  title,
  description,
  confirmLabel = 'Delete',
  action,
  triggerLabel = 'Delete',
  triggerClassName = 'flex items-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition-all text-sm font-medium',
  onDone,
}: {
  title: string
  description: string
  confirmLabel?: string
  action: () => Promise<{ success: boolean; error?: string } | void>
  triggerLabel?: string
  triggerClassName?: string
  onDone?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        const result = await action()
        if (result && result.success === false) {
          toast.error(result.error || 'Something went wrong')
          return
        }
        toast.success('Deleted successfully')
        setOpen(false)
        onDone?.()
      } catch (error) {
        toast.error('Something went wrong')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClassName}>
        <Trash2 className="w-4 h-4" />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose className="px-4 py-2 rounded-lg text-sm font-medium border border-border text-dark-gray hover:bg-cream transition-colors">
            Cancel
          </DialogClose>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-white hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
