import { ZstdInit } from '@oneidentity/zstd-js';
import { decompressUnsafe as decompressOOZ } from 'ooz-wasm';

import { concatArrayBuffer, setArrayBuffer } from "../../tools/arrayBufferTools";
import generateDATHash from "../../tools/generateDATHash";
import readFile from "../../tools/readFile";
import toString from "../../tools/toString";
import PlatinumFile from '../Global/PlatinumFile';

let zstdDecompress: any = null;

export class PKZFile extends PlatinumFile {
    root: PKZ;
    ext: string;
    offset: number;
    size: number;
    compressedSize: number;
    compressionType: string;
    arrayBuffer?: ArrayBuffer;

    constructor(root: PKZ, name: string, ext: string, offset: number, size: number, compressedSize: number, compressionType: string) {
        super(name, size, true);
        
        this.root = root;
        this.offset = offset;
        this.size = size;
        this.compressedSize = compressedSize;
        this.ext = ext;
        this.compressionType = compressionType;
    }

    async read() {
        if (!this.root.root) throw new Error('No root file provided for this PKZ, so it can\'t be extracted.');
        
        let arrayBuffer: ArrayBuffer = await readFile(this.root.root.slice(this.offset, this.offset + this.compressedSize), 'arraybuffer');
        switch(this.compressionType) {
            case 'ZStandard':
                if (!zstdDecompress) {
                    let { ZstdStream } = await ZstdInit();
                    zstdDecompress = ZstdStream;
                }
                arrayBuffer = zstdDecompress.decompress(new Uint8Array(arrayBuffer)).buffer;
                break;
            case 'OodleKraken':
                arrayBuffer = (await decompressOOZ(new Uint8Array(arrayBuffer), this.size)).buffer;
                let bit32 = new Uint32Array(arrayBuffer);
                for (let i = 0; i < arrayBuffer.byteLength; i++) {
                    if (bit32[i] == 5521732) {
                        arrayBuffer = arrayBuffer.slice(i * 4);
                    }
                }
                break;
            case 'None':
                break;
            default:
                console.warn(`Unknown compression type: ${this.compressionType}`);
        }
        this.arrayBuffer = arrayBuffer;
        this.isPartial = false;
        return arrayBuffer;
    }

    async getArrayBuffer() {
        return await this.read();
    }
}
/**
 * PKZ files are Platinum Games' main compressed archive format.
 * The files inside a DAT are compressed, either in ZSTD (Astral Chain) or Oodle Kraken (Bayonetta).
 */
export default class PKZ extends PlatinumFile {
    root: File|null = null;
    files: PKZFile[] = [];

    constructor(name: string, size: number, file?: File) {
        super(name, size, false);
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
        let headerArrayBuffer: ArrayBuffer = file instanceof ArrayBuffer ? 
            file.slice(0, 32) :
            // @ts-ignore
            await readFile(file.slice(0, 32), 'arraybuffer');
        let headerDataView = new DataView(headerArrayBuffer);

        let header = {
            // magic: headerDataView.getUint32(0, true),
            // version: headerDataView.getUint32(4, true),
            size: headerDataView.getBigUint64(8, true),
            fileCount: headerDataView.getUint32(16, true),
            fileDescriptorsOffset: headerDataView.getUint32(20, true),
            fileNameTableLength: headerDataView.getUint32(24, true),
            // unknown: headerDataView.getUint32(28, true),
        }

        // @ts-ignore -- Load partial file data (name offset, size, offset, compressed size)
        let fileTable: ArrayBuffer = await readFile(file.slice(header.fileDescriptorsOffset, header.fileDescriptorsOffset + header.fileCount * 32), 'arraybuffer');
        let fileTableDataView = new DataView(fileTable);
        let partialFiles = [];

        for (let i = 0; i < header.fileCount; i++) {
            partialFiles.push(
                {
                    nameOffset: fileTableDataView.getUint32(i * 32, true),
                    compressionOffset: fileTableDataView.getUint32(i * 32 + 4, true),
                    size: fileTableDataView.getBigUint64(i * 32 + 8, true),
                    offset: fileTableDataView.getBigUint64(i * 32 + 16, true),
                    compressedSize: fileTableDataView.getBigUint64(i * 32 + 24, true),
                }
            );
        }

        // get file names and assign them
        let newOffset = header.fileDescriptorsOffset + header.fileCount * 32;
        // @ts-ignore
        let fileNames: string = await readFile(file.slice(newOffset, newOffset + Number(partialFiles[0].offset)), 'text')


        const pkz = new PKZ(name, 0, file as File);

        for (let i = 0; i < partialFiles.length; i++) {
            let fileName = fileNames.slice(partialFiles[i]['nameOffset']).split('\0')[0];

            let compressionType = fileNames.slice(partialFiles[i]['compressionOffset']).split('\0')[0];

            pkz.files.push(
                new PKZFile(
                    pkz,
                    fileName,
                    fileName.split('.')[1],
                    Number(partialFiles[i]['offset']), // offset
                    Number(partialFiles[i]['size']), // size
                    Number(partialFiles[i]['compressedSize']), // compressedSize
                    compressionType // extractionType
                )
            )
        }

        return pkz;
    }

    /**
     * Repacks the PKZ file into an ArrayBuffer.
     */
    static async repack() {
        // coming soon
        return false;
    }
}