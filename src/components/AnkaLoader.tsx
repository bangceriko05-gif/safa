export default function AnkaLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="relative h-16 w-16 mb-4">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
      </div>
      <div className="text-2xl font-bold tracking-wider text-primary">ANKA</div>
      <p className="text-sm text-muted-foreground mt-1">Memuat...</p>
    </div>
  );
}