import { describe, expect, test } from 'bun:test';
import { profileLoginCallback, profileLoginDestination, profileStoreSelectionPath } from './profileLogin';

describe('profil login destination', () => {
  test('keeps /profil through login and outlet selection', () => {
    expect(profileLoginDestination('?next=%2Fprofil')).toBe('/profil');
    expect(profileStoreSelectionPath('?next=%2Fprofil')).toBe('/select-store?next=%2Fprofil');
  });
  test('Google returns to a public login page retaining /profil', () => {
    expect(profileLoginCallback('https://www.anka.management', '?next=%2Fprofil')).toBe('https://www.anka.management/auth?next=%2Fprofil');
  });
  test('ordinary dashboard login remains unchanged', () => {
    expect(profileStoreSelectionPath('')).toBe('/select-store');
    expect(profileLoginCallback('https://www.anka.management', '')).toBe('https://www.anka.management');
  });
  test('rejects outside origins and other destinations', () => {
    for (const next of ['https://evil.example/profil', '//evil.example/profil', '/auth', '/profil/other']) {
      expect(profileLoginDestination(`?next=${encodeURIComponent(next)}`)).toBeNull();
      expect(profileStoreSelectionPath(`?next=${encodeURIComponent(next)}`)).toBe('/select-store');
    }
  });
});