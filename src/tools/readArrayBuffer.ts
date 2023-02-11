const fileReader = new FileReader();

type TypeName = 'text' | 'arraybuffer' | 'dataurl' | 'binarystring';

type FileType<T> =
    T extends 'text' ? string :
    T extends 'dataurl' ? string :
    T extends 'binarystring' ? string :
    never;

/**
 * Reads a file and returns its contents.
 * @param file The arrayBuffer to read.
 * @returns the stringified file content.
 */
export default function readArrayBuffer(arrayBuffer: ArrayBuffer, encoding: string): string {
    let textDecoder = new TextDecoder(encoding);
    return textDecoder.decode(arrayBuffer);
}