export function parsePgVector(input: unknown): number[] {
  if (Array.isArray(input)) {
    return input.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  }

  if (typeof input !== "string") {
    return [];
  }

  const trimmed = input.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return [];
  }

  const body = trimmed.slice(1, -1).trim();
  if (!body) {
    return [];
  }

  const vector = body
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value));

  // L2 normalize the vector for consistent cosine distance calculation
  let norm = 0;
  for (let i = 0; i < vector.length; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    return vector.map(v => v / norm);
  }

  return vector;
}

export function vectorToPgString(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

export function cosineDistance(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return Number.POSITIVE_INFINITY;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return 1 - similarity;
}

export function mergeCentroid(current: number[], currentCount: number, sample: number[]): number[] {
  if (current.length !== sample.length) {
    return current;
  }

  const next = new Array<number>(current.length);
  for (let i = 0; i < current.length; i += 1) {
    next[i] = (current[i] * currentCount + sample[i]) / (currentCount + 1);
  }

  // L2 normalize the new centroid
  let norm = 0;
  for (let i = 0; i < next.length; i++) {
    norm += next[i] * next[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    return next.map(v => v / norm);
  }

  return next;
}
