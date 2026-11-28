/**
 * Thermal printer driver layer for ANKA.
 * Sends raw ESC/POS bytes directly from the browser:
 *  - bluetooth : Web Bluetooth (BLE thermal printers)
 *  - usb       : WebUSB (USB printer class)
 *  - serial    : Web Serial (USB-serial / COM port)
 *  - lan       : network printer port 9100 via a local ANKA Print Bridge
 * Falls back to the browser print dialog when nothing is supported.
 */

export type PrinterConnection = "bluetooth" | "usb" | "serial" | "lan";

export interface PrinterConfig {
  connection: PrinterConnection;
  paper: number; // mm: 52 | 58 | 80
  deviceName?: string;
  /** Explicit connection state; false when user disconnected, true once paired/configured */
  connected?: boolean;
  /** Saved USB/Serial hardware identifiers for matching previously granted devices */
  vendorId?: number;
  productId?: number;
  // lan
  host?: string;
  port?: number;
  bridgeUrl?: string;
  // serial
  baudRate?: number;
  // behaviour
  autoCut: boolean;
  openDrawer: boolean;
  copies: number;
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  connection: "bluetooth",
  paper: 58,
  port: 9100,
  bridgeUrl: "http://localhost:9110",
  baudRate: 9600,
  autoCut: true,
  openDrawer: false,
  copies: 1,
};

export class PrinterNotConnectedError extends Error {
  constructor(message = "Printer tidak terhubung ke website.") {
    super(message);
    this.name = "PrinterNotConnectedError";
  }
}

const STORAGE_PREFIX = "anka_printer_config_";
const LAST_ACTIVE_KEY = "anka_printer_last_active";

function loadLastActivePrinterConfig(): PrinterConfig | null {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_KEY);
    if (!raw) return null;
    const parsed = { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(raw) } as PrinterConfig;
    return hasConfiguredPrinter(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveLastActivePrinterConfig(config: PrinterConfig) {
  try {
    if (hasConfiguredPrinter(config)) {
      localStorage.setItem(LAST_ACTIVE_KEY, JSON.stringify({ ...config, connected: true }));
    }
  } catch {
    /* ignore quota */
  }
}

function clearLastActivePrinterConfig() {
  try {
    localStorage.removeItem(LAST_ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function loadPrinterConfig(storeId?: string): PrinterConfig {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + (storeId || "default"));
    if (!raw) return { ...DEFAULT_PRINTER_CONFIG };
    return { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PRINTER_CONFIG };
  }
}

export function savePrinterConfig(config: PrinterConfig, storeId?: string) {
  try {
    localStorage.setItem(STORAGE_PREFIX + (storeId || "default"), JSON.stringify(config));
    if (config.connected === false) {
      clearLastActivePrinterConfig();
    } else if (hasConfiguredPrinter(config)) {
      saveLastActivePrinterConfig(config);
    }
  } catch {
    /* ignore quota */
  }
}

export function hasConfiguredPrinter(config: PrinterConfig): boolean {
  if (config.connected === false) return false;
  if (config.connection === "lan") return Boolean(config.host?.trim());
  return Boolean(config.deviceName?.trim());
}

export const printerSupport = {
  bluetooth: typeof navigator !== "undefined" && "bluetooth" in navigator,
  usb: typeof navigator !== "undefined" && "usb" in navigator,
  serial: typeof navigator !== "undefined" && "serial" in navigator,
  lan: true, // requires the local bridge app
};

export function isDirectPrintSupported(connection: PrinterConnection): boolean {
  if (connection === "lan") return true;
  if (typeof navigator === "undefined") return false;
  return connection in navigator;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new PrinterNotConnectedError(message)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/* ------------------------------------------------------------------ */
/* Bluetooth (BLE)                                                     */
/* ------------------------------------------------------------------ */

// Service UUIDs used by most generic ESC/POS BLE printers
const BLE_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "0000af30-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
];

const BLE_CONNECT_TIMEOUT_MS = 6000;
// Universal BLE ATT MTU is 23 bytes (20-byte write payload) across Android/iOS/desktop thermal printers
const BLE_SAFE_CHUNK_SIZE = 20;

let bleDevice: any = null;
let bleChar: any = null;
let bleWriteQueue: Promise<void> = Promise.resolve();
let activeLiveConnection: PrinterConnection | null = null;

function attachBleDisconnectListener(device: any) {
  if (!device || typeof device.addEventListener !== "function") return;
  if (device.__ankaDisconnectAttached) return;
  device.__ankaDisconnectAttached = true;
  device.addEventListener("gattserverdisconnected", () => {
    bleChar = null;
    if (activeLiveConnection === "bluetooth") activeLiveConnection = null;
  });
}

async function resolvePairedBleDevice(config?: PrinterConfig): Promise<any | null> {
  if (bleDevice) return bleDevice;
  const nav: any = typeof navigator !== "undefined" ? navigator : null;
  if (!nav?.bluetooth || typeof nav.bluetooth.getDevices !== "function") return null;
  try {
    const devices = await nav.bluetooth.getDevices();
    if (!Array.isArray(devices) || devices.length === 0) return null;
    const matched = config?.deviceName
      ? devices.find((d: any) => d?.name === config.deviceName) || devices[0]
      : devices[0];
    if (matched) {
      bleDevice = matched;
      attachBleDisconnectListener(bleDevice);
    }
    return matched || null;
  } catch {
    return null;
  }
}

async function connectBluetooth(pick: boolean, allowPrompt = pick, config?: PrinterConfig): Promise<any> {
  const nav: any = navigator;
  if (!nav.bluetooth) throw new Error("Browser ini tidak mendukung Bluetooth (gunakan Chrome / Edge).");

  if (pick) {
    bleDevice = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_SERVICES,
    });
    bleChar = null;
    attachBleDisconnectListener(bleDevice);
  } else if (!bleDevice) {
    const existing = await resolvePairedBleDevice(config);
    if (existing) {
      bleDevice = existing;
    } else if (allowPrompt) {
      bleDevice = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_SERVICES,
      });
      bleChar = null;
      attachBleDisconnectListener(bleDevice);
    } else {
      throw new PrinterNotConnectedError("Printer Bluetooth belum terhubung.");
    }
  }

  if (bleChar && bleDevice?.gatt?.connected) {
    activeLiveConnection = "bluetooth";
    return bleChar;
  }

  const server = await withTimeout<any>(
    bleDevice.gatt.connect(),
    BLE_CONNECT_TIMEOUT_MS,
    "Printer Bluetooth tidak merespons."
  );
  let services: any[] = [];
  try {
    services = await server.getPrimaryServices();
  } catch {
    for (const uuid of BLE_SERVICES) {
      try {
        const svc = await server.getPrimaryService(uuid);
        if (svc) services.push(svc);
      } catch {
        /* service not on this printer */
      }
    }
  }
  for (const service of services) {
    try {
      const chars = await service.getCharacteristics();
      const writable = chars.find((c: any) => c.properties?.writeWithoutResponse || c.properties?.write);
      if (writable) {
        bleChar = writable;
        break;
      }
    } catch {
      /* skip unreadable service */
    }
  }
  if (!bleChar) throw new Error("Printer Bluetooth tidak punya karakteristik tulis (tidak kompatibel ESC/POS).");
  activeLiveConnection = "bluetooth";
  return bleChar;
}

async function writeBleChunk(char: any, chunk: Uint8Array) {
  const preferWithoutResponse = Boolean(char.properties?.writeWithoutResponse && typeof char.writeValueWithoutResponse === "function");
  const canWriteWithResponse = Boolean(char.properties?.write && (typeof char.writeValueWithResponse === "function" || typeof char.writeValue === "function"));

  if (preferWithoutResponse) {
    try {
      await char.writeValueWithoutResponse(chunk);
      return;
    } catch (err) {
      if (!canWriteWithResponse) throw err;
    }
  }

  if (typeof char.writeValueWithResponse === "function") {
    await char.writeValueWithResponse(chunk);
  } else if (typeof char.writeValue === "function") {
    await char.writeValue(chunk);
  } else if (typeof char.writeValueWithoutResponse === "function") {
    await char.writeValueWithoutResponse(chunk);
  } else {
    throw new Error("Karakteristik printer Bluetooth tidak mendukung penulisan data.");
  }
}

async function writeBluetooth(data: Uint8Array, allowPrompt: boolean, config?: PrinterConfig) {
  const run = async () => {
    const sendAll = async (char: any) => {
      for (let i = 0; i < data.length; i += BLE_SAFE_CHUNK_SIZE) {
        const chunk = data.slice(i, i + BLE_SAFE_CHUNK_SIZE);
        await writeBleChunk(char, chunk);
        await new Promise((r) => setTimeout(r, 12));
      }
    };

    let char = await connectBluetooth(false, allowPrompt, config);
    try {
      await sendAll(char);
    } catch (firstErr) {
      // Retry once after refreshing GATT characteristic in case the printer went idle silently
      bleChar = null;
      if (bleDevice?.gatt?.connected) {
        try {
          bleDevice.gatt.disconnect();
        } catch {
          /* ignore */
        }
      }
      try {
        char = await connectBluetooth(false, allowPrompt, config);
        await sendAll(char);
      } catch {
        throw firstErr;
      }
    }
  };
  const queued = bleWriteQueue.then(run, run);
  bleWriteQueue = queued.catch(() => undefined);
  await queued;
}

/* ------------------------------------------------------------------ */
/* USB (WebUSB)                                                        */
/* ------------------------------------------------------------------ */

let usbDevice: any = null;

function matchUsbDevice(devices: any[], config?: PrinterConfig): any | null {
  if (!devices.length) return null;
  if (config?.vendorId != null && config?.productId != null) {
    const byIds = devices.find(
      (d) => d?.vendorId === config.vendorId && d?.productId === config.productId
    );
    if (byIds) return byIds;
  }
  if (config?.deviceName) {
    const byName = devices.find((d) => d?.productName === config.deviceName);
    if (byName) return byName;
  }
  return devices[0];
}

async function connectUsb(pick: boolean, allowPrompt = pick, config?: PrinterConfig): Promise<any> {
  const nav: any = navigator;
  if (!nav.usb) throw new Error("Browser ini tidak mendukung WebUSB (gunakan Chrome / Edge di desktop atau Android).");

  if (pick) {
    usbDevice = await nav.usb.requestDevice({ filters: [{ classCode: 7 }, {}] });
  } else {
    const paired = await nav.usb.getDevices();
    const stillPresent = usbDevice && paired.includes(usbDevice) ? usbDevice : matchUsbDevice(paired, config);
    if (stillPresent) {
      usbDevice = stillPresent;
    } else if (allowPrompt) {
      usbDevice = await nav.usb.requestDevice({ filters: [{ classCode: 7 }, {}] });
    } else {
      usbDevice = null;
      if (activeLiveConnection === "usb") activeLiveConnection = null;
      throw new PrinterNotConnectedError("Printer USB tidak terhubung.");
    }
  }
  if (!usbDevice.opened) await usbDevice.open();
  if (!usbDevice.configuration) await usbDevice.selectConfiguration(1);

  const iface = usbDevice.configuration.interfaces.find((i: any) =>
    i.alternates.some((a: any) => a.endpoints.some((e: any) => e.direction === "out"))
  );
  if (!iface) throw new Error("Endpoint printer USB tidak ditemukan.");
  try {
    await usbDevice.claimInterface(iface.interfaceNumber);
  } catch {
    /* already claimed */
  }
  const alt = iface.alternates.find((a: any) => a.endpoints.some((e: any) => e.direction === "out"));
  const endpoint = alt.endpoints.find((e: any) => e.direction === "out");
  activeLiveConnection = "usb";
  return { device: usbDevice, endpoint: endpoint.endpointNumber };
}

async function writeUsb(data: Uint8Array, allowPrompt: boolean, config?: PrinterConfig) {
  const { device, endpoint } = await connectUsb(false, allowPrompt, config);
  const chunkSize = 512;
  for (let i = 0; i < data.length; i += chunkSize) {
    await device.transferOut(endpoint, data.slice(i, i + chunkSize));
  }
}

/* ------------------------------------------------------------------ */
/* Serial (Web Serial)                                                 */
/* ------------------------------------------------------------------ */

let serialPort: any = null;

function matchSerialPort(ports: any[], config?: PrinterConfig): any | null {
  if (!ports.length) return null;
  if (config?.vendorId != null && config?.productId != null) {
    const byIds = ports.find((p) => {
      const info = p?.getInfo?.() || {};
      return info.usbVendorId === config.vendorId && info.usbProductId === config.productId;
    });
    if (byIds) return byIds;
  }
  return ports[0];
}

async function connectSerial(pick: boolean, baudRate = 9600, allowPrompt = pick, config?: PrinterConfig): Promise<any> {
  const nav: any = navigator;
  if (!nav.serial) throw new Error("Browser ini tidak mendukung Web Serial (gunakan Chrome / Edge desktop).");
  if (pick) {
    serialPort = await nav.serial.requestPort();
  } else {
    const ports = await nav.serial.getPorts();
    const stillPresent = serialPort && ports.includes(serialPort) ? serialPort : matchSerialPort(ports, config);
    if (stillPresent) {
      serialPort = stillPresent;
    } else if (allowPrompt) {
      serialPort = await nav.serial.requestPort();
    } else {
      serialPort = null;
      if (activeLiveConnection === "serial") activeLiveConnection = null;
      throw new PrinterNotConnectedError("Printer Serial tidak terhubung.");
    }
  }
  if (!serialPort.writable) await serialPort.open({ baudRate });
  activeLiveConnection = "serial";
  return serialPort;
}

async function writeSerial(data: Uint8Array, baudRate = 9600, allowPrompt = false, config?: PrinterConfig) {
  const port = await connectSerial(false, baudRate, allowPrompt, config);
  const writer = port.writable.getWriter();
  try {
    await writer.write(data);
  } finally {
    writer.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* LAN / WiFi (port 9100 via local bridge)                             */
/* ------------------------------------------------------------------ */

async function writeLan(data: Uint8Array, config: PrinterConfig) {
  const bridge = (config.bridgeUrl || DEFAULT_PRINTER_CONFIG.bridgeUrl)!.replace(/\/+$/, "");
  if (!config.host?.trim()) throw new PrinterNotConnectedError("IP printer LAN belum diisi.");
  let binary = "";
  data.forEach((b) => (binary += String.fromCharCode(b)));
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 3000) : null;
  try {
    const res = await fetch(`${bridge}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller?.signal,
      body: JSON.stringify({
        host: config.host.trim(),
        port: config.port || 9100,
        data: btoa(binary),
      }),
    });
    if (!res.ok) throw new PrinterNotConnectedError(`Print Bridge menolak permintaan (${res.status}).`);
    activeLiveConnection = "lan";
  } catch (err) {
    if (err instanceof PrinterNotConnectedError) throw err;
    throw new PrinterNotConnectedError("Printer LAN / Print Bridge tidak terhubung.");
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface PairPrinterResult {
  deviceName: string;
  vendorId?: number;
  productId?: number;
}

/** Resolve effective printer config for an outlet, falling back to an active live session device if needed. */
export function getEffectivePrinterConfig(storeId?: string): PrinterConfig {
  const config = loadPrinterConfig(storeId);
  if (config.connected === false) return config;
  if (hasConfiguredPrinter(config)) return config;
  if (bleDevice?.gatt && (activeLiveConnection === "bluetooth" || bleDevice.gatt.connected)) {
    return { ...config, connection: "bluetooth", deviceName: bleDevice.name || "Printer Bluetooth", connected: true };
  }
  if (usbDevice && (activeLiveConnection === "usb" || usbDevice.opened)) {
    return {
      ...config,
      connection: "usb",
      deviceName: usbDevice.productName || `USB ${usbDevice.vendorId}:${usbDevice.productId}`,
      vendorId: usbDevice.vendorId,
      productId: usbDevice.productId,
      connected: true,
    };
  }
  if (serialPort && (activeLiveConnection === "serial" || serialPort.writable)) {
    const info = serialPort.getInfo?.() || {};
    return {
      ...config,
      connection: "serial",
      deviceName: info.usbVendorId ? `Serial ${info.usbVendorId}:${info.usbProductId}` : "Port Serial",
      vendorId: info.usbVendorId,
      productId: info.usbProductId,
      connected: true,
    };
  }
  const shared = loadLastActivePrinterConfig();
  if (shared) return shared;
  return config;
}

/**
 * Synchronous fast check: could a thermal printer currently be connected for this store?
 * Returning false lets callers open the receipt tab synchronously without popup-blocker risk.
 */
export function shouldAttemptDirectPrint(storeId?: string): boolean {
  const config = getEffectivePrinterConfig(storeId);
  if (config.connected === false) return false;
  if (!isDirectPrintSupported(config.connection)) return false;
  switch (config.connection) {
    case "bluetooth": {
      if (bleDevice?.gatt) return true;
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      return Boolean(config.deviceName?.trim() && typeof nav?.bluetooth?.getDevices === "function");
    }
    case "usb":
      return Boolean(usbDevice?.opened || config.deviceName?.trim());
    case "serial":
      return Boolean(serialPort?.writable || config.deviceName?.trim());
    case "lan":
      return Boolean(config.host?.trim());
  }
}

/**
 * Checks whether a configured thermal printer is actually connected right now
 * without opening any browser pairing dialog.
 */
export async function isPrinterConnected(storeId?: string): Promise<boolean> {
  if (!shouldAttemptDirectPrint(storeId)) return false;
  const config = getEffectivePrinterConfig(storeId);
  const nav: any = typeof navigator !== "undefined" ? navigator : null;

  switch (config.connection) {
    case "bluetooth": {
      if (bleDevice?.gatt?.connected) return true;
      const dev = await resolvePairedBleDevice(config);
      if (!dev?.gatt) return false;
      try {
        await withTimeout(dev.gatt.connect(), BLE_CONNECT_TIMEOUT_MS, "Printer Bluetooth tidak terhubung.");
        return Boolean(dev.gatt.connected);
      } catch {
        return false;
      }
    }
    case "usb": {
      if (!nav?.usb?.getDevices) return false;
      try {
        const paired = await nav.usb.getDevices();
        if (!Array.isArray(paired) || paired.length === 0) {
          usbDevice = null;
          if (activeLiveConnection === "usb") activeLiveConnection = null;
          return false;
        }
        const matched = usbDevice && paired.includes(usbDevice) ? usbDevice : matchUsbDevice(paired, config);
        return Boolean(matched);
      } catch {
        return false;
      }
    }
    case "serial": {
      if (!nav?.serial?.getPorts) return false;
      try {
        const ports = await nav.serial.getPorts();
        if (!Array.isArray(ports) || ports.length === 0) {
          serialPort = null;
          if (activeLiveConnection === "serial") activeLiveConnection = null;
          return false;
        }
        const matched = serialPort && ports.includes(serialPort) ? serialPort : matchSerialPort(ports, config);
        return Boolean(matched);
      } catch {
        return false;
      }
    }
    case "lan":
      return Boolean(config.host?.trim());
  }
}

/** Ask the user to pick/pair a device. Returns the device metadata. */
export async function pairPrinter(config: PrinterConfig): Promise<PairPrinterResult> {
  switch (config.connection) {
    case "bluetooth": {
      await connectBluetooth(true, true, config);
      return { deviceName: bleDevice?.name || "Printer Bluetooth" };
    }
    case "usb": {
      await connectUsb(true, true, config);
      return {
        deviceName: usbDevice?.productName || `USB ${usbDevice?.vendorId}:${usbDevice?.productId}`,
        vendorId: usbDevice?.vendorId,
        productId: usbDevice?.productId,
      };
    }
    case "serial": {
      await connectSerial(true, config.baudRate, true, config);
      const info = serialPort?.getInfo?.() || {};
      return {
        deviceName: info.usbVendorId ? `Serial ${info.usbVendorId}:${info.usbProductId}` : "Port Serial",
        vendorId: info.usbVendorId,
        productId: info.usbProductId,
      };
    }
    case "lan":
      return { deviceName: `${config.host || "-"}:${config.port || 9100}` };
  }
}

export async function disconnectPrinter(storeId?: string) {
  try {
    if (bleDevice?.gatt?.connected) bleDevice.gatt.disconnect();
  } catch { /* ignore */ }
  try {
    if (usbDevice?.opened) await usbDevice.close();
  } catch { /* ignore */ }
  try {
    if (serialPort?.writable) await serialPort.close();
  } catch { /* ignore */ }
  bleDevice = null;
  bleChar = null;
  usbDevice = null;
  serialPort = null;
  activeLiveConnection = null;
  clearLastActivePrinterConfig();
  if (storeId) {
    const current = loadPrinterConfig(storeId);
    savePrinterConfig({ ...current, connected: false }, storeId);
  }
}

/** Send raw ESC/POS bytes to the configured printer. */
export async function printRaw(
  data: Uint8Array,
  config: PrinterConfig,
  options?: { allowPrompt?: boolean }
): Promise<void> {
  const allowPrompt = options?.allowPrompt ?? false;
  const copies = Math.max(1, config.copies || 1);
  for (let i = 0; i < copies; i++) {
    switch (config.connection) {
      case "bluetooth":
        await writeBluetooth(data, allowPrompt, config);
        break;
      case "usb":
        await writeUsb(data, allowPrompt, config);
        break;
      case "serial":
        await writeSerial(data, config.baudRate, allowPrompt, config);
        break;
      case "lan":
        await writeLan(data, config);
        break;
    }
    if (i < copies - 1) await new Promise((r) => setTimeout(r, 400));
  }
}

/** Internal helper for automated tests to reset in-memory hardware handles. */
export function __resetPrinterRuntimeForTests() {
  bleDevice = null;
  bleChar = null;
  usbDevice = null;
  serialPort = null;
  activeLiveConnection = null;
}
