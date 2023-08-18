import io
import os
import click
from fastapi.responses import FileResponse
import torch
import numpy as np
import uvicorn
import clip

import export_onnx_model
from fastapi import FastAPI, File, Form
from pydantic import BaseModel
from typing import Sequence, Callable
from segment_anything import SamPredictor, SamAutomaticMaskGenerator, sam_model_registry
from PIL import Image
from typing_extensions import Annotated
from threading import Lock


class Point(BaseModel):
    x: int
    y: int


class Points(BaseModel):
    points: Sequence[Point]
    points_labels: Sequence[int]


class Box(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int


class TextPrompt(BaseModel):
    text: str


def segment_image(image_array: np.ndarray, segmentation_mask: np.ndarray):
    segmented_image = np.zeros_like(image_array)
    segmented_image[segmentation_mask] = image_array[segmentation_mask]
    return segmented_image


def retrieve(
    elements: Sequence[np.ndarray],
    search_text: str,
    preprocess: Callable[[Image.Image], torch.Tensor],
    model, device=torch.device('cpu')
) -> torch.Tensor:
    with torch.no_grad():
        preprocessed_images = [preprocess(Image.fromarray(
            image)).to(device) for image in elements]
        tokenized_text = clip.tokenize([search_text]).to(device)
        stacked_images = torch.stack(preprocessed_images)
        image_features = model.encode_image(stacked_images)
        text_features = model.encode_text(tokenized_text)
        image_features /= image_features.norm(dim=-1, keepdim=True)
        text_features /= text_features.norm(dim=-1, keepdim=True)
        probs = (100.0 * image_features @ text_features.T)
    return probs[:, 0].softmax(dim=-1)


@click.command()
@click.option('--model',
              default='vit_b',
              help='model name',
              type=click.Choice(['vit_b', 'vit_l', 'vit_h']))
@click.option('--model_path', default='model/sam_vit_b_01ec64.pth', help='model path')
@click.option('--port', default=8000, help='port')
@click.option('--host', default='0.0.0.0', help='host')
def main(model, model_path, port, host, ):
    device = torch.device("cpu")
    try:
        if torch.backends.mps.is_available():
            device = torch.device("mps")
    except:
        device = torch.device("cpu")
    device = torch.device("cuda") if torch.cuda.is_available() else device
    print("device:", device)

    build_sam = sam_model_registry[model]
    sam = build_sam(checkpoint=model_path).to(device)
    onnx_model_path = model_path.replace('.pth', '.onnx')
    if not os.path.exists(onnx_model_path):
        export_onnx_model.export(sam, onnx_model_path)
    predictor = SamPredictor(sam)
    mask_generator = SamAutomaticMaskGenerator(sam)
    sam_model_lock = Lock()

    clip_model, preprocess = clip.load("ViT-B/16", device=device)

    app = FastAPI()

    @app.get('/')
    def index():
        return {"code": 0, "data": "Hello World"}

    @app.get('/sam_vit.onnx')
    def forward_onnx():
        return FileResponse(onnx_model_path)

    def compress_mask(mask: np.ndarray):
        flat_mask = mask.ravel()
        idx = np.flatnonzero(np.diff(flat_mask))
        idx = np.concatenate(([0], idx + 1, [len(flat_mask)]))
        counts = np.diff(idx)
        values = flat_mask[idx[:-1]]
        compressed = ''.join(
            [f"{c}{'T' if v else 'F'}" for c, v in zip(counts, values)])
        return compressed

    @app.post('/api/point')
    async def api_points(
            file: Annotated[bytes, File()],
            points: Annotated[str, Form(...)],
    ):
        ps = Points.parse_raw(points)
        input_points = np.array([[p.x, p.y] for p in ps.points])
        input_labels = np.array(ps.points_labels)
        image_data = Image.open(io.BytesIO(file))
        image_array = np.array(image_data)
        with sam_model_lock:
            predictor.set_image(image_array)
            masks, scores, logits = predictor.predict(
                point_coords=input_points,
                point_labels=input_labels,
                multimask_output=True,
            )
            predictor.reset_image()
        masks = [
            {
                "segmentation": compress_mask(np.array(mask)),
                "stability_score": float(scores[idx]),
                "bbox": [0, 0, 0, 0],
                "area": np.sum(mask).item(),
            }
            for idx, mask in enumerate(masks)
        ]
        masks = sorted(masks, key=lambda x: x['stability_score'], reverse=True)
        return {"code": 0, "data": masks[:]}

    @app.post('/api/box')
    async def api_box(
        file: Annotated[bytes, File()],
        box: Annotated[str, Form(...)],
    ):
        b = Box.parse_raw(box)
        input_box = np.array([b.x1, b.y1, b.x2, b.y2])
        image_data = Image.open(io.BytesIO(file))
        image_array = np.array(image_data)
        with sam_model_lock:
            predictor.set_image(image_array)
            masks, scores, logits = predictor.predict(
                box=input_box,
                multimask_output=False,
            )
            predictor.reset_image()
        masks = [
            {
                "segmentation": compress_mask(np.array(mask)),
                "stability_score": float(scores[idx]),
                "bbox": [0, 0, 0, 0],
                "area": np.sum(mask).item(),
            }
            for idx, mask in enumerate(masks)
        ]
        masks = sorted(masks, key=lambda x: x['stability_score'], reverse=True)
        return {"code": 0, "data": masks[:]}

    @app.post('/api/everything')
    async def api_everything(file: Annotated[bytes, File()]):
        image_data = Image.open(io.BytesIO(file))
        image_array = np.array(image_data)
        masks = mask_generator.generate(image_array)
        arg_idx = np.argsort([mask['stability_score']
                              for mask in masks])[::-1].tolist()
        masks = [masks[i] for i in arg_idx]
        for mask in masks:
            mask['segmentation'] = compress_mask(mask['segmentation'])
        return {"code": 0, "data": masks[:]}

    @app.post('/api/clip')
    async def api_clip(
            file: Annotated[bytes, File()],
            prompt: Annotated[str, Form(...)],
    ):
        text_prompt = TextPrompt.parse_raw(prompt)
        image_data = Image.open(io.BytesIO(file))
        image_array = np.array(image_data)
        masks = mask_generator.generate(image_array)
        cropped_boxes = []
        for mask in masks:
            bobx = [int(x) for x in mask['bbox']]
            cropped_boxes.append(segment_image(image_array, mask["segmentation"])[
                bobx[1]:bobx[1] + bobx[3], bobx[0]:bobx[0] + bobx[2]])
        scores = retrieve(cropped_boxes, text_prompt.text,
                          model=clip_model, preprocess=preprocess, device=device)
        top = scores.topk(5)
        masks = [masks[i] for i in top.indices]
        for mask in masks:
            mask['segmentation'] = compress_mask(mask['segmentation'])
        return {"code": 0, "data": masks[:]}

    @app.post('/api/embedding')
    async def api_embedding(
        file: Annotated[bytes, File()],
    ):
        image_data = Image.open(io.BytesIO(file))
        image_array = np.array(image_data)
        with sam_model_lock:
            predictor.set_image(image_array)
            image_embedding = predictor.get_image_embedding()
            predictor.reset_image()
        print(image_embedding.shape)
        return {"code": 0, "data": image_embedding.tolist()}

    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
