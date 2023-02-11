import toString from "./toString";

// THANKS: https://github.com/kohos/CriTools/blob/master/src/utf.js

function findZero(view: DataView, start: number) {
    while (view.getUint8(start) !== 0x0) start++;
    return start;
}
  
export default function parseUTF(buffer: ArrayBuffer) {
    if (buffer.byteLength < 4) return null;
    let view = new DataView(buffer);
    const config = {
        magic: toString(buffer.slice(0, 4)),
        dataSize: view.getUint32(4, false),
        unknown: view.getUint16(8, false),
        valueOffset: view.getUint16(10, false) + 8,
        stringOffset: view.getUint32(12, false) + 8,
        dataOffset: view.getUint32(16, false) + 8,
        nameOffset: view.getUint32(20, false) + 8,
        elementCount: view.getUint16(24, false),
        valueSize: view.getUint16(26, false),
        pageCount: view.getUint32(28, false),
        name: '',
        types: []
    };
    if (config.magic !== '@UTF') return null;

    let stringEnd = findZero(view, config.stringOffset);
    config.name = toString(buffer.slice(config.stringOffset, stringEnd));
    
    let valuePos = config.valueOffset;
    const pages = [];
    let firstPos = 32;
    for (let i = 0; i < config.pageCount; i++) {
        let page: any = {};
        let pos = firstPos;
        for (let j = 0; j < config.elementCount; j++) {
            let type = view.getUint8(pos); pos = pos + 1;
            // @ts-ignore
            if (i === 0) config.types[j] = type;
            let stringOffset = config.stringOffset + view.getUint32(pos, false); pos += 4;
            stringEnd = findZero(view, stringOffset);
            const key = toString(buffer.slice(stringOffset, stringEnd));
            const method = type >>> 5;
            type = type & 0x1F;
            let value = null;
            if (method > 0) {
            let offset = method === 1 ? pos : valuePos;
            switch (type) {
                case 0x10: value = view.getInt8(offset); offset += 1; break;
                case 0x11: value = view.getUint8(offset); offset += 1; break;
                case 0x12: value = view.getInt16(offset, false); offset += 2; break;
                case 0x13: value = view.getUint16(offset, false); offset += 2; break;
                case 0x14: value = view.getInt32(offset, false); offset += 4; break;
                case 0x15: value = view.getUint32(offset, false); offset += 4; break;
                case 0x16: value = view.getBigInt64(offset, false); offset += 8; break;
                case 0x17: value = view.getBigUint64(offset, false); offset += 8; break;
                case 0x18: value = view.getFloat32(offset, false); offset += 4; break;
                case 0x19: debugger; value = view.getFloat64(offset, false); offset += 8; break;
                case 0x1A:
                    stringOffset = config.stringOffset + view.getUint32(offset, false); offset += 4;
                    stringEnd = findZero(view, stringOffset);
                    value = toString(buffer.slice(stringOffset, stringEnd));
                    break;
                case 0x1B:
                    const bufferStart = config.dataOffset + view.getUint32(offset, false); offset += 4;
                    const bufferLen = view.getUint32(offset, false); offset += 4;
                    value = buffer.slice(bufferStart, bufferStart + bufferLen);
                    let temp = parseUTF(value);
                    if (temp) value = temp;
                break;
                default:
                    console.warn(`unknown type when parsing UTFs: ${type}`);
                break;
            }
            if (method === 1) pos = offset; else valuePos = offset;
            }
            page[key] = value;
        }
        pages.push(page);
    }
    //pages.config = config;
    return pages;
}