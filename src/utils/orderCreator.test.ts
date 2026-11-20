import { expect, test } from "bun:test";
import { creatorDisplayName } from "./orderCreator";

test("nama profil dipakai apa adanya sebagai pembuat transaksi", () => {
  expect(creatorDisplayName({ name: "fauzan", email: "fauzan.dicky354@gmail.com" })).toBe("fauzan");
});

test("nama kosong memakai awalan email, lalu fallback Petugas", () => {
  expect(creatorDisplayName({ name: "   ", email: "nadya@mail.com" })).toBe("nadya");
  expect(creatorDisplayName({ name: null, email: null })).toBe("Petugas");
  expect(creatorDisplayName(null)).toBe("Petugas");
});
