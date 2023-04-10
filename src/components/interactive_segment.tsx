import { useState, useEffect, useRef } from 'react'

export type Point = { x: number, y: number, label: number }
export type Mask = { bbox: Array<number>, segmentation: string, area: number }
export type Data = { width: number, height: number, file: File, img: HTMLImageElement }


const hash = (x: number) => {
    x = (x ^ 61) ^ (x >> 16)
    x = x + (x << 3)
    x = x ^ (x >> 4)
    x = x * 0x27d4eb2d
    x = x ^ (x >> 15)
    return x
}

function getRGB(idx: number) {
    const r = (hash(idx) & 0xFF)
    const g = (hash(idx >> 8) & 0xFF)
    const b = (hash(idx >> 16) & 0xFF)
    return [r, g, b]
}

function decompress(compressed_mask: string, width: number, height: number) {
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

export function InteractiveSegment(
    { data, mode, points, setPoints, masks, setBoxReady }:
        {
            data: Data,
            mode: 'click' | 'box' | 'everything',
            points: Point[],
            masks: Mask[],
            setPoints: (points: Point[]) => void,
            setBoxReady: (ready: boolean) => void
        }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [scale, setScale] = useState<number>(1)
    const [maskAreaThreshold, setMaskAreaThreshold] = useState<number>(0.5)
    const { width, height, img } = data
    const [segments, setSegments] = useState<number[][][]>([])
    const [showSegment, setShowSegment] = useState<boolean>(true)

    useEffect(() => {
        const adapterSize = () => {
            const canvas = canvasRef.current as HTMLCanvasElement
            const parent = canvas.parentElement
            const scale = Math.min(
                parent?.clientWidth! / img.width, parent?.clientHeight! / img.height)
            setScale(scale)
        }
        window.onresize = adapterSize;
        adapterSize();
    }, [img])

    useEffect(() => {
        setSegments(masks.map(mask => decompress(mask.segmentation, width, height)))
    }, [height, masks, width])

    useEffect(() => {
        const canvas = canvasRef.current as HTMLCanvasElement
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.globalAlpha = 1
        ctx.drawImage(img, 0, 0)

        switch (mode) {
            case 'click':
                break
            case 'box':
                if (points.length === 2) {
                    const x = Math.min(points[0].x, points[1].x)
                    const y = Math.min(points[0].y, points[1].y)
                    const w = Math.abs(points[0].x - points[1].x)
                    const h = Math.abs(points[0].y - points[1].y)
                    ctx.beginPath()
                    ctx.globalAlpha = 0.9
                    ctx.rect(x, y, w, h)
                    ctx.strokeStyle = 'rgba(0 ,0 ,0 , 0.9)'
                    ctx.lineWidth = 2
                    ctx.stroke()
                    ctx.closePath()
                }
                break
            case 'everything':
                break
        }

        if (!showSegment) {
            return
        }

        const rgbas = masks.map((_, i) => [...getRGB(i), 0.5])
        if (masks.length > 0) {
            ctx.beginPath()
            for (let i = 0; i < masks.length; i++) {
                const mask = masks[i]
                if (mask.area / (width * height) > maskAreaThreshold) {
                    continue
                }
                const rgba = rgbas[i]
                const bbox = mask.bbox
                ctx.setLineDash([5, 5])
                ctx.rect((bbox[0]), (bbox[1]), (bbox[2]), (bbox[3]))
                ctx.strokeStyle = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]})`
                ctx.lineWidth = 2
                ctx.globalAlpha = 0.9
                ctx.stroke()
            }
            ctx.closePath()
        }

        if (segments.length > 0) {
            ctx.beginPath()
            ctx.setLineDash([0])
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            for (let i = 0; i < masks.length; i++) {
                const mask = masks[i]
                if (mask.area / (width * height) > maskAreaThreshold) {
                    continue
                }
                const segmentation = segments[i]
                const rgba = rgbas[i]
                const opacity = rgba[3]
                for (let y = 0; y < canvas.height; y++) {
                    if (segmentation[y].length === 0) {
                        continue
                    }
                    for (let x of segmentation[y]) {
                        const index = (y * canvas.width + x) * 4;
                        imageData.data[index] = imageData.data[index] * opacity + rgba[0] * (1 - opacity);
                        imageData.data[index + 1] = imageData.data[index + 1] * opacity + rgba[1] * (1 - opacity);
                        imageData.data[index + 2] = imageData.data[index + 2] * opacity + rgba[2] * (1 - opacity);
                    }
                }
            }
            ctx.putImageData(imageData, 0, 0);
            ctx.closePath()
        }

        if (points.length > 0) {
            ctx.globalAlpha = 0.9
            for (let i = 0; i < points.length; i++) {
                const point = points[i]
                ctx.beginPath()
                ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI)
                if (point.label === 1) {
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.9)'
                } else {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.9)'
                }
                ctx.fill()
                ctx.closePath()
            }
        }
    }, [height, img, maskAreaThreshold, masks, mode, points, segments, showSegment, width])

    return (
        <div className="flex flex-col max-w-[1080px] "
            tabIndex={0}
            onKeyDown={(e) => { if (e.ctrlKey) { setShowSegment(false) } }}
            onKeyUpCapture={(e) => {
                if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
                    setShowSegment(true)
                }
            }}
        >
            <div className="flax justify-between w-full my-2">
                <label className="inline-block text-sm font-medium text-gray-700">
                    Mask Area Threshold:
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={maskAreaThreshold}
                        onChange={(e) => setMaskAreaThreshold(parseFloat(e.target.value))}
                        className="h-2 bg-gray-300 rounded-md inline-block"
                    />
                    <span className="text-sm font-normal min-w-[20px] inline-block mx-2">
                        {Math.round(maskAreaThreshold * 100)} %
                    </span>
                </label>
                <label className="inline-block text-sm font-medium text-gray-700">
                    Show Mask (Ctrl to change):
                    <input
                        type="checkbox"
                        checked={showSegment}
                        onChange={(e) => setShowSegment(e.target.checked)}
                        className="ml-2"
                    />
                </label>
            </div>
            <canvas
                className="w-3/4 sm:w-full" ref={canvasRef} width={width} height={height}
                onContextMenu={(e) => {
                    e.preventDefault()
                    const canvas = canvasRef.current as HTMLCanvasElement
                    const rect = canvas.getBoundingClientRect()
                    const x = (e.clientX - rect.left) / scale
                    const y = (e.clientY - rect.top) / scale
                    switch (mode) {
                        case 'click':
                            setPoints([...points, { x, y, label: 0 }])
                            break
                    }
                }}
                onClick={(e) => {
                    e.preventDefault()
                    const canvas = canvasRef.current as HTMLCanvasElement
                    const rect = canvas.getBoundingClientRect()
                    const x = (e.clientX - rect.left) / scale
                    const y = (e.clientY - rect.top) / scale
                    switch (mode) {
                        case 'click':
                            setPoints([...points, { x, y, label: 1 }])
                            break
                    }
                }}
                onMouseMove={(e) => {
                    if (mode !== 'box') return
                    const canvas = canvasRef.current as HTMLCanvasElement
                    const rect = canvas.getBoundingClientRect()
                    const x = (e.clientX - rect.left) / scale
                    const y = (e.clientY - rect.top) / scale
                    if (e.buttons === 0 && points.length <= 1) {
                        setPoints([{ x, y, label: 1 }])
                    } else if (e.buttons === 1 && points.length >= 1) {
                        setBoxReady(false)
                        setPoints([points[0], { x, y, label: 1 }])
                    }
                }}
                onMouseUp={(e) => {
                    if (mode !== 'box') return
                    setBoxReady(true)
                }}
            />
        </div>
    )
}