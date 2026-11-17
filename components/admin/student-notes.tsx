'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, StickyNote } from 'lucide-react'
import { addStudentNote } from '@/app/actions/students'

type Note = {
  id: string
  content: string
  createdAt: Date
  user: { name: string }
}

export function StudentNotes({ studentId, notes }: { studentId: string; notes: Note[] }) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setIsSubmitting(true)
    const result = await addStudentNote(studentId, { content })
    setIsSubmitting(false)

    if (result.success) {
      toast.success('Note added')
      setContent('')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to add note')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-soft p-6 space-y-4">
      <h3 className="font-poppins text-lg font-bold text-dark-gray flex items-center gap-2">
        <StickyNote className="w-5 h-5 text-secondary" />
        Internal Notes
      </h3>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a note about this student (only visible to admins)..."
          rows={3}
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={!content.trim() || isSubmitting}
          className="self-end flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-all text-sm font-medium disabled:opacity-50"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Add Note
        </button>
      </form>

      <div className="space-y-3">
        {notes.length > 0 ? (
          notes.map((note) => (
            <div key={note.id} className="border border-border rounded-lg p-4 bg-cream">
              <p className="text-dark-gray text-sm whitespace-pre-wrap">{note.content}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {note.user.name} ·{' '}
                {note.createdAt.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
        )}
      </div>
    </div>
  )
}
