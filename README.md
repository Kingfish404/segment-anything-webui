# Segment Anything web UI

![demo](./assets/demo.gif)

This is a web interface for the [Segment Anything](https://github.com/facebookresearch/segment-anything).

## Usage

1. Fowllow the instructions in the [Segment Anything](https://github.com/facebookresearch/segment-anything) to install

```shell
# e.g.
pip install git+https://github.com/facebookresearch/segment-anything.git
pip install opencv-python pycocotools matplotlib onnxruntime onnx

mkdir model
# download the model to `model/`
wget https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth -O model/sam_vit_b_01ec64.pth
# https://dl.fbaipublicfiles.com/segment_anything/sam_vit_l_0b3195.pth
# https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth
```

2. Install the webui dependencies:

```bash
# python server as backend
pip3 install torch numpy 'uvicorn[standard]' fastapi pydantic python-multipart Pillow 
# or 
cd script && pip3 install -r requirements.txt
# webui frontend
npm i
```

3. run the server:

```bash
python3 script/server.py
```

4. run the webui:

```bash
npm run dev
```

## Advanced

Change the `.env.local` file to change the server address.

The model server can be run on a remote GUI server, and the webui can be run on a local machine.

The API in `server.py` is **lambda function**. Though it is slow (Encoding Image Each Request), it is easy to deploy.

Upload Image on 

## TODO
- [ ] Add CLIP for text Prompt
- [ ] Pre extract image features
- [ ] Frontend onnx inference
- [ ] Better compress for mask matrix

## Reference

- [Segment Anything | Meta AI](https://segment-anything.com/)
- [facebookresearch/segment-anything: The repository provides code for running inference with the SegmentAnything Model (SAM), links for downloading the trained model checkpoints, and example notebooks that show how to use the model.](https://github.com/facebookresearch/segment-anything)

## License
MIT
