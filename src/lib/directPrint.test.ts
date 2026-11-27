import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  __resetPrinterRuntimeForTests,
  DEFAULT_PRINTER_CONFIG,
  disconnectPrinter,
  isPrinterConnected,
  pairPrinter,
  printRaw,
  savePrinterConfig,
  shouldAttemptDirectPrint,
  type PrinterConfig,
} from "@/lib/thermalPrinter";
import { runDirectOrTabPrint, bookingReceiptUrl, transactionReceiptUrl, depositReceiptUrl } from "@/lib/directPrint";
import {
  buildBookingReceiptEscPos,
  buildDepositReceiptEscPos,
  buildDraftInvoiceEscPos,
  buildTransactionReceiptEscPos,
} from "@/lib/receiptEscPos";

// Minimal localStorage polyfill for bun test environment
const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (k: string) => (storageMap.has(k) ? storageMap.get(k)! : null),
  setItem: (k: string, v: string) => {
    storageMap.set(k, String(v));
  },
  removeItem: (k: string) => {
    storageMap.delete(k);
  },
  clear: () => storageMap.clear(),
};

const origLocalStorage = (globalThis as any).localStorage;
const origNavigator = (globalThis as any).navigator;
const origFetch = globalThis.fetch;

function setMockNavigator(nav: Record<string, any>) {
  Object.defineProperty(globalThis, "navigator", {
    value: nav,
    configurable: true,
    writable: true,
  });
}

function decodeBytes(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : b === 10 ? "\n" : ""))
    .join("");
}

beforeEach(() => {
  storageMap.clear();
  (globalThis as any).localStorage = mockLocalStorage;
  __resetPrinterRuntimeForTests();
});

afterEach(() => {
  __resetPrinterRuntimeForTests();
  (globalThis as any).localStorage = origLocalStorage;
  Object.defineProperty(globalThis, "navigator", {
    value: origNavigator,
    configurable: true,
    writable: true,
  });
  globalThis.fetch = origFetch;
});

describe("Direct print vs tab fallback decision", () => {
  it("opens a new tab immediately without printing when printer is not connected", async () => {
    let printed = false;
    let openedTab = 0;
    let afterErr: boolean | null = null;

    const result = await runDirectOrTabPrint({
      shouldAttemptSync: () => false,
      checkConnected: async () => true,
      printDirectly: async () => {
        printed = true;
      },
      openTab: (err) => {
        openedTab++;
        afterErr = err;
      },
    });

    expect(result).toEqual({ mode: "tab" });
    expect(printed).toBe(false);
    expect(openedTab).toBe(1);
    expect(afterErr).toBe(false);
  });

  it("prints directly without opening a new tab when printer is connected", async () => {
    let printed = false;
    let openedTab = 0;

    const result = await runDirectOrTabPrint({
      shouldAttemptSync: () => true,
      checkConnected: async () => true,
      printDirectly: async () => {
        printed = true;
      },
      openTab: () => {
        openedTab++;
      },
    });

    expect(result).toEqual({ mode: "direct" });
    expect(printed).toBe(true);
    expect(openedTab).toBe(0);
  });

  it("opens a new tab when previously configured printer is no longer connected", async () => {
    let printed = false;
    let openedTab = 0;

    const result = await runDirectOrTabPrint({
      shouldAttemptSync: () => true,
      checkConnected: async () => false,
      printDirectly: async () => {
        printed = true;
      },
      openTab: () => {
        openedTab++;
      },
    });

    expect(result).toEqual({ mode: "tab" });
    expect(printed).toBe(false);
    expect(openedTab).toBe(1);
  });

  it("falls back to opening a new tab if direct printing throws an error", async () => {
    let openedTab = 0;
    let afterErr: boolean | null = null;

    const result = await runDirectOrTabPrint({
      shouldAttemptSync: () => true,
      checkConnected: async () => true,
      printDirectly: async () => {
        throw new Error("Printer disconnected mid-write");
      },
      openTab: (err) => {
        openedTab++;
        afterErr = err;
      },
    });

    expect(result.mode).toBe("fallback");
    expect(openedTab).toBe(1);
    expect(afterErr).toBe(true);
  });
});

describe("Thermal printer connection detection", () => {
  it("reports disconnected when no printer has been configured", async () => {
    setMockNavigator({});
    expect(shouldAttemptDirectPrint("store-1")).toBe(false);
    expect(await isPrinterConnected("store-1")).toBe(false);
  });

  it("detects live paired Bluetooth printer and clears state on disconnect", async () => {
    const written: Uint8Array[] = [];
    const mockChar = {
      properties: { write: true, writeWithoutResponse: false },
      writeValue: async (chunk: Uint8Array) => {
        written.push(chunk);
      },
    };
    const listeners: Record<string, () => void> = {};
    const mockDevice = {
      name: "RPP02N",
      gatt: {
        connected: false,
        connect: async () => {
          mockDevice.gatt.connected = true;
          return {
            getPrimaryServices: async () => [{ getCharacteristics: async () => [mockChar] }],
          };
        },
        disconnect: () => {
          mockDevice.gatt.connected = false;
          listeners["gattserverdisconnected"]?.();
        },
      },
      addEventListener: (ev: string, fn: () => void) => {
        listeners[ev] = fn;
      },
    };

    setMockNavigator({
      bluetooth: {
        requestDevice: async () => mockDevice,
      },
    });

    const cfg: PrinterConfig = { ...DEFAULT_PRINTER_CONFIG, connection: "bluetooth" };
    const paired = await pairPrinter(cfg);
    expect(paired.deviceName).toBe("RPP02N");
    savePrinterConfig({ ...cfg, deviceName: paired.deviceName, connected: true }, "store-1");

    expect(shouldAttemptDirectPrint("store-1")).toBe(true);
    expect(await isPrinterConnected("store-1")).toBe(true);

    await printRaw(new Uint8Array([0x41, 0x42]), { ...cfg, deviceName: "RPP02N", connected: true });
    expect(written.length).toBe(1);

    await disconnectPrinter("store-1");
    expect(shouldAttemptDirectPrint("store-1")).toBe(false);
    expect(await isPrinterConnected("store-1")).toBe(false);
  });

  it("detects plugged-in USB printer and falls back when unplugged", async () => {
    const transferred: Uint8Array[] = [];
    const mockUsbDev = {
      vendorId: 0x04b8,
      productId: 0x0202,
      productName: "EPSON TM-T82",
      opened: false,
      configuration: {
        interfaces: [
          {
            interfaceNumber: 0,
            alternates: [{ endpoints: [{ direction: "out", endpointNumber: 1 }] }],
          },
        ],
      },
      open: async () => {
        mockUsbDev.opened = true;
      },
      close: async () => {
        mockUsbDev.opened = false;
      },
      selectConfiguration: async () => {},
      claimInterface: async () => {},
      transferOut: async (_ep: number, data: Uint8Array) => {
        transferred.push(data);
      },
    };

    let pluggedIn = true;
    setMockNavigator({
      usb: {
        getDevices: async () => (pluggedIn ? [mockUsbDev] : []),
        requestDevice: async () => {
          throw new Error("Should not prompt device picker during silent print");
        },
      },
    });

    const cfg: PrinterConfig = {
      ...DEFAULT_PRINTER_CONFIG,
      connection: "usb",
      deviceName: "EPSON TM-T82",
      vendorId: 0x04b8,
      productId: 0x0202,
      connected: true,
    };
    savePrinterConfig(cfg, "store-usb");

    expect(shouldAttemptDirectPrint("store-usb")).toBe(true);
    expect(await isPrinterConnected("store-usb")).toBe(true);
    await printRaw(new Uint8Array([1, 2, 3]), cfg, { allowPrompt: false });
    expect(transferred.length).toBe(1);

    // Unplug USB printer: must report disconnected and NOT invoke requestDevice
    pluggedIn = false;
    expect(await isPrinterConnected("store-usb")).toBe(false);
    await expect(printRaw(new Uint8Array([1, 2, 3]), cfg, { allowPrompt: false })).rejects.toThrow();
  });

  it("sends LAN print via bridge and fails cleanly when bridge is unreachable", async () => {
    setMockNavigator({});
    const cfg: PrinterConfig = {
      ...DEFAULT_PRINTER_CONFIG,
      connection: "lan",
      host: "192.168.1.87",
      port: 9100,
      bridgeUrl: "http://localhost:9110",
      connected: true,
    };
    savePrinterConfig(cfg, "store-lan");

    expect(shouldAttemptDirectPrint("store-lan")).toBe(true);
    expect(await isPrinterConnected("store-lan")).toBe(true);

    let calledUrl = "";
    globalThis.fetch = (async (url: any) => {
      calledUrl = String(url);
      return new Response("ok", { status: 200 });
    }) as any;

    await printRaw(new Uint8Array([0x1b, 0x40]), cfg, { allowPrompt: false });
    expect(calledUrl).toBe("http://localhost:9110/print");

    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as any;
    await expect(printRaw(new Uint8Array([0x1b, 0x40]), cfg, { allowPrompt: false })).rejects.toThrow();
  });
});

describe("Receipt URLs and ESC/POS builders", () => {
  it("builds accurate receipt URLs", () => {
    expect(bookingReceiptUrl({ bookingId: "b1" })).toBe("/receipt?id=b1");
    expect(bookingReceiptUrl({ orderId: "o1" })).toBe("/receipt?order=o1");
    expect(bookingReceiptUrl({ bookingId: "b1", combined: true })).toBe("/receipt?id=b1&combined=1");
    expect(transactionReceiptUrl("t1", "income")).toBe("/receipt/transaction?id=t1&type=income");
    expect(depositReceiptUrl("d1")).toBe("/receipt/deposit?id=d1");
  });

  it("formats booking, POS order, transaction, deposit reprint, and draft invoice receipts", () => {
    const cfg: PrinterConfig = { ...DEFAULT_PRINTER_CONFIG, paper: 58, autoCut: true, openDrawer: false };

    const bookingText = decodeBytes(
      buildBookingReceiptEscPos(
        {
          header: { businessName: "SAFA Kost", footerText: "Terima kasih" },
          title: "NOTA BOOKING",
          bid: "BO-20261127-001",
          createdAt: "2026-11-27T07:00:00Z",
          customerName: "Budi",
          phone: "08123456789",
          statusLabel: "Check In",
          orderOnlyMode: false,
          checkInDate: "2026-11-27",
          checkOutDate: new Date("2026-11-28"),
          duration: 1,
          durationUnit: "malam",
          roomName: "101",
          variantName: "Reguler",
          roomSubtotal: 250000,
          products: [{ name: "Air Mineral", quantity: 2, subtotal: 10000, freePpn: true }],
          discountAmount: 10000,
          serviceCharge: { label: "Service Charge (5%)", amount: 12500 },
          tax: { label: "PPN (11%)", amount: 27500 },
          grandTotal: 290000,
          isLunas: true,
          payments: [{ label: "Pembayaran 1:", method: "QRIS", amount: 290000, ref: "INV-1" }],
          totalPaid: 290000,
          remaining: 0,
        },
        cfg
      )
    );
    expect(bookingText).toContain("SAFA Kost");
    expect(bookingText).toContain("NOTA BOOKING");
    expect(bookingText).toContain("BO-20261127-001");
    expect(bookingText).toContain("(free ppn)");
    expect(bookingText).toContain("LUNAS");
    expect(bookingText).toContain("290.000");

    const txText = decodeBytes(
      buildTransactionReceiptEscPos(
        {
          header: { businessName: "SAFA Kost" },
          isExpense: false,
          bid: "INC-01",
          createdAt: "2026-11-27T07:00:00Z",
          date: "2026-11-27",
          customerName: "Sari",
          paymentMethod: "Cash",
          creatorName: "Admin",
          totalAmount: 100000,
          paidAmount: 150000,
        },
        cfg
      )
    );
    expect(txText).toContain("NOTA PEMASUKAN");
    expect(txText).toContain("Kembalian");
    expect(txText).toContain("50.000");

    const depText = decodeBytes(
      buildDepositReceiptEscPos(
        {
          header: { businessName: "SAFA Kost" },
          isReprint: true,
          createdAt: "2026-11-27T07:00:00Z",
          roomName: "205",
          isUang: true,
          amount: 100000,
          statusLabel: "Aktif",
          creatorName: "Fauzan",
        },
        cfg
      )
    );
    expect(depText).toContain("REPRINT");
    expect(depText).toContain("NOTA DEPOSIT");
    expect(depText).toContain("100.000");

    const invText = decodeBytes(
      buildDraftInvoiceEscPos(
        {
          storeName: "SAFA Kost",
          dateLabel: "27/11/2026",
          customerName: "Andi",
          products: [{ name: "Kopi", quantity: 1, subtotal: 25000 }],
          discount: { label: "Diskon 10%", amount: 2500 },
          total: 22500,
        },
        cfg
      )
    );
    expect(invText).toContain("INVOICE");
    expect(invText).toContain("22.500");
  });
});