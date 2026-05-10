/**
 * Compress an image File to a much smaller JPEG using canvas.
 * - Max dimension 1024px (longest side)
 * - JPEG quality 0.55
 * - If the file is not an image, returns the original file
 */
export async function compressImage(
  file: File,
  opts: { maxDim?: number; quality?: number } = {}
): Promise<File> {
  const maxDim = opts.maxDim ?? 1024;
  const quality = opts.quality ?? 0.55;

  if (!file.type.startsWith("image/")) return file;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  let { width, height } = img;
  const ratio = Math.min(1, maxDim / Math.max(width, height));
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", quality)
  );

  const newName = file.name.replace(/\.(png|jpg|jpeg|webp|gif|bmp)$/i, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}