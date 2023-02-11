import { concatArrayBuffer, setArrayBuffer } from "../../tools/arrayBufferTools";
import generateDATHash from "../../tools/generateDATHash";
import readArrayBuffer from "../../tools/readArrayBuffer";
import readFile from "../../tools/readFile";
import toString from "../../tools/toString";
import PlatinumFile from '../Global/PlatinumFile';

let zstdDecompress: any = null;

async function slice(data: ArrayBuffer|File|Blob, start: number, end?: number) : Promise<ArrayBuffer> {
    // @ts-ignore
    return data instanceof ArrayBuffer ?
        data.slice(start, end) :
        await readFile(data.slice(start, end), 'arraybuffer')
}

function swap32(val: number) {
    return ((val & 0xFF) << 24)
           | ((val & 0xFF00) << 8)
           | ((val >> 8) & 0xFF00)
           | ((val >> 24) & 0xFF);
}


export class CPKFile extends PlatinumFile {
    root: CPK;
    ext: string;
    offset: number;
    size: number;
    compressedSize: number;
    compressionType: string;
    arrayBuffer?: ArrayBuffer;

    constructor(root: CPK, name: string, ext: string, offset: number, size: number, compressedSize: number, compressionType: string) {
        super(name, compressedSize, true);
        
        this.root = root;
        this.offset = offset;
        this.size = size;
        this.compressedSize = compressedSize;
        this.ext = ext;
        this.compressionType = compressionType;
    }

    async read() {
        // @ts-ignore
        let arrayBuffer: ArrayBuffer = await readFile(this.root.root.slice(this.offset, this.offset + this.compressedSize), 'arraybuffer');
        /*switch(this.compressionType) {
            case 'ZStandard':
                if (!zstdDecompress) {
                    let { ZstdStream } = await ZstdInit();
                    zstdDecompress = ZstdStream;
                }
                arrayBuffer = zstdDecompress.decompress(new Uint8Array(arrayBuffer)).buffer;
                break;
            case 'OodleKraken':
                arrayBuffer = (await decompressOOZ(new Uint8Array(arrayBuffer), this.size)).buffer;
                break;
            case 'None':
                break;
            default:
                console.warn(`Unknown compression type: ${this.compressionType}`);
        }
        this.arrayBuffer = arrayBuffer;
        this.isPartial = false;*/
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
        let headerArrayBuffer: ArrayBuffer = file instanceof ArrayBuffer ? 
            file.slice(0, 32) :
            // @ts-ignore
            await readFile(file.slice(0, 60), 'arraybuffer') as ArrayBuffer;
        let headerDataView = new DataView(headerArrayBuffer);

        let header = {
            // magic: headerDataView.getUint32(0, true), // "CPK "
            flags: headerDataView.getUint32(4, true),
            tableLength: headerDataView.getUint32(8, true),
            // unk: headerDataView.getUint32(12, true),
            // magic: headerDataView.getUint32(16, true), // "@UTF"
            length: headerDataView.getUint32(20, false),
            // unk: headerDataView.getUint8(24, false),
            encodingType: headerDataView.getUint8(25) === 0 ? 'utf-8' : 'shift-jis',
            rowsPosition: headerDataView.getUint16(26, false),
            stringPoolPosition: headerDataView.getUint32(28, false),
            dataPoolPosition: headerDataView.getUint32(32, false),
            tableNamePosition: headerDataView.getUint32(36, false),
            fieldCount: headerDataView.getUint16(40, false),
            rowLength: headerDataView.getUint16(42, false),
            rowCount: headerDataView.getUint32(44, false),
            //fileCount: headerDataView.getUint32(48, false),
            //fileDescriptorsOffset: headerDataView.getUint32(52, false),
            //fileNameTableLength: headerDataView.getUint32(56, false),
        }

        const textDecoder = new TextDecoder(header.encodingType);

        async function readTypeMask(mask: number, offset: number): Promise<any> {//Promise<[number, any]> {
            switch(mask) {
                case 0: // Uint8
                    return [1, {
                        type: 'defaultValue',
                        kind: 'uint8',
                        value: new Uint8Array(await slice(file, offset + 1, offset + 1))[0]
                    }]
                case 1: // Int8
                    return [1, {
                        type: 'defaultValue',
                        kind: 'int8',
                        value: new Int8Array(await slice(file, offset, offset + 1))[0]
                    }]
                case 2: // Uint16
                    return [2, {
                        type: 'defaultValue',
                        kind: 'uint16',
                        value: new Uint16Array(await slice(file, offset, offset + 2))[0]
                    }]
                case 3: // Int16
                    return [2, {
                        type: 'defaultValue',
                        kind: 'int16',
                        value: new Int16Array(await slice(file, offset, offset + 2))[0]
                    }]
                case 4: // Uint32
                    return [4, {
                        type: 'defaultValue',
                        kind: 'uint32',
                        value: new Uint32Array(await slice(file, offset, offset + 4))[0]
                    }]
                case 5: // Int32
                    return [4, {
                        type: 'defaultValue',
                        kind: 'int32',
                        value: new Int32Array(await slice(file, offset, offset + 4))[0]
                    }]
                case 6: // Uint64
                    return [8, {
                        type: 'defaultValue',
                        kind: 'uint64',
                        value: new BigUint64Array(await slice(file, offset, offset + 8))[0]
                    }]
                case 7: // Int64
                    return [8, {
                        type: 'defaultValue',
                        kind: 'int64',
                        value: new BigInt64Array(await slice(file, offset, offset + 8))[0]
                    }]
                case 8: // Float
                    return [4, {
                        type: 'defaultValue',
                        kind: 'float',
                        value: new Float32Array(await slice(file, offset, offset + 4))[0]
                    }]
                case 9: // Double
                    return [2, {
                        type: 'defaultValue',
                        kind: 'double',
                        value: new Float64Array(await slice(file, offset, offset + 8))[0]
                    }]
                case 10: // String
                    let nameOffset = new Uint32Array(await slice(file, offset + 1, offset + 5))[0];

                    return [4, {
                        type: 'defaultValue',
                        kind: 'string',
                        value: textDecoder.decode(await slice(file, 48 + 8 + header.stringPoolPosition + nameOffset, 48 + 8 + header.stringPoolPosition + nameOffset + 64)).split('\0')[0]
                    }]
                case 11: // Data
                    return [8, {
                        type: 'defaultValue',
                        kind: 'data',
                        position: new Uint32Array(await slice(file, offset, offset + 4))[0],
                        size: new Uint32Array(await slice(file, offset + 4, offset + 8))[0]
                    }]
                case 12: // Guid
                    return [2, {
                        type: 'defaultValue',
                        kind: 'guid',
                        value: textDecoder.decode(await slice(file, offset, offset + 16))
                    }]
            }
        }

        let rows = [];
        let offset = 48;
        for (let i = 0; i < header.rowCount; i++) {
            let fields = [];

            for (let i = 0; i < header.fieldCount; i++) {
                let flags = new Uint8Array(await slice(file, offset, offset + 1))[0];
                
                if (flags & 0x10) {
                    // Name field
                    let nameOffset = swap32(new Uint32Array(await slice(file, offset + 1, offset + 5))[0]);

                    fields.push({
                        type: 'name',
                        name: textDecoder.decode(await slice(file, header.stringPoolPosition + nameOffset, 48 + header.stringPoolPosition + nameOffset + 64)).split('\0')[0]
                    })

                    offset += 5;
                } else if (flags & 0x20) {
                    // Default value
                    let [length, result] = await readTypeMask(flags & 0xF, offset + 4);
                    fields.push(result)

                    offset += 1 + length;
                } else if (flags & 0x40) {
                    // rowStorage
                    let [length, result] = await readTypeMask(flags & 0xF, offset + 4);
                    fields.push(result)

                    offset += 1 + length;
                } else {
                    console.warn("Unsupported field 0x" + flags.toString(16))
                }
            }

            rows.push(fields);
        }
        console.log(rows);

        const cpk = new CPK(name, file as File);
        return cpk;

        // @ts-ignore -- Load partial file data (name offset, size, offset, compressed size)
        /*let fileTable: ArrayBuffer = await readFile(file.slice(header.fileDescriptorsOffset, header.fileDescriptorsOffset + header.fileCount * 32), 'arraybuffer');
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


        const cpk = new CPK(name, file as File);

        for (let i = 0; i < partialFiles.length; i++) {
            let fileName = fileNames.slice(partialFiles[i]['nameOffset']).split('\0')[0];

            let compressionType = fileNames.slice(partialFiles[i]['compressionOffset']).split('\0')[0];

            cpk.files.push(
                new CPKFile(
                    cpk,
                    fileName,
                    fileName.split('.')[1],
                    Number(partialFiles[i]['offset']), // offset
                    Number(partialFiles[i]['size']), // size
                    Number(partialFiles[i]['compressedSize']), // compressedSize
                    compressionType // extractionType
                )
            )
        }

        return cpk;*/
    }

    /**
     * Repacks the PKZ file into an ArrayBuffer.
     */
    async repack() {
        // coming soon
        return false;
    }
}