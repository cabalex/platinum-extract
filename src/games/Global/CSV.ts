import readArrayBuffer from "../../tools/readArrayBuffer";
import readFile from "../../tools/readFile";
import PlatinumFile from "./PlatinumFile";
import Encoding from 'encoding-japanese';


/**
 * CSV (Comma-Separated Values) are files that contain a comma-separated table.
 * While not necessary to extract (as they are text files), it can be useful
 * for navigation and extraction, as usually the text is encoded in SHIFT-JIS.
 */
export default class CSV extends PlatinumFile {
    data: Array<string[]> = [];

    toString() {
        return this.data.map(line => line.join(",")).join("\r\n");
    }

    fromString(text: string) {
        if (text.includes("\r\n")) {
            text = text.replace(/\r\n/g, "\n");
        }
        this.data = text.split("\n").map(line => line.split(","));
    }

    async getArrayBuffer() {
        return await this.repack();
    }
    
    constructor(name: string, data: string, arrayBuffer?: ArrayBuffer) {
        super(name, data.length, false);
        this.fromString(data);
    }

    async repack() : Promise<ArrayBuffer> {
        return new Promise((resolve) => {
            let string = this.data.map(line => line.join(",")).join("\r\n");
            let returnarr = Encoding.stringToCode(string);
            let returning = Encoding.convert(returnarr, {
                to: 'SJIS', // to_encoding
                from: 'AUTO' // from_encoding
            });
            resolve(Uint8Array.from(returning).buffer);
        })
    }

    static async extract(fileBuffer: ArrayBuffer|File, name: string) {
        return new CSV(name, await readFile(fileBuffer, 'text', 'SHIFT-JIS') as string);
    }
}