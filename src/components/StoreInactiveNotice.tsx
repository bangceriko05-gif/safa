import { AlertTriangle, Copy, Check, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { toast } from "sonner";

interface StoreInactiveNoticeProps {
  storeName?: string;
  onLogout: () => void;
}

export default function StoreInactiveNotice({ storeName, onLogout }: StoreInactiveNoticeProps) {
  const [copied, setCopied] = useState(false);
  const bankAccount = "0241003956";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bankAccount);
      setCopied(true);
      toast.success("Nomor rekening berhasil disalin!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Gagal menyalin nomor rekening");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-main)" }}>
      <Card className="w-full max-w-lg shadow-lg border-destructive/20">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl text-destructive">Akses PMS Dinonaktifkan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            {storeName && (
              <p className="font-medium text-foreground">Outlet: {storeName}</p>
            )}
            <p className="text-muted-foreground">
              Jatuh tempo pembayaran PMS Anda berlaku hari ini. Segera lakukan pembayaran dan hubungi administrator untuk mengaktifkan kembali PMS di outlet Anda.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Silakan transfer ke rekening berikut:</p>
              <div className="flex items-center justify-center gap-2">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg" 
                  alt="BCA" 
                  className="h-6"
                />
                <span className="font-bold text-lg">BCA</span>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-3">
              <code className="text-2xl font-bold tracking-wider bg-background px-4 py-2 rounded-md border">
                {bankAccount}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1 text-green-500" />
                    Tersalin
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Salin
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              a.n. FAUZAN ASSIDDIQI
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">Hubungi Administrator</p>
                <p className="text-amber-700 dark:text-amber-300">
                  Setelah melakukan pembayaran, hubungi administrator untuk konfirmasi dan pengaktifan kembali.
                </p>
              </div>
            </div>
          </div>

          <Button onClick={onLogout} variant="outline" className="w-full mt-4">
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
