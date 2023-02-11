import readFile from "../../tools/readFile";
import PlatinumFile from "./PlatinumFile";

enum TextureData {

}
/**
 * WTA files are the games' main texture formats.
 */
export default class WTA extends PlatinumFile {
    textures: TextureData[] = [];
    name: string;

    constructor(name: string) {
        super(name, 0, false);
        this.name = name;
    }

    /**
     * Extracts a DAT file from an ArrayBuffer.
     * @param arrayBuffer The array buffer of the DAT file.
     * @returns the DAT object.
     */
    static async extract(fileBuffer: ArrayBuffer|File, name: string) {
        let arrayBuffer = fileBuffer instanceof File ? await readFile(fileBuffer, 'arraybuffer') : fileBuffer;
        const view = new DataView(arrayBuffer);

        const wtaFile = new WTA(name);

        const wta = new WTA(name);
        return wta;
    }

    /**
     * Repacks the WTA file.
     */
    async repack() {
        return new ArrayBuffer(0);
    }
}