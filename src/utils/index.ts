export * as config from './config';
export * from './onnx';

export function hash(x: number) {
    x = (x ^ 61) ^ (x >> 16)
    x = x + (x << 3)
    x = x ^ (x >> 4)
    x = x * 0x27d4eb2d
    x = x ^ (x >> 15)
    return x
}

export function getRGB(idx: number) {
    const r = (hash(idx) & 0xFF)
    const g = (hash(idx >> 8) & 0xFF)
    const b = (hash(idx >> 16) & 0xFF)
    return [r, g, b]
}

export function decompress(compressed_mask: string, width: number, height: number) {
    const pairs: [number, number][] = [];
    let count_str = '';
    for (const char of compressed_mask) {
        if (/\d/.test(char)) {
            count_str += char;
        } else {
            pairs.push([parseInt(count_str), char === 'T' ? 1 : 0]);
            count_str = '';
        }
    }
    const mask = new Array(height).fill(0).map(() => new Array(width).fill(0));
    let x = 0, y = 0;
    for (const [count, value] of pairs) {
        for (let i = 0; i < count; i++) {
            mask[y][x] = value;
            x++;
            if (x === width) {
                x = 0;
                y++;
            }
        }
    }
    // above mask is a 2d mask, convert it to index mask for better performance
    for (let i = 0; i < height; i++) {
        let sum = mask[i].reduce((a, b) => a + b, 0)
        if (sum === 0) {
            mask[i] = []
        } else {
            let indexs = mask[i].map((v, i) => v === 1 ? i : -1).filter(v => v !== -1)
            mask[i] = indexs
        }
    }
    return mask;
}