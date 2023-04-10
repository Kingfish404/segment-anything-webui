import io
import click
import torch
import numpy as np
import uvicorn

from fastapi import FastAPI, File, Form
from pydantic import BaseModel
from typing import Sequence
from segment_anything import SamPredictor, SamAutomaticMaskGenerator, sam_model_registry
from PIL import Image
from typing_extensions import Annotated


@click.command()
@click.option('--model',
              default='vit_b',
              help='model name',
              type=click.Choice(['vit_b', 'vit_l', 'vit_h']))
@click.option('--model_path', default='model/sam_vit_b_01ec64.pth', help='model path')
@click.option('--port', default=8000, help='port')
@click.option('--host', default='0.0.0.0', help='host')
def main(
        model="vit_b",
        model_path="model/sam_vit_b_01ec64.pth",
        port=8000,
        host="0.0.0.0",
):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("device:", device)

    build_sam = sam_model_registry[model]
    model = build_sam(checkpoint=model_path).to(device)
    predictor = SamPredictor(model)
    mask_generator = SamAutomaticMaskGenerator(model)

    app = FastAPI()

    @app.get('/')
    def index():
        return {"code": 0, "data": "Hello World"}

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

    def compress_mask(mask: np.ndarray):
        flat_mask = mask.ravel()
        idx = np.flatnonzero(np.diff(flat_mask))
        idx = np.concatenate(([0], idx+1, [len(flat_mask)]))
        counts = np.diff(idx)
        values = flat_mask[idx[:-1]]
        compressed = ''.join(
            [f"{c}{'T' if v else 'F'}" for c, v in zip(counts, values)])
        return compressed

    @app.post('/api/point')
    async def points(
            file: Annotated[bytes, File()],
            points: Annotated[str, Form(...)],
    ):
        ps = Points.parse_raw(points)
        input_points = np.array([[p.x, p.y] for p in ps.points])
        input_labels = np.array(ps.points_labels)
        image_data = Image.open(io.BytesIO(file))
        image_data = np.array(image_data)
        predictor.set_image(image_data)
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
    async def box(
        file: Annotated[bytes, File()],
        box: Annotated[str, Form(...)],
    ):
        b = Box.parse_raw(box)
        input_box = np.array([b.x1, b.y1, b.x2, b.y2])
        center_point = np.array([[(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2]])
        center_label = np.array([1])
        image_data = Image.open(io.BytesIO(file))
        image_data = np.array(image_data)
        predictor.set_image(image_data)
        masks, scores, logits = predictor.predict(
            point_coords=center_point,
            point_labels=center_label,
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
    async def everything(file: Annotated[bytes, File()]):
        image_data = Image.open(io.BytesIO(file))
        image_data = np.array(image_data)
        masks = mask_generator.generate(image_data)
        for mask in masks:
            mask['segmentation'] = compress_mask(mask['segmentation'])
        arg_idx = np.argsort([mask['stability_score']
                              for mask in masks])[::-1].tolist()
        masks = [masks[i] for i in arg_idx]
        return {"code": 0, "data": masks[:]}
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
