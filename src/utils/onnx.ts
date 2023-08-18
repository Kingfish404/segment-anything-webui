'use strict';
import { Tensor } from "onnxruntime-web";

export const inferData = ({ clicks, tensor, modelScale }: any) => {
    const imageEmbedding = tensor;
    let pointCoords;
    let pointLabels;
    let pointCoordsTensor;
    let pointLabelsTensor;

    if (clicks) {
        let n = clicks.length;

        pointCoords = new Float32Array(2 * (n + 1));
        pointLabels = new Float32Array(n + 1);

        for (let i = 0; i < n; i++) {
            pointCoords[2 * i] = clicks[i].x * modelScale.samScale;
            pointCoords[2 * i + 1] = clicks[i].y * modelScale.samScale;
            pointLabels[i] = clicks[i].label;
        }

        pointCoords[2 * n] = 0.0;
        pointCoords[2 * n + 1] = 0.0;
        pointLabels[n] = -1.0;

        pointCoordsTensor = new Tensor("float32", pointCoords, [1, n + 1, 2]);
        pointLabelsTensor = new Tensor("float32", pointLabels, [1, n + 1]);
    }
    const imageSizeTensor = new Tensor("float32", [
        modelScale.height,
        modelScale.width,
    ]);

    if (pointCoordsTensor === undefined || pointLabelsTensor === undefined)
        return;

    // There is no previous mask, so default to an empty tensor
    const maskInput = new Tensor(
        "float32",
        new Float32Array(256 * 256),
        [1, 1, 256, 256]
    );
    const hasMaskInput = new Tensor("float32", [0]);

    return {
        image_embeddings: imageEmbedding,
        point_coords: pointCoordsTensor,
        point_labels: pointLabelsTensor,
        orig_im_size: imageSizeTensor,
        mask_input: maskInput,
        has_mask_input: hasMaskInput,
    };
};

export const arrayToImageData = (input: any, width: number, height: number) => {
    const [r, g, b, a] = [0, 114, 189, 128];
    const arr = new Uint8ClampedArray(4 * width * height).fill(0);
    for (let i = 0; i < input.length; i++) {

        if (input[i] > 0.0) {
            arr[4 * i + 0] = r;
            arr[4 * i + 1] = g;
            arr[4 * i + 2] = b;
            arr[4 * i + 3] = a;
        }
    }
    return new ImageData(arr, height, width);
}

export const imageDataToCanvas = (imageData: ImageData) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx?.putImageData(imageData, 0, 0);
    return canvas;
}