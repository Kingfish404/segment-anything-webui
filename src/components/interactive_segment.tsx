import { useState, useEffect, useRef } from 'react'
import * as utils from '@/utils';


export type Point = { x: number, y: number, label: number }
export type Mask = { bbox: Array<number>, segmentation: string, area: number }
export type Data = { width: number, height: number, file: File, img: HTMLImageElement }


export function InteractiveSegment(
    { data, processing, mode, points, setPoints, masks, ready, setBoxReady, maskImage,
        scale, setScale,
    }:
        {
            data: Data,
            processing: boolean,
            mode: 'click' | 'box' | 'everything' | 'embedding',
            points: Point[],
            masks: Mask[],
            ready: boolean,
            setPoints: (points: Point[]) => void,
            setBoxReady: (ready: boolean) => void,
            maskImage: ImageData | null,
            scale: number,
            setScale: (scale: number) => void,
        }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const canvasMaskRef = useRef<HTMLCanvasElement>(null)
    const [maskAreaThreshold, setMaskAreaThreshold] = useState<number>(0.5)
    const { width, height, img } = data
    const [segments, setSegments] = useState<number[][][]>([])
    const [showSegment, setShowSegment] = useState<boolean>(true)

    useEffect(() => {
        const adapterSize = () => {
            const canvas = canvasRef.current as HTMLCanvasElement
            if (!canvas) return
            const parent = canvas.parentElement
            const scale = Math.min(
                parent?.clientWidth! / img.width, parent?.clientHeight! / img.height)
            setScale(scale)
        }
        window.onresize = adapterSize;
        adapterSize();
    }, [img])

    useEffect(() => {
        setSegments(masks.map(mask => utils.decompress(mask.segmentation, width, height)))
    }, [masks, height, width])

    useEffect(() => {
        const canvas = canvasRef.current as HTMLCanvasElement
        const canvasMask = canvasMaskRef.current as HTMLCanvasElement
        const ctx = canvas.getContext('2d')
        const ctxMask = canvasMask.getContext('2d')
        if (!ctx) return
        if (!ctxMask) return
        ctx.globalAlpha = 1
        ctx.drawImage(img, 0, 0)

        switch (mode) {
            case 'click': { }
                break
            case 'box': {
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
            }
                break
            case 'everything': { }
                break
            case 'embedding': {
                ctxMask.clearRect(0, 0, canvasMask.width, canvasMask.height);

                if (maskImage) {
                    const canvas = utils.imageDataToCanvas(maskImage);
                    const yscale = 1.2  // TODO: fix this magic number
                    ctx.scale(1, yscale)
                    ctxMask.scale(1, yscale)

                    ctx.drawImage(canvas, 0, 0);
                    ctxMask.drawImage(canvas, 0, 0);

                    ctxMask.scale(1, 1 / yscale)
                    ctx.scale(1, 1 / yscale)
                }
            }
                break
        }

        if (!showSegment) {
            return
        }

        const rgbas = masks.map((_, i) => [...utils.getRGB(i), 0.5])
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
            const imageDataMask = ctxMask.getImageData(0, 0, canvasMask.width, canvasMask.height)
            imageDataMask.data.fill(255)
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
                        imageDataMask.data[index] = opacity
                        imageDataMask.data[index + 1] = opacity
                        imageDataMask.data[index + 2] = opacity
                    }
                }
            }
            ctx.putImageData(imageData, 0, 0);
            ctxMask.putImageData(imageDataMask, 0, 0);
            ctx.closePath()
            ctxMask.closePath()
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
    }, [height, img, maskAreaThreshold, maskImage, masks, mode, points, segments, showSegment, width])

    const handleDownload = () => {
        const canvas = canvasMaskRef.current as HTMLCanvasElement;
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'mask.png';
        link.click();
        link.remove();
    }

    return (
        <div
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
                        className="mx-2"
                    />
                </label>
                <label className="inline-block text-sm font-medium text-gray-700">
                    <button onClick={handleDownload}
                        className='border-2 border-gray-300 rounded-md px-2 text-gray-700 hover:bg-gray-50'
                    >Download Mask</button>
                </label>
            </div>
            <canvas
                className="w-full" ref={canvasRef} width={width} height={height}
                onContextMenu={(e) => {
                    e.preventDefault()
                    if (processing) return
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
                    if (processing) return
                    const canvas = canvasRef.current as HTMLCanvasElement
                    const rect = canvas.getBoundingClientRect()
                    const x = (e.clientX - rect.left) / scale
                    const y = (e.clientY - rect.top) / scale
                    switch (mode) {
                        case 'click':
                            setPoints([...points, { x, y, label: 1 }])
                            break
                        case 'embedding':
                            setPoints([{ x, y, label: 1 }])
                            break
                    }
                }}
                onMouseMove={(e) => {
                    if (processing) return
                    switch (mode) {
                        case 'box':
                            const canvas = canvasRef.current as HTMLCanvasElement
                            const rect = canvas.getBoundingClientRect()
                            const x = (e.clientX - rect.left) / scale
                            const y = (e.clientY - rect.top) / scale
                            if (e.buttons === 0 && !ready) {
                                setPoints([{ x, y, label: 1 }])
                            } else if (e.buttons === 1 && points.length >= 1) {
                                setBoxReady(false)
                                setPoints([points[0], { x, y, label: 1 }])
                            }
                            break
                    }
                }}
                onMouseUp={(e) => {
                    if (mode !== 'box' || processing) return
                    setBoxReady(true)
                }}
            />
            <canvas
                className="w-full mt-1" ref={canvasMaskRef} width={width} height={height}
            />
        </div>
    )
}