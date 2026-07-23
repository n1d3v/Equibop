import { type NativeImage, nativeImage } from "electron";

function quantizeChannel(value: number, bits: number): number {
    const levels = (1 << bits) - 1;
    const quantized = Math.round((value / 255) * levels);
    return Math.round((quantized / levels) * 255);
}

export function quantizeTo16BitColor(image: NativeImage): NativeImage {
    const { width, height } = image.getSize();
    if (!width || !height) return image;

    const bitmap = Buffer.from(image.toBitmap());
    for (let i = 0; i < bitmap.length; i += 4) {
        bitmap[i] = quantizeChannel(bitmap[i], 5);
        bitmap[i + 1] = quantizeChannel(bitmap[i + 1], 6);
        bitmap[i + 2] = quantizeChannel(bitmap[i + 2], 5);
    }

    return nativeImage.createFromBuffer(bitmap, { width, height });
}