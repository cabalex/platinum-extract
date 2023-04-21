
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
        if (!this.arrayBuffer) console.warn("Attempting to grab ArrayBuffer of a file that doesn't have one or does not overwrite method... are you sure you wanted to do this?")

        return this.arrayBuffer || new ArrayBuffer(0);
    }
}