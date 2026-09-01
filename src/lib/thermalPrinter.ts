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

const STORAGE_PREFIX = "anka_printer_config_";

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
  } catch {
    /* ignore quota */
  }
}

export const printerSupport = {
  bluetooth: typeof navigator !== "undefined" && "bluetooth" in navigator,
  usb: typeof navigator !== "undefined" && "usb" in navigator,
  serial: typeof navigator !== "undefined" && "serial" in navigator,
  lan: true, // requires the local bridge app
};

export function isDirectPrintSupported(connection: PrinterConnection): boolean {
  return !!printerSupport[connection];
}

/* ------------------------------------------------------------------ */
/* Bluetooth (BLE)                                                     */
/* ------------------------------------------------------------------ */

// Service UUIDs used by most generic ESC/POS BLE printers
const BLE_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

let bleDevice: any = null;
let bleChar: any = null;

async function connectBluetooth(pick: boolean): Promise<any> {
  const nav: any = navigator;
  if (!nav.bluetooth) throw new Error("Browser ini tidak mendukung Bluetooth (gunakan Chrome / Edge).");

  if (pick || !bleDevice) {
    bleDevice = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_SERVICES,
    });
    bleChar = null;
  }

  if (bleChar && bleDevice?.gatt?.connected) return bleChar;

  const server = await bleDevice.gatt.connect();
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics();
    const writable = chars.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
    if (writable) {
      bleChar = writable;
      break;
    }
  }
  if (!bleChar) throw new Error("Printer Bluetooth tidak punya karakteristik tulis (tidak kompatibel ESC/POS).");
  return bleChar;
}

async function writeBluetooth(data: Uint8Array) {
  const char = await connectBluetooth(false);
  const chunkSize = 180;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (char.properties.writeWithoutResponse) await char.writeValueWithoutResponse(chunk);
    else await char.writeValue(chunk);
    await new Promise((r) => setTimeout(r, 20));
  }
}

/* ------------------------------------------------------------------ */
/* USB (WebUSB)                                                        */
/* ------------------------------------------------------------------ */

let usbDevice: any = null;

async function connectUsb(pick: boolean): Promise<any> {
  const nav: any = navigator;
  if (!nav.usb) throw new Error("Browser ini tidak mendukung WebUSB (gunakan Chrome / Edge di desktop atau Android).");

  if (pick || !usbDevice) {
    const paired = await nav.usb.getDevices();
    usbDevice = !pick && paired.length ? paired[0] : await nav.usb.requestDevice({ filters: [{ classCode: 7 }, {}] });
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
  return { device: usbDevice, endpoint: endpoint.endpointNumber };
}

async function writeUsb(data: Uint8Array) {
  const { device, endpoint } = await connectUsb(false);
  await device.transferOut(endpoint, data);
}

/* ------------------------------------------------------------------ */
/* Serial (Web Serial)                                                 */
/* ------------------------------------------------------------------ */

let serialPort: any = null;

async function connectSerial(pick: boolean, baudRate = 9600): Promise<any> {
  const nav: any = navigator;
  if (!nav.serial) throw new Error("Browser ini tidak mendukung Web Serial (gunakan Chrome / Edge desktop).");
  if (pick || !serialPort) {
    const ports = await nav.serial.getPorts();
    serialPort = !pick && ports.length ? ports[0] : await nav.serial.requestPort();
  }
  if (!serialPort.writable) await serialPort.open({ baudRate });
  return serialPort;
}

async function writeSerial(data: Uint8Array, baudRate = 9600) {
  const port = await connectSerial(false, baudRate);
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
  if (!config.host) throw new Error("IP printer LAN belum diisi.");
  let binary = "";
  data.forEach((b) => (binary += String.fromCharCode(b)));
  const res = await fetch(`${bridge}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host: config.host,
      port: config.port || 9100,
      data: btoa(binary),
    }),
  });
  if (!res.ok) throw new Error(`Print Bridge menolak permintaan (${res.status}).`);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Ask the user to pick/pair a device. Returns the device label. */
export async function pairPrinter(config: PrinterConfig): Promise<string> {
  switch (config.connection) {
    case "bluetooth": {
      await connectBluetooth(true);
      return bleDevice?.name || "Printer Bluetooth";
    }
    case "usb": {
      await connectUsb(true);
      return usbDevice?.productName || `USB ${usbDevice?.vendorId}:${usbDevice?.productId}`;
    }
    case "serial": {
      await connectSerial(true, config.baudRate);
      const info = serialPort?.getInfo?.() || {};
      return info.usbVendorId ? `Serial ${info.usbVendorId}:${info.usbProductId}` : "Port Serial";
    }
    case "lan":
      return `${config.host || "-"}:${config.port || 9100}`;
  }
}

export async function disconnectPrinter() {
  try {
    if (bleDevice?.gatt?.connected) bleDevice.gatt.disconnect();
  } catch { /* ignore */ }
  try {
    if (serialPort?.writable) await serialPort.close();
  } catch { /* ignore */ }
  bleChar = null;
  serialPort = null;
}

/** Send raw ESC/POS bytes to the configured printer. */
export async function printRaw(data: Uint8Array, config: PrinterConfig): Promise<void> {
  const copies = Math.max(1, config.copies || 1);
  for (let i = 0; i < copies; i++) {
    switch (config.connection) {
      case "bluetooth":
        await writeBluetooth(data);
        break;
      case "usb":
        await writeUsb(data);
        break;
      case "serial":
        await writeSerial(data, config.baudRate);
        break;
      case "lan":
        await writeLan(data, config);
        break;
    }
    if (i < copies - 1) await new Promise((r) => setTimeout(r, 400));
  }
}
