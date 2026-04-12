import { type BoardState } from './board'
import { buildTrie, type TrieNode } from './trie'
import { generateMoves } from './solver'

let trie: TrieNode | null = null

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data

  if (type === 'init') {
    try {
      const response = await fetch('/scrabble/dictionary.json')
      const words: string[] = await response.json()
      trie = buildTrie(words)
      self.postMessage({ type: 'ready' })
    } catch (err) {
      self.postMessage({ type: 'error', payload: 'Failed to load dictionary' })
    }
  }

  if (type === 'solve') {
    if (!trie) {
      self.postMessage({ type: 'error', payload: 'Dictionary not loaded' })
      return
    }

    const board: BoardState = payload
    const startTime = performance.now()
    const moves = generateMoves(board, trie)
    const elapsed = Math.round(performance.now() - startTime)

    self.postMessage({ type: 'result', payload: { moves, elapsed } })
  }
}
