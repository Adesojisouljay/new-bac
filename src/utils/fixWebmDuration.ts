/**
 * Fixes the duration metadata in a WebM blob recorded by MediaRecorder.
 * MediaRecorder produces WebM files with "Infinity" duration which breaks
 * the <audio> element's progress bar. This function patches the EBML container
 * to inject the real duration so browsers can display it correctly.
 *
 * Based on the approach by yusitnikov:
 * https://github.com/nicktindall/cyclon.p2p/issues/2
 */

// EBML element IDs
const DURATION_ID = 0x4489;

function readVInt(data: DataView, offset: number): { value: number; length: number } {
    const byte = data.getUint8(offset);
    let length = 1;
    let mask = 0x80;

    while (length <= 8) {
        if (byte & mask) {
            const value = (byte & (mask - 1)) << ((length - 1) * 8);
            let result = value;
            for (let i = 1; i < length; i++) {
                result = result | (data.getUint8(offset + i) << ((length - i - 1) * 8));
            }
            return { value: result, length };
        }
        mask >>= 1;
        length++;
    }

    return { value: 0, length: 1 };
}

function findElement(data: DataView, id: number, start = 0): number {
    let offset = start;
    while (offset < data.byteLength - 4) {
        let elemId = 0;
        let idLen = 0;

        // Read element ID
        const firstByte = data.getUint8(offset);
        if (firstByte & 0x80) { idLen = 1; elemId = firstByte; }
        else if (firstByte & 0x40) { idLen = 2; elemId = (firstByte << 8) | data.getUint8(offset + 1); }
        else if (firstByte & 0x20) { idLen = 3; elemId = (firstByte << 16) | (data.getUint8(offset + 1) << 8) | data.getUint8(offset + 2); }
        else if (firstByte & 0x10) { idLen = 4; elemId = (firstByte << 24) | (data.getUint8(offset + 1) << 16) | (data.getUint8(offset + 2) << 8) | data.getUint8(offset + 3); }
        else break;

        if (elemId === id) return offset;

        const sizeInfo = readVInt(data, offset + idLen);
        offset += idLen + sizeInfo.length + sizeInfo.value;
    }
    return -1;
}

/**
 * Patches a WebM Blob to include the correct duration.
 * @param blob - The original WebM Blob from MediaRecorder
 * @param durationSeconds - The actual recording duration in seconds
 * @returns A new Blob with the duration embedded
 */
export async function fixWebmDuration(blob: Blob, durationSeconds: number): Promise<Blob> {
    const buffer = await blob.arrayBuffer();
    const data = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Find the Duration element (EBML ID 0x4489)
    const durationOffset = findElement(data, DURATION_ID);
    if (durationOffset === -1) {
        // Can't find the element — return original
        return blob;
    }

    // The Duration element stores a float64 (8 bytes)
    const sizeInfo = readVInt(data, durationOffset + 2);
    const valueOffset = durationOffset + 2 + sizeInfo.length;

    // Write the duration in milliseconds as a float64
    const durationMs = durationSeconds * 1000;
    const view = new DataView(bytes.buffer, valueOffset, 8);
    view.setFloat64(0, durationMs, false); // big-endian

    return new Blob([bytes], { type: blob.type });
}
