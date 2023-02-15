import readFile from "../../tools/readFile";
import PlatinumFile from "./PlatinumFile";

export default class WTP extends PlatinumFile {
    name: string;
    arrayBuffer: ArrayBuffer;

    constructor(name: string, arrayBuffer: ArrayBuffer) {
        super(name, arrayBuffer.byteLength, false);
        this.name = name;
        this.arrayBuffer = arrayBuffer;
    }

    /**
     * Extracts a WTP file from an ArrayBuffer.
     * @param arrayBuffer The array buffer of the WTP file.
     * @returns the WTP object.
     */
    static async extract(fileBuffer: ArrayBuffer|File, name: string) {
        let arrayBuffer = await readFile(fileBuffer, 'arraybuffer');

        return new WTP(name, arrayBuffer);
    }
}