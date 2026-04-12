export interface TrieNode {
  children: Record<string, TrieNode>
  isEnd: boolean
}

export function createNode(): TrieNode {
  return { children: {}, isEnd: false }
}

export function insert(root: TrieNode, word: string): void {
  let node = root
  for (const ch of word) {
    if (!node.children[ch]) {
      node.children[ch] = createNode()
    }
    node = node.children[ch]
  }
  node.isEnd = true
}

// Check if a complete word exists
export function isWord(root: TrieNode, word: string): boolean {
  let node = root
  for (const ch of word) {
    if (!node.children[ch]) return false
    node = node.children[ch]
  }
  return node.isEnd
}

// Check if any word starts with this prefix
export function hasPrefix(root: TrieNode, prefix: string): boolean {
  let node = root
  for (const ch of prefix) {
    if (!node.children[ch]) return false
    node = node.children[ch]
  }
  return true
}

// Build a Trie from a list of words
export function buildTrie(words: string[]): TrieNode {
  const root = createNode()
  for (const word of words) {
    insert(root, word.toUpperCase())
  }
  return root
}
