import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImageRef } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { normalizeReceiptImage } from '@/lib/receiptImage';
import type { EncodedImage, ReceiptImage, ReceiptImageSize, ReceiptImageTools } from '@/lib/receiptImage';
import type { PrepareTiming } from '@/lib/scanTiming';

// The manipulator reads HEIC and applies EXIF orientation while decoding (iOS fixes it explicitly, Android's
// Glide loader and the browser apply it), so the saved JPEG is upright and carries no orientation tag.
/** Resizes (when `size` is given), renders, and saves as JPEG. The source is a file URI or an already decoded image. */
async function renderJpeg(source: string | ImageRef, size: ReceiptImageSize | null, quality: number): Promise<EncodedImage> {
  const context = ImageManipulator.manipulate(source);
  if (size) context.resize(size);
  const rendered = await context.renderAsync();
  try {
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: quality });
    if (Platform.OS === 'web') {
      const file = await fetch(saved.uri).then((response) => response.blob());
      return { uri: saved.uri, width: saved.width, height: saved.height, size: file.size, file };
    }
    return { uri: saved.uri, width: saved.width, height: saved.height, size: new File(saved.uri).size };
  } finally {
    rendered.release();
    context.release();
  }
}

const tools: ReceiptImageTools<ImageRef> = {
  decode: (uri) => ImageManipulator.manipulate(uri).renderAsync(),
  encode: (image, size, quality) => renderJpeg(image, size, quality),
  // One pass from the file: orientation is applied before the resize in the same context (iOS fixes it first;
  // Android and the browser decode upright), so the result matches decode-then-encode.
  encodeFile: (uri, size, quality) => renderJpeg(uri, size, quality),
  release: (image) => image.release(),
};

/**
 * Turns a picked camera or library photo into an upright JPEG of at most 2400 px and 5 MB, ready for OCR. `size` is
 * the picker's upright width and height (expo-image-picker reports them oriented on iOS and Android), which allows
 * the single pass.
 */
export function prepareReceiptImage(uri: string, { size, onTiming }: { size?: ReceiptImageSize; onTiming?: (timing: PrepareTiming) => void } = {}): Promise<ReceiptImage> {
  return normalizeReceiptImage(uri, tools, { size, onTiming });
}
