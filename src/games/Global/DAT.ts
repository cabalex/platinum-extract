import { concatArrayBuffer, setArrayBuffer } from "../../tools/arrayBufferTools";
import { swap32, swapUint32Array } from "../../tools/bigEndianTools";
import generateDATHash from "../../tools/generateDATHash";
import readFile from "../../tools/readFile";
import resolveFile from "../../tools/resolveFile";
import toString from "../../tools/toString";
import PlatinumFile from "./PlatinumFile";

class DATFile extends PlatinumFile {
    root: DAT;
    name: string;
    ext: string;
    offset: number;
    size: number;
    arrayBuffer: ArrayBuffer;

    constructor(root: DAT, name: string, ext: string, offset: number, size: number, arrayBuffer: ArrayBuffer) {
        super(name, size, true);
        
        this.root = root;
        this.name = name;
        this.offset = offset;
        this.size = size;
        this.ext = ext;
        this.arrayBuffer = arrayBuffer;

        if (!this.root.littleEndian) {
            // literally swap around every byte
            let array = new Uint32Array(this.arrayBuffer);
            for (let i = 0; i < array.length; i++) {
                array[i] = swap32(array[i]);
            }
            this.arrayBuffer = array.buffer;
        }
    }

    async read() {
        return this.arrayBuffer    
    }
}
/**
 * DAT files are Platinum Games' main archive format (almost like a ZIP folder).
 * The files inside a DAT are not compressed.
 */
export default class DAT extends PlatinumFile {
    files: any[] = [];
    name: string;
    littleEndian: boolean = true;

    constructor(name: string) {
        super(name, 64, false);
        this.name = name;
    }

    /**
     * Extracts a DAT file from an ArrayBuffer.
     * @param arrayBuffer The array buffer of the DAT file.
     * @returns the DAT object.
     */
    static async extract(fileBuffer: ArrayBuffer|File, name: string) {
        let arrayBuffer = await readFile(fileBuffer, 'arraybuffer');
        const view = new DataView(arrayBuffer);

        const datFile = new DAT(name);
        datFile.size = arrayBuffer.byteLength;
        //datFile.original = arrayBuffer;

        let fileCount = view.getUint32(4, true);

        if (fileCount > 100000) {
            // This is a big endian DAT file.
            datFile.littleEndian = false;
            fileCount = view.getUint32(4, false);
        }
        const fileOffsetsTableOffset = view.getUint32(8, datFile.littleEndian);
        const fileExtTableOffset = view.getUint32(12, datFile.littleEndian);
        const fileNameTableOffset = view.getUint32(16, datFile.littleEndian);
        const fileSizeTableOffset = view.getUint32(20, datFile.littleEndian);
        //const hashMapOffset = view.getUint32(24, true);

        const fileOffsetsTable = new Uint32Array(
            arrayBuffer.slice(
                fileOffsetsTableOffset,
                fileOffsetsTableOffset + fileCount * 4
                )
            );
        
        const fileExtTable = toString(
            arrayBuffer.slice(
                fileExtTableOffset,
                fileExtTableOffset + fileCount * 4
                )
            )
            .split("\0")
            .filter((x) => x.length > 0)
        
        const fileSizesTable = new Uint32Array(
            arrayBuffer.slice(
                fileSizeTableOffset,
                fileSizeTableOffset + fileCount * 4
                )
            );

        const fileNameLength = view.getUint32(fileNameTableOffset, datFile.littleEndian);

        const fileNameTable = toString(
            arrayBuffer.slice(
                fileNameTableOffset + 4,
                fileNameTableOffset + 4 + fileNameLength * fileCount
                )
            )
            .split("\0")
            .filter((x) => x.length > 0);
        
        if (!datFile.littleEndian) {
            // switch endianness
            swapUint32Array(fileOffsetsTable);
            swapUint32Array(fileSizesTable);
        }
        
        // --- Hash table does not need to be stored (see hashing function shamelessly copied from B2N)

        for (let i = 0; i < fileCount; i++) {
            const name = fileNameTable[i];
            const ext = fileExtTable[i];
            const offset = fileOffsetsTable[i];
            const size = fileSizesTable[i];

            let type = resolveFile(name);
            let file = await type.extract(arrayBuffer.slice(offset, offset + size), name)?.catch(() => {});
            datFile.files.push(file ||
                new DATFile(
                    datFile,
                    name,
                    ext,
                    offset,
                    size,
                    arrayBuffer.slice(offset, offset + size)
                )
            );
        }

        return datFile;
    }

    /**
     * Repacks the DAT file into an ArrayBuffer.
     */
    static async repack(files: {name: string, arrayBuffer: ArrayBuffer}[], datType: 'DAT'|'DTT' = 'DAT', game?: 'astral-chain'|'nier-automata-switch') {
        const textEncoder = new TextEncoder();

        // --- Generate Hash Map
        const hashMap = generateDATHash(files);
        // --- Generate File Extensions (do some sanity checks)
        const fileExtTable = textEncoder.encode(
            files.map((x) => {
                let ext = x.name.split(".").pop() || "";
                return ext + new Array(4 - ext.length).fill('\0').join('')
            }).join('')
            ).buffer;
        // --- Generate File Names
        const nameLength = files.map((x) => x.name.length + 1).reduce((a, b) => Math.max(a, b));
        let fileNameStr = ""
        for (let i = 0; i < files.length; i++) {
            fileNameStr += files[i].name;
            fileNameStr += new Array(nameLength - files[i].name.length).fill('\0').join('');
        }
        const fileNameTable = concatArrayBuffer(Uint32Array.from([nameLength]).buffer, textEncoder.encode(fileNameStr).buffer);
        // --- Generate File Sizes
        const fileSizeTable = Uint32Array.from(files.map((x) => x.arrayBuffer.byteLength)).buffer;

        // --- Compute size of the new DAT file
        const headerSize =
            32 +                            // header
            files.length * 4 +         // file offsets table
            fileExtTable.byteLength +       // file extensions table
            fileNameTable.byteLength +      // file names table
            files.length * 4 +         // file sizes table
            hashMap.byteLength              // hash map

        // --- Generate File Offsets
        const fileOffsets32Array = new Uint32Array(files.length);
        let fileOffset = headerSize;
        for (let i = 0; i < files.length; i++) {
            fileOffset = Math.ceil(fileOffset / 16) * 16;
            fileOffsets32Array[i] = files[i].arrayBuffer.byteLength === 0 ? 0 : fileOffset;
            fileOffset += files[i].arrayBuffer.byteLength;
        }
        const fileOffsetsTable = fileOffsets32Array.buffer;

        // --- Create array buffer
        let arrayBuffer = new ArrayBuffer(fileOffsets32Array[fileOffsets32Array.length - 1] + files[files.length - 1].arrayBuffer.byteLength); // header only
        const view = new DataView(arrayBuffer);

        // --- Header
        view.setUint32(0, 5521732, true); // "DAT\0"
        view.setUint32(4, files.length, true); // fileCount
        view.setUint32(8, 32, true); // fileOffsetsOffset
        view.setUint32(12, 32 + files.length * 4, true); // fileExtOffset
        view.setUint32(16, 32 + files.length * 4 + fileExtTable.byteLength, true); // fileNameOffset
        view.setUint32(20, 32 + files.length * 4 + fileExtTable.byteLength + fileNameTable.byteLength, true); // fileSizeOffset
        view.setUint32(24, 32 + files.length * 4 + fileExtTable.byteLength + fileNameTable.byteLength + files.length * 4, true); // hashMapOffset

        arrayBuffer = setArrayBuffer(arrayBuffer, fileOffsetsTable, 32);
        arrayBuffer = setArrayBuffer(arrayBuffer, fileExtTable, 32 + files.length * 4);
        arrayBuffer = setArrayBuffer(arrayBuffer, fileNameTable, 32 + files.length * 4 + fileExtTable.byteLength);
        arrayBuffer = setArrayBuffer(arrayBuffer, fileSizeTable, 32 + files.length * 4 + fileExtTable.byteLength + fileNameTable.byteLength);
        arrayBuffer = setArrayBuffer(arrayBuffer, hashMap, 32 + files.length * 4 + fileExtTable.byteLength + fileNameTable.byteLength + files.length * 4);

        // --- Files
        for (let i = 0; i < files.length; i++) {
            arrayBuffer = setArrayBuffer(arrayBuffer, files[i].arrayBuffer, fileOffsets32Array[i]);
        }

        return arrayBuffer;
    }
}