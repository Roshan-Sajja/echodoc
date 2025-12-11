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
 * ALWAYS includes the first chunk (metadata) plus top relevant chunks
 * Returns chunks sorted by relevance score, maintaining original order
 */
export function findRelevantChunks(
  query: string,
  chunks: string[],
  maxChunks: number = 3,
): string[] {
  if (chunks.length === 0) {
    return [];
  }

  // ALWAYS include the first chunk (contains metadata like title, channel)
  const firstChunk = chunks[0];
  
  if (!query.trim() || chunks.length <= maxChunks) {
    // If no query or few chunks, return first N chunks
    return chunks.slice(0, Math.min(maxChunks, chunks.length));
  }

  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2); // Ignore very short words

  if (queryWords.length === 0) {
    return chunks.slice(0, Math.min(maxChunks, chunks.length));
  }

  // Score chunks AFTER the first one (first chunk is always included)
  const remainingChunks = chunks.slice(1);
  const scored = remainingChunks.map((chunk, index) => {
    const lowerChunk = chunk.toLowerCase();
    const score = queryWords.reduce((totalScore, word) => {
      const matches = (lowerChunk.match(new RegExp(word, "g")) || []).length;
      return totalScore + matches;
    }, 0);

    return { chunk, index: index + 1, score }; // index + 1 because we sliced from 1
  });

  // Sort by score (highest first), take top (maxChunks - 1) since first chunk is reserved
  const topRelevant = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks - 1);

  // Combine first chunk with top relevant chunks, sort by original order
  const selected = [{ chunk: firstChunk, index: 0, score: 0 }, ...topRelevant]
    .sort((a, b) => a.index - b.index)
    .map((item) => item.chunk);

  return selected;
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
