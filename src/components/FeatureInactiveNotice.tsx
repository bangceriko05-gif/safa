import { LucideIcon, Lock } from "lucide-react";

interface FeatureInactiveNoticeProps {
  featureName: string;
  icon?: LucideIcon;
  price?: string | null;
  description?: string | null;
}

export default function FeatureInactiveNotice({ 
  featureName, 
  icon: Icon = Lock, 
  price, 
  description 
}: FeatureInactiveNoticeProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Fitur ini tidak aktif
      </h3>
      {price && (
        <p className="text-sm font-medium text-foreground mb-1">{price}</p>
      )}
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-2 whitespace-pre-line">{description}</p>
      )}
      <p className="text-sm text-muted-foreground max-w-md">
        Lakukan pembayaran untuk mengaktifkan fitur {featureName}.
      </p>
    </div>
  );
}
