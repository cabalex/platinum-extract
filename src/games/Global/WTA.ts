import readFile from "../../tools/readFile";
import { addDDSHeader, loadDDS } from "../AstralChain/tools/DDS";
import { loadImageData } from "../AstralChain/tools/tegrax1swizzle";
import PlatinumFile from "./PlatinumFile";

const surfaceTypes = [
    'T_1D', 'T_2D', 'T_3D',
    'T_Cube',
    'T_1D_Array', 'TD_2D_Array', 'T_2D_Multisample', 'T_2D_Multisample_Array',
    'T_Cube_Array'
];

const textureFormats = {
    // DDS
    0x25: "R8G8B8A8_UNORM",
    
    0x42: "BC1_UNORM",
    0x43: "BC2_UNORM",
    0x44: "BC3_UNORM",
    0x45: "BC4_UNORM",
    0x46: "BC1_UNORM_SRGB",
    0x47: "BC2_UNORM_SRGB",
    0x48: "BC3_UNORM_SRGB",
    0x49: "BC4_SNORM",
    0x50: "BC6H_UF16",
    // ASTC (weird texture formats ??)
    0x2D: "ASTC_4x4_UNORM",
    0x38: "ASTC_8x8_UNORM",
    0x3A: "ASTC_12x12_UNORM",
    // ASTC
    0x79: "ASTC_4x4_UNORM",
    0x80: "ASTC_8x8_UNORM",
    0x87: "ASTC_4x4_SRGB",
    0x8E: "ASTC_8x8_SRGB"
}

export class WTATexture {
    identifier = "0";
    offset = 0;
    size = 0;
    unknownArrayValue = 0;

    // --- WTA Texture Header ---
    magic = 3232856;
    // unknown: number;
    imageSize = 0;
    headerSize = 0;
    mipCount = 1;
    type = 0x44;
    format = 0x1;
    width = 1;
    height = 1;
    depth = 1;
    // unknown4: number;
    textureLayout = 0;
    textureLayout2 = 0;
    arrayCount = 1;

    constructor(identifier: number, wtpOffset: number, wtpSize: number, unknownArrayValue: number) {
        this.identifier = identifier.toString(16);
        this.offset = wtpOffset;
        this.size = wtpSize;
        this.unknownArrayValue = unknownArrayValue;
    }

    get _format() {
        // @ts-ignore
        return textureFormats[this.format];
    }
    get _type() {
        return surfaceTypes[this.type];
    }

    /**
     * Extracts a texture from a WTA DataView.
     * @param view  DataView of the file.
     * @param offset Offset of the texture.
     * @param wtpOffset Offset of the texture in the WTP.
     * @param wtpSize Size of the texture in the WTP.
     * @param identifier Identifier of the texture.
     * @param unknownArrayValue Unknown value.
     * @returns [texture, offset]
     */
    static extract(
        view: DataView,
        offset: number,
        wtpOffset: number,
        wtpSize: number,
        identifier: number,
        unknownArrayValue: number
    ) : [WTATexture, number] {
        let magic = view.getUint32(offset, true);

        let texture = new WTATexture(identifier, wtpOffset, wtpSize, unknownArrayValue);
        switch(magic) {
            case 3232856: // XT1\x00 (Astral Chain)
                texture.magic = magic;
                // texture.unknown = view.getUint32(offset + 4, true);
                texture.imageSize = view.getUint32(offset + 8, true);
                texture.headerSize = view.getUint32(offset + 16, true);
                texture.mipCount = view.getUint32(offset + 20, true);
                texture.type = view.getUint32(offset + 24, true);
                texture.format = view.getUint32(offset + 28, true);
                texture.width = view.getUint32(offset + 32, true);
                texture.height = view.getUint32(offset + 36, true);
                texture.depth = view.getUint32(offset + 40, true);
                // texture.unknown4 = view.getUint32(offset + 44, true);
                texture.textureLayout = view.getUint32(offset + 48, true);
                // texture.textureLayout2 = view.getUint32(offset + 52, true);

                if (["T_Cube", "T_Cube_Array"].includes(texture._type)) {
                    texture.arrayCount = 6;
                };

                console.log(offset + 20, view.getUint32(offset + 20, true), texture._type);
                
                return [texture, offset + 56];
            case 2019914798: // .tex (NieR Automata Switch)
                texture.magic = magic;
                console.warn("Not supported: NieR Automata Switch textures")
                break;
            default:
                console.warn("Unknown texture magic: " + magic);
        }
        return [texture, offset + 0x100]
    }

    load(wtpTexture: ArrayBuffer) {
        // deswizzle
        let blockHeightLog2 = this.textureLayout & 7;
        let wtpImageData = loadImageData(
            this._format,
            this.width,
            this.height,
            this.depth,
            this.arrayCount,
            this.mipCount,
            wtpTexture.slice(this.offset, this.offset + this.size),
            blockHeightLog2
        );

        if (wtpImageData === false || wtpImageData.byteLength === 0)
            throw new Error("Texture swizzling error: returned blank array");

        let canvas;
        if (this._format.includes('ASTC')) {
            // ASTC
            console.warn('ASTC not supported')
            canvas = document.createElement('canvas');
            canvas.width = this.width;
            canvas.height = this.height;
            let ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.font = '24px Arial';
                ctx.fillStyle = 'white';
                ctx.fillText('ASTC Not supported.', 10, 50);
            }
        } else {
            // DDS
            canvas = loadDDS(this._format, this.width, this.height, this.depth, wtpImageData);
        }

        return canvas;
    }

    /**
     * Returns an ArrayBuffer of the texture as a file.
     */
    download(wtpTexture: ArrayBuffer) {
        let blockHeightLog2 = this.textureLayout & 7;
        let wtpImageData = loadImageData(
            this._format,
            this.width,
            this.height,
            this.depth,
            this.arrayCount,
            this.mipCount,
            wtpTexture.slice(this.offset, this.offset + this.size),
            blockHeightLog2
        );

        if (wtpImageData === false || wtpImageData.byteLength === 0)
            throw new Error("Texture swizzling error: returned blank array");

        let canvas;
        if (this._format.includes('ASTC')) {
            // ASTC
            console.warn('ASTC not supported')
            return new ArrayBuffer(0);
        } else {
            // DDS
            return addDDSHeader(this._format, this.width, this.height, this.depth, wtpImageData);
        }
    }
}

/**
 * WTA files are the games' main texture formats.
 */
export default class WTA extends PlatinumFile {
    textures: WTATexture[] = [];
    name: string;

    constructor(name: string, textures: WTATexture[], arrayBuffer: ArrayBuffer) {
        super(name, arrayBuffer.byteLength, false);
        this.name = name;
        this.textures = textures;
        this.arrayBuffer = arrayBuffer;
    }

    /**
     * Extracts a WTA file from an ArrayBuffer.
     * @param arrayBuffer The array buffer of the WTA file.
     * @returns the WTA object.
     */
    static async extract(fileBuffer: ArrayBuffer|File, name: string) {
        let arrayBuffer = fileBuffer instanceof File ? await readFile(fileBuffer, 'arraybuffer') : fileBuffer;
        const view = new DataView(arrayBuffer);

        const header = {
            magic: view.getUint32(0, true),
            unk: view.getUint32(4, true),
            textureCount: view.getUint32(8, true),
            textureOffsetArrayOffset: view.getUint32(12, true),
            textureSizeArrayOffset: view.getUint32(16, true),
            unkArrayOffset1: view.getUint32(20, true),
            textureIdentifierArrayOffset: view.getUint32(24, true),
            unkArrayOffset2: view.getUint32(28, true)
        };

        let textures = [];
        let offset = header.unkArrayOffset2;
        for (var i = 0; i < header.textureCount; i++) {
            
            let [texture, newOffset] = WTATexture.extract(
                view,
                offset,
                view.getUint32(header.textureOffsetArrayOffset + i*4, true),
                view.getUint32(header.textureSizeArrayOffset + i*4, true),
                view.getUint32(header.textureIdentifierArrayOffset + i*4, true),
                view.getUint32(header.unkArrayOffset1 + i*4, true)
            )
            textures.push(texture);
            offset = newOffset;
        }

        const wtaFile = new WTA(name, textures, arrayBuffer);

        return wtaFile;
    }

    /**
     * Repacks the WTA file.
     */
    async repack() {
        return new ArrayBuffer(0);
    }
}