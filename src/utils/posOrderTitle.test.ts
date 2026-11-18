/// <reference types="bun" />
import { expect, test } from "bun:test";
import { isDuplicateBidError, posOrderTitleBid } from "./posOrderTitle";

test("an empty cart still shows the Pesanan Baru label", () => {
  expect(posOrderTitleBid({ itemCount: 0, pendingBid: "FBSTR20261118004" })).toBeNull();
});

test("the first item turns the label into the BID reserved for this order", () => {
  expect(posOrderTitleBid({ itemCount: 1, pendingBid: "FBSTR20261118004" })).toBe("FBSTR20261118004");
});

test("a saved order or booking keeps its own BID over a reserved number", () => {
  expect(
    posOrderTitleBid({ itemCount: 2, orderBid: "FBSTR20261118001", pendingBid: "FBSTR20261118009" })
  ).toBe("FBSTR20261118001");
  expect(
    posOrderTitleBid({ itemCount: 1, bookingBid: "BO-STR-20261118-002", pendingBid: "FBSTR20261118009" })
  ).toBe("BO-STR-20261118-002");
});

test("a blank BID never shows as an empty title", () => {
  expect(posOrderTitleBid({ itemCount: 1, orderBid: "   ", pendingBid: "" })).toBeNull();
});

test("a BID already used by another cashier is recognised so it can be replaced", () => {
  expect(isDuplicateBidError({ code: "23505" })).toBe(true);
  expect(
    isDuplicateBidError({ message: 'duplicate key value violates unique constraint "booking_orders_bid_key"' })
  ).toBe(true);
  expect(isDuplicateBidError({ code: "42501", message: "permission denied" })).toBe(false);
  expect(isDuplicateBidError(null)).toBe(false);
});
