
export default class PlatinumFile {
    name: string;
    size: number;
    original?: ArrayBuffer|File;
    isPartial: boolean;
    arrayBuffer?: ArrayBuffer;

    constructor(name: string, size: number, isPartial: boolean) {
        this.name = name;
        this.size = size;
        this.isPartial = isPartial;
    }

    async getArrayBuffer() {
        return this.arrayBuffer || new ArrayBuffer(this.size);
    }
}