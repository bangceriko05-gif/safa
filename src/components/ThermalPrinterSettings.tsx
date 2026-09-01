import { useEffect, useState } from "react";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Bluetooth, Usb, Wifi, Cable, Printer, Loader2, Plug, Copy } from "lucide-react";
import {
  DEFAULT_PRINTER_CONFIG,
  PrinterConfig,
  PrinterConnection,
  loadPrinterConfig,
  savePrinterConfig,
  pairPrinter,
  printRaw,
  printerSupport,
  disconnectPrinter,
} from "@/lib/thermalPrinter";
import { EscPosBuilder, colsForPaper, formatIDR } from "@/lib/escpos";

const CONNECTIONS: { value: PrinterConnection; label: string; icon: any; hint: string }[] = [
  { value: "bluetooth", label: "Bluetooth", icon: Bluetooth, hint: "Printer thermal BLE (Chrome Android / desktop)" },
  { value: "usb", label: "USB", icon: Usb, hint: "Printer USB langsung ke perangkat kasir (WebUSB)" },
  { value: "serial", label: "Serial / COM", icon: Cable, hint: "Printer USB-Serial di PC (Web Serial)" },
  { value: "lan", label: "LAN / WiFi", icon: Wifi, hint: "Printer jaringan port 9100 via ANKA Print Bridge" },
];

const BRIDGE_SCRIPT = `// ANKA Print Bridge - jalankan di PC kasir: node anka-bridge.js
const http = require('http'); const net = require('net');
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();
  let body = ''; req.on('data', c => body += c);
  req.on('end', () => {
    try {
      const { host, port, data } = JSON.parse(body);
      const socket = net.connect(port || 9100, host, () => {
        socket.write(Buffer.from(data, 'base64'), () => socket.end());
        res.writeHead(200); res.end('ok');
      });
      socket.on('error', e => { res.writeHead(500); res.end(String(e)); });
    } catch (e) { res.writeHead(400); res.end(String(e)); }
  });
}).listen(9110, () => console.log('ANKA Print Bridge :9110'));`;

export default function ThermalPrinterSettings() {
  const { currentStore } = useStore();
  const [config, setConfig] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG);
  const [pairing, setPairing] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setConfig(loadPrinterConfig(currentStore?.id));
  }, [currentStore?.id]);

  const update = <K extends keyof PrinterConfig>(k: K, v: PrinterConfig[K]) =>
    setConfig((c) => ({ ...c, [k]: v }));

  const persist = (next: PrinterConfig) => {
    setConfig(next);
    savePrinterConfig(next, currentStore?.id);
  };

  const handleSave = () => {
    savePrinterConfig(config, currentStore?.id);
    toast.success("Pengaturan printer tersimpan");
  };

  const handlePair = async () => {
    setPairing(true);
    try {
      const name = await pairPrinter(config);
      persist({ ...config, deviceName: name });
      toast.success(`Terhubung ke ${name}`);
    } catch (e: any) {
      if (e?.name !== "NotFoundError") toast.error(e?.message || "Gagal menghubungkan printer");
    } finally {
      setPairing(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const cols = colsForPaper(config.paper);
      const b = new EscPosBuilder(cols);
      b.align("center").size(2, 2).bold(true).line(currentStore?.name || "ANKA PMS");
      b.size(1, 1).bold(false).line("TEST PRINT").line(new Date().toLocaleString("id-ID"));
      b.align("left").divider();
      b.row("Kertas", `${config.paper}mm (${cols} kolom)`);
      b.row("Koneksi", config.connection.toUpperCase());
      b.row("Perangkat", (config.deviceName || "-").slice(0, cols - 12));
      b.divider();
      b.row("Contoh Item x2", `Rp ${formatIDR(25000)}`);
      b.row("Diskon", `-Rp ${formatIDR(5000)}`);
      b.bold(true).row("TOTAL", `Rp ${formatIDR(20000)}`).bold(false);
      b.divider();
      b.align("center").line("Printer siap digunakan").line("Powered by ANKA PMS").feed(1);
      if (config.openDrawer) b.openDrawer();
      if (config.autoCut) b.cut();
      await printRaw(b.build(), { ...config, copies: 1 });
      toast.success("Perintah cetak terkirim ke printer");
    } catch (e: any) {
      toast.error(e?.message || "Gagal mencetak");
    } finally {
      setTesting(false);
    }
  };

  const supported = printerSupport[config.connection];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          Driver Printer (Cetak Langsung)
        </CardTitle>
        <CardDescription>
          Cetak nota langsung ke printer thermal tanpa dialog cetak browser. Mendukung Bluetooth, USB, Serial, dan LAN/WiFi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection type */}
        <div className="space-y-2">
          <Label>Tipe Koneksi</Label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {CONNECTIONS.map((c) => {
              const Icon = c.icon;
              const active = config.connection === c.value;
              const ok = printerSupport[c.value];
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => update("connection", c.value)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    active ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium text-sm">{c.label}</span>
                    {!ok && <Badge variant="outline" className="text-[10px]">N/A</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{c.hint}</p>
                </button>
              );
            })}
          </div>
          {!supported && (
            <p className="text-xs text-destructive">
              Browser/perangkat ini tidak mendukung koneksi tersebut. Gunakan Chrome atau Edge (Android/desktop);
              di iOS gunakan opsi LAN dengan ANKA Print Bridge atau tetap pakai dialog cetak.
            </p>
          )}
        </div>

        {/* Device pairing / LAN fields */}
        {config.connection === "lan" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">IP Printer</Label>
              <Input
                placeholder="192.168.1.87"
                value={config.host || ""}
                onChange={(e) => update("host", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Port</Label>
              <Input
                type="number"
                value={config.port ?? 9100}
                onChange={(e) => update("port", Number(e.target.value) || 9100)}
              />
            </div>
            <div>
              <Label className="text-xs">URL Print Bridge</Label>
              <Input
                placeholder="http://localhost:9110"
                value={config.bridgeUrl || ""}
                onChange={(e) => update("bridgeUrl", e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 bg-muted/30">
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs">Perangkat Terpilih</Label>
              <p className="text-sm font-medium">{config.deviceName || "Belum ada perangkat"}</p>
            </div>
            {config.connection === "serial" && (
              <div className="w-32">
                <Label className="text-xs">Baud Rate</Label>
                <Select value={String(config.baudRate ?? 9600)} onValueChange={(v) => update("baudRate", Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[9600, 19200, 38400, 57600, 115200].map((b) => (
                      <SelectItem key={b} value={String(b)}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="outline" onClick={handlePair} disabled={pairing || !supported}>
              {pairing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}
              {config.deviceName ? "Ganti Perangkat" : "Cari & Hubungkan"}
            </Button>
          </div>
        )}

        {/* Paper & behaviour */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Lebar Kertas</Label>
            <Select value={String(config.paper)} onValueChange={(v) => update("paper", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="52">52 mm</SelectItem>
                <SelectItem value="58">58 mm</SelectItem>
                <SelectItem value="80">80 mm</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Jumlah Salinan</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={config.copies}
              onChange={(e) => update("copies", Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
            />
          </div>
          <div className="space-y-3 pt-5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Potong Kertas Otomatis</Label>
              <Switch checked={config.autoCut} onCheckedChange={(v) => update("autoCut", !!v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Buka Laci Kasir</Label>
              <Switch checked={config.openDrawer} onCheckedChange={(v) => update("openDrawer", !!v)} />
            </div>
          </div>
        </div>

        {/* Bridge helper */}
        <Accordion type="single" collapsible>
          <AccordionItem value="bridge">
            <AccordionTrigger className="text-sm">Cara pakai printer LAN / WiFi (ANKA Print Bridge)</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Browser tidak bisa membuka koneksi TCP port 9100 secara langsung. Jalankan script kecil ini di PC kasir
                (butuh Node.js), lalu isi IP printer di atas.
              </p>
              <pre className="text-[11px] bg-muted rounded-md p-3 overflow-auto max-h-56 whitespace-pre-wrap">{BRIDGE_SCRIPT}</pre>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(BRIDGE_SCRIPT);
                  toast.success("Script disalin");
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> Salin Script
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => disconnectPrinter()}>Putuskan</Button>
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
            Test Print
          </Button>
          <Button onClick={handleSave}>Simpan</Button>
        </div>
      </CardContent>
    </Card>
  );
}
