/**
 * Cost optimization: Chunk text and retrieve only relevant chunks based on query
 * This reduces token usage by 70-90% for long documents
 */

/**
 * Split text into overlapping chunks for better context continuity
 */
export function chunkText(
  text: string,
  chunkSize: number = 2000,
  overlap: number = 200,
): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Find the most relevant chunks based on keyword matching
 * Returns top N chunks sorted by relevance score, maintaining original order
 */
export function findRelevantChunks(
  query: string,
  chunks: string[],
  maxChunks: number = 3,
): string[] {
  if (!query.trim() || chunks.length === 0) {
    // If no query, return first chunks (usually intro/summary)
    return chunks.slice(0, Math.min(maxChunks, chunks.length));
  }

  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2); // Ignore very short words

  if (queryWords.length === 0) {
    return chunks.slice(0, Math.min(maxChunks, chunks.length));
  }

  // Score each chunk based on keyword frequency
  const scored = chunks.map((chunk, index) => {
    const lowerChunk = chunk.toLowerCase();
    const score = queryWords.reduce((totalScore, word) => {
      const matches = (lowerChunk.match(new RegExp(word, "g")) || []).length;
      return totalScore + matches;
    }, 0);

    return { chunk, index, score };
  });

  // Sort by score (highest first), take top N, then restore original order
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)
    .sort((a, b) => a.index - b.index) // Maintain document order
    .map((item) => item.chunk);
}

/**
 * Get optimized context: either relevant chunks (if query provided) or first chunks
 */
export function getOptimizedContext(
  text: string,
  query?: string | null,
  maxChunks: number = 3,
): string {
  if (!text.trim()) {
    return text;
  }

  // For very short texts, don't chunk
  if (text.length <= 3000) {
    return text;
  }

  const chunks = chunkText(text);
  const relevantChunks = findRelevantChunks(query || "", chunks, maxChunks);

  // Join chunks with separator
  return relevantChunks.join("\n\n---\n\n");
}
