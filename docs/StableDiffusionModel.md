# Stable Diffusion Model & Sampler Decision Specification
VERSION: 1.0
PURPOSE: Deterministic selection of model and sampler for image generation

---

## INPUT

The system receives:

- prompt (string)
- steps (integer, optional)
- width (integer)
- height (integer)

---

## OUTPUT

The system MUST return:

{
  "model": string,
  "sampler": string,
  "steps": integer,
  "width": integer,
  "height": integer
}

---

## AVAILABLE MODELS

### MODEL_A: JuggernautXL
TYPE: stylized / cinematic

CHARACTERISTICS:
- strong lighting contrast
- cinematic composition
- stylized environments
- emotional / atmospheric scenes

USE WHEN:
- prompt emphasizes mood, atmosphere, or artistic style
- scene is not strictly realistic

---

### MODEL_B: RealVisXL
TYPE: photorealistic

CHARACTERISTICS:
- natural lighting
- realistic textures
- photography-like output

USE WHEN:
- prompt describes real-world environments
- realism is preferred over stylization

---

## PROMPT CLASSIFICATION

### CLASS: STYLIZED

A prompt is STYLIZED if it contains ANY of:

- cinematic
- dreamy
- mystical
- glowing
- lantern
- temple
- zen
- meditation
- cherry blossom
- fantasy
- ethereal
- fireflies
- atmospheric
- fog (when used artistically)

---

### CLASS: REALISTIC

A prompt is REALISTIC if it contains ANY of:

- beach
- ocean
- mountain
- lake
- forest
- river
- rain
- snow
- city
- cafe
- street
- landscape
- photorealistic
- nature

---

## MODEL SELECTION RULES

### RULE 1

IF prompt matches STYLIZED:
    model = JuggernautXL

ELSE:
    model = RealVisXL

---

### RULE 2 (CONFLICT RESOLUTION)

IF prompt contains BOTH stylized AND realistic indicators:

    IF prompt contains ANY of:
        cinematic, glowing, lantern, mystical, fantasy

        model = JuggernautXL

    ELSE:
        model = RealVisXL

---

## SAMPLER OPTIONS

- DPM++ 2M
- DPM++ 2M Karras
- DPM++ SDE Karras
- Euler a

---

## SAMPLER CHARACTERISTICS

### DPM++ 2M
- stable
- fast
- consistent
- moderate quality

### DPM++ 2M Karras
- higher detail
- smoother lighting
- best general-purpose choice

### DPM++ SDE Karras
- highest realism
- smooth gradients
- slower
- best for photorealistic scenes

### Euler a
- more variation
- more artistic randomness
- less stable
- best for stylized outputs

---

## SAMPLER SELECTION RULES

### RULE 3 (BASE)

IF no special condition:
    sampler = DPM++ 2M Karras

---

### RULE 4 (STYLIZED MODEL)

IF model == JuggernautXL:

    IF prompt contains ANY of:
        dreamy, fantasy, mystical, ethereal

        sampler = Euler a

    ELSE:
        sampler = DPM++ 2M Karras

---

### RULE 5 (REALISTIC MODEL)

IF model == RealVisXL:

    IF prompt contains ANY of:
        photorealistic, ultra realistic, highly detailed

        sampler = DPM++ SDE Karras

    ELSE:
        sampler = DPM++ 2M Karras

---

## STEP RULES

### RULE 6

IF steps is NOT provided:
    steps = 20

---

### RULE 7

IF steps < 20:
    sampler = DPM++ 2M Karras

---

### RULE 8

IF steps >= 25 AND model == RealVisXL:
    sampler = DPM++ SDE Karras

---

## RESOLUTION RULES

### RULE 9

IF multiple sampler rules apply:

PRIORITY ORDER:

1. SDE Karras
2. Euler a
3. 2M Karras
4. 2M

---

## FINAL OUTPUT RULE

RETURN:

{
  "model": selected_model,
  "sampler": selected_sampler,
  "steps": steps,
  "width": width,
  "height": height
}

---

## EXAMPLES

### EXAMPLE 1

INPUT:
"cherry blossom garden with glowing lanterns and soft fog"

OUTPUT:
{
  "model": "JuggernautXL",
  "sampler": "DPM++ 2M Karras",
  "steps": 20,
  "width": 1920,
  "height": 1080
}

---

### EXAMPLE 2

INPUT:
"calm mountain lake at sunrise"

OUTPUT:
{
  "model": "RealVisXL",
  "sampler": "DPM++ 2M Karras",
  "steps": 20,
  "width": 1920,
  "height": 1080
}

---

### EXAMPLE 3

INPUT:
"dreamy fantasy forest with glowing fireflies"

OUTPUT:
{
  "model": "JuggernautXL",
  "sampler": "Euler a",
  "steps": 20,
  "width": 1920,
  "height": 1080
}

---

### EXAMPLE 4

INPUT:
"ultra realistic rainy city street at night"

OUTPUT:
{
  "model": "RealVisXL",
  "sampler": "DPM++ SDE Karras",
  "steps": 20,
  "width": 1920,
  "height": 1080
}

---

## DEFAULT FALLBACK

IF classification fails:

{
  "model": "RealVisXL",
  "sampler": "DPM++ 2M Karras",
  "steps": 20,
  "width": 1920,
  "height": 1080
