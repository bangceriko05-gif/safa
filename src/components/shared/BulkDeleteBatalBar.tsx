import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  selectedCount: number;
  totalCount: number;
  entityLabel: string; // e.g. "pengeluaran"
  onSelectAllToggle: () => void;
  onDelete: () => Promise<void> | void;
}

export default function BulkDeleteBatalBar({
  selectedCount,
  totalCount,
  entityLabel,
  onSelectAllToggle,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const allSelected = selectedCount === totalCount && totalCount > 0;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onDelete();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 ml-auto">
      {selectedCount > 0 && (
        <span className="text-sm text-muted-foreground">{selectedCount} dipilih</span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={onSelectAllToggle}
        disabled={totalCount === 0}
      >
        {allSelected ? "Batal Pilih Semua" : "Pilih Semua"}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={selectedCount === 0}
      >
        <Trash2 className="h-4 w-4 mr-1" />
        Hapus Permanen
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Permanen {entityLabel} Batal?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus permanen <b>{selectedCount}</b> {entityLabel} berstatus
              "Batal". Tindakan ini tidak dapat dibatalkan dan akan menghapus semua data
              terkait (item, BID, dll).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Menghapus..." : "Ya, Hapus Permanen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}