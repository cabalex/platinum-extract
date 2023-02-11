import { concatArrayBuffer, setArrayBuffer } from "../../tools/arrayBufferTools";
import { swap32 } from "../../tools/bigEndianTools";
import generateDATHash from "../../tools/generateDATHash";
import parseUTF from "../../tools/parseUTF";
import readArrayBuffer from "../../tools/readArrayBuffer";
import readFile from "../../tools/readFile";
import toString from "../../tools/toString";
import PlatinumFile from '../Global/PlatinumFile';

// THANKS: https://github.com/kohos/CriTools/blob/master/src/cpk.js
function parseTag(arrayBuffer: ArrayBuffer, tag: string) {
    if (tag !== toString(arrayBuffer.slice(0, 4))) return null;
    const view = new DataView(arrayBuffer);
    const size = view.getUint32(0x8, true);
    if (!size) return null;
    const offset = 0x10;
    return parseUTF(arrayBuffer.slice(offset, offset + size));
}

class BitReader {
    arrayBuffer: ArrayBuffer;
    view: DataView;
    offset: number;
    pool: number;
    left: number;

    constructor(arrayBuffer: ArrayBuffer, view?: DataView) {
        this.arrayBuffer = arrayBuffer;
        this.view = view || new DataView(arrayBuffer);
        this.offset = arrayBuffer.byteLength - 1;
        this.pool = 0;
        this.left = 0;
    }
    getBits(count: number) {
        let result = 0;
        let produced = 0;
        let round;
        while (produced < count) {
            if (this.left == 0) {
                this.pool = this.view.getUint8(this.offset);
                this.left = 8;
                this.offset--;
            }
            if (this.left > (count - produced)) {
                round = count - produced;
            } else {
                round = this.left;
            }
            result <<= round;
            result |= ((this.pool >>> (this.left - round)) & ((1 << round) - 1));
            this.left -= round;
            produced += round;
        }
        return result;
    }
}
  

export class CPKFile extends PlatinumFile {
    root: CPK;
    ext: string;
    offset: number;
    size: number;
    compressedSize: number;
    compressionType = "Unknown";
    arrayBuffer?: ArrayBuffer;

    constructor(root: CPK, name: string, ext: string, offset: number, size: number) {
        super(name, size, true);
        
        this.root = root;
        this.offset = offset;
        this.size = size;
        this.compressedSize = size; // Note: these are identical since we don't know it until reading the file
        this.ext = ext;
    }

    async read() {
        // @ts-ignore
        let arrayBuffer: ArrayBuffer = await readFile(this.root.root.slice(this.offset, this.offset + this.compressedSize), 'arraybuffer');
        
        if ('CRILAYLA' !== toString(arrayBuffer.slice(0, 0x8))) {
            this.compressionType = "None";
            return arrayBuffer;
        }
        this.compressionType = "CRILAYLA";
        
        let dataView = new DataView(arrayBuffer);
        const uncompressSize = dataView.getUint32(0x8, true);
        const headerOffset = dataView.getUint32(0xC, true);
        const result = new Uint8Array(uncompressSize + 0x100);
        for (let i = 0; i < 0x100; i++) result[i] = dataView.getUint8(0x10 + headerOffset + i);
        let output = 0;
        const end = 0x100 + uncompressSize - 1;
        const lens = [ 2, 3, 5, 8 ];
        const reader = new BitReader(arrayBuffer.slice(0, arrayBuffer.byteLength - 0x100));
        while (output < uncompressSize) {
            if (reader.getBits(1) > 0) {
            let offset = end - output + reader.getBits(13) + 3;
            let length = 3;
            let level;
            for (level = 0; level < lens.length; level++) {
                const lv = reader.getBits(lens[level]);
                length += lv;
                if (lv != ((1 << lens[level]) - 1)) break;
            }
            if (level === lens.length) {
                let lv;
                do {
                lv = reader.getBits(8);
                length += lv;
                } while (lv === 0xFF);
            }
            for (let i = 0; i < length; i++) {
                result[end - output] = result[offset--];
                output++;
            }
            } else {
            result[end - output] = reader.getBits(8);
            output++;
            }
        }
        return result.buffer;
    }

    async getArrayBuffer() {
        return await this.read();
    }
}
/**
 * PKZ files are Platinum Games' main compressed archive format.
 * The files inside a DAT are compressed, either in ZSTD (Astral Chain) or Oodle Kraken (Bayonetta).
 */
export default class CPK extends PlatinumFile {
    root: File|null = null;
    files: CPKFile[] = [];
    size: number = 0;

    constructor(name: string, file?: File) {
        super(name, 60, false);
        if (file) this.root = file;
    }

    /**
     * Extracts a DAT file from an ArrayBuffer.
     * @param arrayBuffer The array buffer of the DAT file.
     * @returns the DAT object.
     */
    static async extract(file: File|ArrayBuffer, name: string) {
        // load header
        // Files are just blobs with additional info

        let headerArrayBuffer = await readFile(file.slice(0, 16), 'arraybuffer');
        let headerView = new DataView(headerArrayBuffer);

        let magic = headerView.getUint32(0, true);
        if (magic !== 541806659) throw new Error('Not a CPK file');

        let headerSize = headerView.getUint32(8, true);

        let utfs = parseTag(await readFile(file.slice(0, headerSize + 32), 'arraybuffer'), 'CPK ');
        if (!utfs || utfs.length !== 1) throw new Error('UTFs invalid or missing?');
        
        const cpk: any = { info: null, htoc: null, toc: null, etoc: null };
        cpk.info = utfs[0];
        let offset, size;
        // HTOC
        offset = (Number)(cpk.info.HtocOffset);
        size = (Number)(cpk.info.HtocSize);
        if (offset && size) cpk.htoc = parseTag(await readFile(file.slice(offset, offset + size), 'arraybuffer'), 'HTOC');
        // TOC
        offset = (Number)(cpk.info.TocOffset);
        size = (Number)(cpk.info.TocSize);
        if (offset && size) cpk.toc = parseTag(await readFile(file.slice(offset, offset + size), 'arraybuffer'), 'TOC ');
        // ETOC
        offset = (Number)(cpk.info.EtocOffset);
        size = (Number)(cpk.info.EtocSize);
        if (offset && size) cpk.etoc = parseTag(await readFile(file.slice(offset, offset + size), 'arraybuffer'), 'ETOC');
        
        if (!cpk) throw new Error('Could not complete parse step');

        const cpkFile = new CPK(name, file instanceof File ? file : undefined);

        for (let i = 0; i < cpk.toc.length; i++) {
            const item = cpk.toc[i];
            const offset = (Number)(cpk.info.TocOffset + item.FileOffset);
            cpkFile.files.push(
                new CPKFile(
                    cpkFile,
                    (item.DirName ? item.DirName + "/" : "") + item.FileName,
                    item.FileName.split(".").pop(),
                    offset,
                    item.FileSize
                )
            );
        }

        return cpkFile;
    }

    /**
     * Repacks the PKZ file into an ArrayBuffer.
     */
    async repack() {
        // coming soon
        return false;
    }
}