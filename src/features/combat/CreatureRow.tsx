import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Copy, Eye, EyeOff, Heart, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { HpBar, StatusPill, Token } from '@/components/ui/tokens'
import { CONDITIONS, hasCondition, withCondition, withoutCondition } from '@/lib/conditions'
import { cn } from '@/lib/cn'
import type { ImageKind } from '@/lib/images'
import type { Creature, CreaturePatch } from '@/lib/types'

interface CreatureRowProps {
  creature: Creature
  isActive?: boolean
  isNext?: boolean
  selected?: boolean
  /** Who plays this character, for PCs a player has claimed. */
  playedBy?: string
  onSelect?: () => void
  onSave: (patch: CreaturePatch) => void
  onDelete: () => void
  /** Adds a copy with the next number: Goblin 1 → Goblin 2. */
  onDuplicate: () => void
  onHp: () => void
  /** Opens the full conditions dialog, for timed conditions and custom effects. */
  onConditions: () => void
  onEdit: () => void
  upload?: (file: File, kind: ImageKind) => Promise<string>
}

/**
 * One creature on the DM's list. Everything a DM touches mid-fight edits in
 * place: name, initiative, AC, conditions, the PC flag, the token image. HP opens
 * the damage/heal dialog; the pencil opens the full form.
 */
export default function CreatureRow({
  creature: c,
  isActive,
  isNext,
  selected,
  playedBy,
  onSelect,
  onSave,
  onDelete,
  onDuplicate,
  onHp,
  onConditions,
  onEdit,
  upload,
}: CreatureRowProps) {
  // Drafts exist only while a field is being edited; otherwise each field shows the
  // live value, so changes from other devices appear straight away.
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [initDraft, setInitDraft] = useState<string | null>(null)
  const [acDraft, setAcDraft] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!statusOpen) return
    const close = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setStatusOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [statusOpen])

  function commitName() {
    const trimmed = nameDraft?.trim()
    if (trimmed && trimmed !== c.name) onSave({ name: trimmed })
    setNameDraft(null)
  }

  function commitInit() {
    const n = parseInt(initDraft ?? '', 10)
    if (!isNaN(n) && n !== c.initiative) onSave({ initiative: Math.max(-100, Math.min(100, n)) })
    setInitDraft(null)
  }

  function commitAc() {
    const n = parseInt(acDraft ?? '', 10)
    if (!isNaN(n) && n !== c.armor_class) onSave({ armor_class: Math.max(0, Math.min(50, n)) })
    else if (acDraft === '' && c.armor_class !== null) onSave({ armor_class: null })
    setAcDraft(null)
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !upload) return
    setUploading(true)
    try {
      onSave({ image_url: await upload(file, 'portrait') })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const dead = hasCondition(c.conditions, 'dead')
  const visible = c.conditions.filter((x) => x.key !== 'dead')
  const available = CONDITIONS.filter((d) => !hasCondition(c.conditions, d.key))

  const avatar = (
    <button
      type="button"
      className={cn('shrink-0 rounded-full', uploading && 'opacity-50')}
      onClick={() => (upload ? fileRef.current?.click() : onEdit())}
      title={upload ? 'Change token image' : 'Edit creature'}
      aria-label={upload ? `Change token image for ${c.name}` : `Edit ${c.name}`}
    >
      <Token name={c.name} src={c.image_url} isPlayer={c.is_player} size={32} active={isActive} dead={dead} />
    </button>
  )

  const nameCell = nameDraft !== null ? (
    <input
      autoFocus
      aria-label="Name"
      className="min-w-0 flex-1 rounded border border-dnd-gold/50 bg-dnd-dark px-1.5 py-0.5 font-body text-sm text-dnd-parchment focus:outline-none"
      value={nameDraft}
      maxLength={80}
      onChange={(e) => setNameDraft(e.target.value)}
      onBlur={commitName}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitName()
        if (e.key === 'Escape') setNameDraft(null)
      }}
    />
  ) : (
    <div className="flex min-w-0 flex-1 items-baseline gap-2">
      <button
        type="button"
        className={cn(
          'min-w-0 truncate text-left font-body text-sm transition-colors hover:text-dnd-gold',
          isActive ? 'font-semibold text-dnd-gold' : 'text-dnd-parchment',
          dead && 'line-through',
        )}
        onClick={() => setNameDraft(c.name)}
        title="Click to rename"
      >
        {c.name}
      </button>
      {isNext && !isActive && <span className="shrink-0 font-ui text-[10px] text-dnd-muted italic">next</span>}
      {playedBy && <span className="hidden shrink-0 truncate font-ui text-[10px] text-dnd-jade/80 italic lg:inline">played by {playedBy}</span>}
    </div>
  )

  const statusTags = (
    <div ref={statusRef} className="relative flex flex-wrap items-center gap-1">
      {visible.map((x) => (
        <StatusPill key={x.key} condition={x} onRemove={() => onSave({ conditions: withoutCondition(c.conditions, x.key) })} />
      ))}
      <button
        type="button"
        onClick={() => setStatusOpen((v) => !v)}
        aria-label={`Conditions for ${c.name}`}
        aria-expanded={statusOpen}
        className="inline-flex h-5 w-5 items-center justify-center rounded border border-dnd-border/40 text-dnd-muted transition-colors hover:border-dnd-border hover:text-dnd-parchment"
        title="Add a condition like Prone or Poisoned. Pick “Timed or custom” for spells such as Bless."
      >
        <Plus className="h-3 w-3" />
      </button>
      {statusOpen && (
        <div className="absolute top-full left-0 z-30 mt-1 max-h-56 w-44 overflow-y-auto rounded-lg border border-dnd-border bg-dnd-dark py-1 shadow-xl">
          {available.map((d) => (
            <button
              key={d.key}
              type="button"
              title={d.summary}
              onClick={() => {
                onSave({ conditions: withCondition(c.conditions, { key: d.key, rounds: null }) })
                setStatusOpen(false)
              }}
              className="w-full px-3 py-1 text-left font-ui text-xs text-dnd-parchment transition-colors hover:bg-dnd-surface/60"
            >
              {d.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setStatusOpen(false)
              onConditions()
            }}
            className="mt-1 w-full border-t border-dnd-border/50 px-3 pt-1.5 pb-1 text-left font-ui text-xs text-dnd-jade italic hover:bg-dnd-surface/60"
          >
            Timed or custom…
          </button>
        </div>
      )}
    </div>
  )

  const smallInput =
    'w-10 rounded border border-dnd-border/40 bg-dnd-dark px-1 py-0.5 text-center font-body text-xs text-dnd-parchment focus:border-dnd-gold/50 focus:outline-none'
  const initiativeInput = (
    <input
      inputMode="numeric"
      className={smallInput}
      aria-label={`Initiative for ${c.name}`}
      title="Initiative. Type to change it; the order updates."
      value={initDraft ?? String(c.initiative)}
      onFocus={(e) => {
        setInitDraft(String(c.initiative))
        e.target.select()
      }}
      onChange={(e) => setInitDraft(e.target.value.replace(/[^\d-]/g, '').slice(0, 4))}
      onBlur={commitInit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
  const acInput = (
    <input
      inputMode="numeric"
      className={smallInput}
      aria-label={`Armor class for ${c.name}`}
      title="Armor Class. Type to change it."
      placeholder="AC"
      value={acDraft ?? String(c.armor_class ?? '')}
      onFocus={(e) => {
        setAcDraft(String(c.armor_class ?? ''))
        e.target.select()
      }}
      onChange={(e) => setAcDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
      onBlur={commitAc}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )

  const hpCell =
    c.max_hp !== null ? (
      <button
        type="button"
        onClick={onHp}
        title="Damage, heal or give temporary HP. Shortcuts: D, H, T"
        aria-label={`${c.name}: ${c.current_hp} of ${c.max_hp} hit points. Change HP`}
        className="w-24 shrink-0 rounded px-1.5 py-1 text-left transition-colors hover:bg-dnd-surface/60"
      >
        <span className="flex items-center justify-between font-body text-[11px]">
          <span className="flex items-center gap-1 text-dnd-parchment">
            <Heart className="h-3 w-3 text-red-400" />
            {c.current_hp}
            <span className="text-dnd-muted">/{c.max_hp}</span>
          </span>
          {c.temp_hp > 0 && <span className="text-sky-300">+{c.temp_hp}</span>}
        </span>
        <HpBar current={c.current_hp} max={c.max_hp} temp={c.temp_hp} className="mt-1 h-1" />
      </button>
    ) : (
      <button type="button" onClick={onEdit} className="w-24 shrink-0 px-1.5 text-left font-ui text-[11px] text-dnd-muted italic hover:text-dnd-parchment">
        no HP
      </button>
    )

  const iconBtn = 'rounded p-1 text-dnd-muted transition-colors hover:text-dnd-parchment disabled:opacity-40'
  const tools = (
    <>
      <button
        type="button"
        onClick={() => onSave({ hidden: !c.hidden })}
        className={cn(iconBtn, c.hidden && 'text-purple-300')}
        aria-label={c.hidden ? `Show ${c.name} to players` : `Hide ${c.name} from players`}
        title={c.hidden ? 'Hidden from players. Click to reveal it.' : 'Hide from players: it won’t appear on the player view, even on its turn.'}
      >
        {c.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      {upload && (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={iconBtn} title="Upload a portrait. It’s resized automatically." aria-label={`Upload token image for ${c.name}`}>
          <ImagePlus className="h-3.5 w-3.5" />
        </button>
      )}
      <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-dnd-muted" title="Player character: players see its exact HP, not just how hurt it looks">
        <input type="checkbox" checked={c.is_player} onChange={(e) => onSave({ is_player: e.target.checked })} className="h-3 w-3 accent-(--color-heading)" />
        PC
      </label>
      <button type="button" onClick={onDuplicate} className={iconBtn} title="Add a copy with the next number (Goblin 1 → Goblin 2). Monsters roll their own initiative." aria-label={`Duplicate ${c.name}`}>
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onEdit} className={iconBtn} title="Edit everything: HP, notes, portrait, hidden… Shortcut: E" aria-label={`Edit ${c.name}`}>
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onDelete} className={cn(iconBtn, 'hover:text-dnd-red!')} title="Remove from the fight. Undo from the message that appears." aria-label={`Remove ${c.name}`}>
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </>
  )

  return (
    <li
      onClick={onSelect}
      aria-current={isActive ? 'step' : undefined}
      className={cn(
        'group rounded-lg border transition-colors',
        isActive ? 'border-dnd-gold/50 bg-dnd-card/95' : selected ? 'border-dnd-jade/50 bg-dnd-dark/90' : 'border-dnd-border/40 bg-dnd-dark/80',
        dead && 'opacity-50',
        c.hidden && !isActive && 'border-dashed',
      )}
    >
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      {/* One line on wide screens; on a phone the numbers and tools wrap under the name. */}
      <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2 sm:py-1.5">
        {avatar}
        <div className="flex min-w-0 flex-1 flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
          {nameCell}
          {statusTags}
        </div>
        {hpCell}
        <div className="flex w-full items-center gap-2 pl-10 sm:w-auto sm:pl-0" onClick={(e) => e.stopPropagation()}>
          {initiativeInput}
          {acInput}
          {tools}
        </div>
      </div>
    </li>
  )
}
