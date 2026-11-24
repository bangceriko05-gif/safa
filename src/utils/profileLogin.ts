/** Only the requested app destination is accepted; never redirect to external URLs. */
export function profileLoginDestination(search: string): '/profil' | null {
  return new URLSearchParams(search).get('next') === '/profil' ? '/profil' : null;
}

export function profileStoreSelectionPath(search: string): string {
  return profileLoginDestination(search) ? '/select-store?next=%2Fprofil' : '/select-store';
}

export function profileLoginCallback(origin: string, search: string): string {
  return profileLoginDestination(search) ? `${origin}/auth?next=%2Fprofil` : origin;
}