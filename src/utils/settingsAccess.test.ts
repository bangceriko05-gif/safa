import { expect, test } from "bun:test";
import { canAccessSettingsTab, canOpenSettings, SETTINGS_PERMISSIONS } from "./settingsAccess";

test("User with Nota permission can open settings and Nota without manage_settings", () => {
  const has = (name: string) => name === "settings_print";
  expect(canOpenSettings(has)).toBe(true);
  expect(canAccessSettingsTab("print", has)).toBe(true);
  expect(canAccessSettingsTab("outlet", has)).toBe(false);
});

test("User without Nota permission cannot access Nota even with settings menu permission", () => {
  expect(canAccessSettingsTab("print", name => name === "manage_settings")).toBe(false);
});

for (const [tab, permission] of Object.entries(SETTINGS_PERMISSIONS)) {
  test(`${permission} grants only its own submenu`, () => {
    expect(canAccessSettingsTab(tab, name => name === permission)).toBe(true);
    expect(canAccessSettingsTab(tab, () => false)).toBe(false);
  });
}
