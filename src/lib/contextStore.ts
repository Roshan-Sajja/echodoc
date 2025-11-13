/**
 * Tiny in-memory store that keeps extracted document text around just long enough
 * for the chat UI to reference it. Think of it as a super simple clipboard keyed
 * by UUIDs – perfect for demos, but ready to swap out
 */
import { randomUUID } from "crypto";

const contexts = new Map<string, string>();

export function saveContext(text: string): string {
  const id = randomUUID();
  contexts.set(id, text);
  return id;
}

export function getContext(id: string): string | undefined {
  return contexts.get(id);
}
