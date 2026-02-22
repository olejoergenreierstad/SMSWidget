import { useState, type FormEvent } from 'react'

interface ComposeBoxProps {
  onSend: (body: string) => void | Promise<void>
  disabled?: boolean
}

export function ComposeBox({ onSend, disabled }: ComposeBoxProps) {
  const [body, setBody] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || disabled) return
    setBody('')
    await onSend(trimmed)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t px-6 py-4"
      style={{ borderColor: 'var(--box-border)' }}
    >
      <label
        className="block text-sm font-medium mb-2"
        style={{ color: 'var(--text)' }}
      >
        Melding
      </label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Skriv din melding her..."
        disabled={disabled}
        rows={4}
        className="w-full h-24 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand)] resize-none mb-3"
        style={{
          borderWidth: '1px',
          borderColor: 'var(--box-border)',
          backgroundColor: 'var(--box-bg)',
          color: 'var(--text)',
        }}
      />
      <button
        type="submit"
        disabled={disabled || !body.trim()}
        className="w-full px-4 py-3 rounded-lg font-medium disabled:cursor-not-allowed transition-colors hover:opacity-90 disabled:opacity-60"
        style={{
          backgroundColor: 'var(--brand)',
          color: 'var(--brand-text)',
        }}
      >
        Send SMS
      </button>
    </form>
  )
}
