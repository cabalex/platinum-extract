
const textDecoder = new TextDecoder();

export default function toString(arrayBuffer: ArrayBuffer) {
    return textDecoder.decode(arrayBuffer);
}