import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImageRef } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { normalizeReceiptImage } from '@/lib/receiptImage';
import type { ReceiptImage, ReceiptImageTools } from '@/lib/receiptImage';
import type { PrepareTiming } from '@/lib/scanTiming';

// The manipulator reads HEIC and applies EXIF orientation while decoding (iOS fixes it explicitly, Android's
// Glide loader and the browser apply it), so the saved JPEG is upright and carries no orientation tag.
const tools: ReceiptImageTools<ImageRef> = {
  decode: (uri) => ImageManipulator.manipulate(uri).renderAsync(),
  async encode(image, size, quality) {
    const context = ImageManipulator.manipulate(image);
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
  },
  release: (image) => image.release(),
};

/** Turns a picked camera or library photo into an upright JPEG of at most 2400 px and 5 MB, ready for OCR. */
export function prepareReceiptImage(uri: string, onTiming?: (timing: PrepareTiming) => void): Promise<ReceiptImage> {
  return normalizeReceiptImage(uri, tools, onTiming);
}
