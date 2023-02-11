import readArrayBuffer from "./readArrayBuffer";

const fileReader = new FileReader();

type TypeName = 'text' | 'arraybuffer' | 'dataurl' | 'binarystring';

// i apparently don't know how to do this so it's not working lol
type FileType<T> =
    T extends 'text' ? string :
    T extends 'arraybuffer' ? ArrayBuffer :
    T extends 'dataurl' ? string :
    T extends 'binarystring' ? string :
    never;

/**
 * Reads a file and returns its contents.
 * @param file The file or blob to read.
 * @param readAs The type to return as (default arraybuffer).
 * @returns the file content in the form of readAs.
 */
async function readFile<T extends TypeName>(file: File|Blob|ArrayBuffer, readAs:T, encoding?:string): Promise<FileType<T>>
async function readFile(file: File|Blob|ArrayBuffer, readAs='arraybuffer', encoding="utf-8"): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        if (file instanceof ArrayBuffer) {
            switch(readAs) {
                case 'text':
                case 'binarystring':
                    // @ts-ignore
                    resolve(readArrayBuffer(file, encoding || "utf-8"));
                default:
                    // @ts-ignore
                    resolve(file);
            }
            return;
        }

        fileReader.onload = (e) => {
            // @ts-ignore -- hacky fix but it works
            resolve(e.target?.result || (readAs === 'text' ? '' : new ArrayBuffer(0)) as T);
        };
        fileReader.onerror = (e) => {
            reject(e);
        };

        switch(readAs) {
            case 'arraybuffer':
                fileReader.readAsArrayBuffer(file);
                break;
            case 'binarystring':
                fileReader.readAsBinaryString(file);
                break;
            case 'dataurl':
                fileReader.readAsDataURL(file);
                break;
            case 'text':
                fileReader.readAsText(file);
                break;
        }
    });
}

export default readFile;