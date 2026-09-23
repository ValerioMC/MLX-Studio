/**
 * Longest edge, in pixels, of an image sent to a vision model. Vision encoders
 * resize far below this anyway, and every attached image is stored in the chat
 * history and resent with each follow-up, so larger ones only cost space and time.
 */
export const MAX_IMAGE_EDGE = 1600;

const JPEG_QUALITY = 0.9;

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** The size an image is scaled to so its longest edge fits `maxEdge`; never upscales. */
export function fitWithin(size: Size, maxEdge: number): Size {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxEdge) return size;
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the image"));
    reader.readAsDataURL(file);
  });
}

/**
 * An image file as a data URL ready to attach: unchanged when it already fits,
 * otherwise redrawn at `MAX_IMAGE_EDGE`. PNG stays PNG to keep transparency;
 * everything else becomes JPEG.
 */
export async function imageForModel(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const target = fitWithin({ width: bitmap.width, height: bitmap.height }, MAX_IMAGE_EDGE);
  if (target.width === bitmap.width && target.height === bitmap.height) {
    bitmap.close();
    return readAsDataUrl(file);
  }
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Could not resize the image: no 2D canvas available.");
  }
  context.drawImage(bitmap, 0, 0, target.width, target.height);
  bitmap.close();
  return file.type === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
