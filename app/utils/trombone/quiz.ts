import { NOTES, type TromboneNote } from './positions'

export type QuizMode = 'name' | 'position'

export interface Question {
  note: TromboneNote
  mode: QuizMode
  /** Button labels: display names for 'name' (4), '1'–'7' for 'position'. */
  choices: string[]
  /** The correct choice — always a member of choices. */
  answer: string
}

export const POSITION_CHOICES = ['1', '2', '3', '4', '5', '6', '7']

const BASE_WEIGHT = 1
const WRONG_BOOST = 4
const MAX_WEIGHT = 12

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]!] = [arr[j]!, arr[i]!]
  }
  return arr
}

/**
 * Session-only quiz over the note set. Wrong answers boost a note's weight
 * so it reappears more often; correct answers decay it back to baseline.
 */
export function createQuiz(notes: TromboneNote[] = NOTES) {
  const weights = new Map(notes.map(n => [n.id, BASE_WEIGHT]))
  let lastId: string | null = null

  function pickNote(): TromboneNote {
    const pool = notes.length > 1 ? notes.filter(n => n.id !== lastId) : notes
    const total = pool.reduce((sum, n) => sum + weights.get(n.id)!, 0)
    let r = Math.random() * total
    for (const n of pool) {
      r -= weights.get(n.id)!
      if (r < 0) return n
    }
    return pool[pool.length - 1]!
  }

  function nameChoices(note: TromboneNote): string[] {
    const others = [...new Set(notes.map(n => n.display))].filter(d => d !== note.display)
    return shuffle([note.display, ...shuffle(others).slice(0, 3)])
  }

  return {
    next(): Question {
      const note = pickNote()
      lastId = note.id
      const mode: QuizMode = Math.random() < 0.5 ? 'name' : 'position'
      return mode === 'name'
        ? { note, mode, choices: nameChoices(note), answer: note.display }
        : { note, mode, choices: [...POSITION_CHOICES], answer: String(note.position) }
    },
    submit(question: Question, choice: string): boolean {
      const correct = choice === question.answer
      const w = weights.get(question.note.id)!
      weights.set(
        question.note.id,
        correct ? Math.max(BASE_WEIGHT, w - 1) : Math.min(MAX_WEIGHT, w + WRONG_BOOST),
      )
      return correct
    },
    /** Exposed for verification only. */
    weightOf(id: string): number {
      return weights.get(id) ?? 0
    },
  }
}
