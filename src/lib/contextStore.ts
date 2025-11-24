/**
 * Tiny in-memory store that keeps extracted document text around just long enough
 * for the chat UI to reference it. Think of it as a super simple clipboard keyed
 * by UUIDs – perfect for demos, but ready to swap out
 */
import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const contexts = new Map<string, string>();
const logDir = path.join(process.cwd(), "logs");
const persistFile = path.join(logDir, "contexts.json");
let canPersistToDisk = true;

// Load persisted contexts on startup
try {
  if (existsSync(persistFile)) {
    const raw = readFileSync(persistFile, "utf8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    Object.entries(parsed).forEach(([k, v]) => contexts.set(k, v));
  }
} catch (err) {
  canPersistToDisk = false;
  console.error("[ContextStore] Failed to load persisted contexts", err);
}

function persist() {
  if (!canPersistToDisk) return;
  try {
    mkdirSync(logDir, { recursive: true });
    const obj: Record<string, string> = {};
    contexts.forEach((v, k) => {
      obj[k] = v;
    });
    writeFileSync(persistFile, JSON.stringify(obj), "utf8");
  } catch (err) {
    canPersistToDisk = false;
    console.warn("[ContextStore] Disabling disk persistence (unavailable)", err);
  }
}

export function saveContext(text: string): string {
  const id = randomUUID();
  contexts.set(id, text);
  persist();
  return id;
}

export function getContext(id: string): string | undefined {
  const existing = contexts.get(id);
  if (existing) return existing;

  // Fallback: attempt to reload from disk in case this worker missed a previous save
  if (!canPersistToDisk) {
    return contexts.get(id);
  }
  try {
    if (existsSync(persistFile)) {
      const raw = readFileSync(persistFile, "utf8");
      const parsed = JSON.parse(raw) as Record<string, string>;
      Object.entries(parsed).forEach(([k, v]) => contexts.set(k, v));
    }
  } catch (err) {
    canPersistToDisk = false;
    console.warn("[ContextStore] Disabling disk reloads (unavailable)", err);
  }

  return contexts.get(id);
}
