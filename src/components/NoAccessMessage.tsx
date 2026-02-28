import { ShieldX } from "lucide-react";

interface NoAccessMessageProps {
  featureName?: string;
}

export default function NoAccessMessage({ featureName }: NoAccessMessageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <ShieldX className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Anda tidak memiliki akses ke fitur ini
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">
        Hubungi PIC Anda untuk mendapatkan akses
        {featureName ? ` ke ${featureName}` : ""}.
      </p>
    </div>
  );
}
