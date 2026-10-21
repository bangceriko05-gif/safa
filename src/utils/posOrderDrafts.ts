export interface PosOrderDraft {
  id: string;
  store_id: string;
  created_at: string;
  [key: string]: any;
}

const keyFor = (storeId: string, userId: string) => `anka:pos-drafts:${userId}:${storeId}`;

export function readPosOrderDrafts(storage: Pick<Storage, "getItem">, storeId: string, userId: string): PosOrderDraft[] {
  const raw = storage.getItem(keyFor(storeId, userId));
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Invalid saved drafts");
  return parsed.filter((draft): draft is PosOrderDraft => !!draft && draft.store_id === storeId && typeof draft.id === "string");
}

export function savePosOrderDraft(storage: Pick<Storage, "getItem" | "setItem">, storeId: string, userId: string, draft: PosOrderDraft) {
  const drafts = readPosOrderDrafts(storage, storeId, userId);
  storage.setItem(keyFor(storeId, userId), JSON.stringify([draft, ...drafts.filter((entry) => entry.id !== draft.id)]));
}

export function removePosOrderDraft(storage: Pick<Storage, "getItem" | "setItem">, storeId: string, userId: string, id: string) {
  storage.setItem(keyFor(storeId, userId), JSON.stringify(readPosOrderDrafts(storage, storeId, userId).filter((draft) => draft.id !== id)));
}

export function isLocalPosDraft(order: { id?: string } | null | undefined): boolean {
  return order?.id?.startsWith("pos-draft:") ?? false;
}