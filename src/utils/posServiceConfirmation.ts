export function canConfirmPosService(name: string): boolean {
  return name.trim().length > 0;
}

export function withPosServiceNote(note: string, name: string): string {
  const cleaned = note.replace(/\[Dilayani oleh: [^\]]*\]/g, "").trim();
  const safeName = name.replace(/[\[\]\r\n]/g, " ").trim();
  return [cleaned, safeName ? `[Dilayani oleh: ${safeName}]` : ""].filter(Boolean).join(" ");
}