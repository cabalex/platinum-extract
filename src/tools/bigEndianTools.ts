
export function swap32(val: number) {
    return ((val & 0xFF) << 24)
        | ((val & 0xFF00) << 8)
        | ((val >> 8) & 0xFF00)
        | ((val >> 24) & 0xFF);
}

export function swapUint32Array(array: Uint32Array) {
    for (let i = 0; i < array.length; i++) {
        array[i] = swap32(array[i]);
    }
    return array;
}