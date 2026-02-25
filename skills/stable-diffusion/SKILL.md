---
name: stable-diffusion
description: Generate images via Stable Diffusion REST API. Use when user wants to create images from text prompts. Endpoint: POST http://192.168.1.33:7860/sdapi/v1/txt2img
---

# Stable Diffusion

Generate images from text prompts using the local Stable Diffusion instance.

## API Call

```bash
curl -X POST http://192.168.1.33:7860/sdapi/v1/txt2img \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "{your prompt here}",
    "steps": 20,
    "width": {your width here},
    "height": {your height here},
    "save_images": false
  }'
```

## Parameters

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| prompt | string | required | Text description of desired image |
| steps | integer | 20 | More steps = higher quality but slower |
| width | integer | required | Image width (multiple of 8) |
| height | integer | required | Image height (multiple of 8) |
| save_images | boolean | false | Set true to save on server |

## Response

Returns JSON with `images` array containing base64-encoded PNGs. Extract and decode to view.

## Example: Save image to file

```bash
# Extract first image from response and save
curl -s -X POST http://192.168.1.33:7860/sdapi/v1/txt2img \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a cat sitting on a couch", "steps": 20, "width": 720, "height": 480, "save_images": false}' \
  | jq -r '.images[0]' | base64 -d > cat.png
```

## Notes

- Host: 192.168.1.33:7860
- Model: Automatic1111 SD webui API
- Returns base64 by default (save_images: false)
