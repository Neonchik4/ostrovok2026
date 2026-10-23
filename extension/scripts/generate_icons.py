import os
from PIL import Image, ImageDraw

def draw_ghost(size: int) -> Image.Image:
    # 4x supersampling for ultra-crisp antialiasing
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = int(s * 0.08)
    left = pad
    right = s - pad
    top = pad
    bottom = s - pad
    width = right - left
    height = bottom - top

    # Outline and fill colors
    blue = (22, 82, 240, 255)  # Ostrovok Brand Blue #1652F0
    white = (255, 255, 255, 255)
    black = (17, 24, 39, 255)
    border_w = max(2, int(scale * size * 0.07))

    # Points for ghost body with 3 scallops at bottom
    # Dome top from left to right
    r = width // 2
    cx = left + r
    cy = top + r

    # We will draw a filled polygon / arcs
    # Let's create an alpha mask
    mask = Image.new("L", (s, s), 0)
    mask_draw = ImageDraw.Draw(mask)

    # Dome
    mask_draw.pieslice([left, top, right, top + width], 180, 0, fill=255)
    # Body sides
    mask_draw.rectangle([left, cy, right, bottom - int(height * 0.18)], fill=255)

    # Scallops at the bottom (3 waves)
    scallop_w = width / 3.0
    scallop_h = int(height * 0.18)
    scallop_y = bottom - scallop_h

    for i in range(3):
        x0 = left + i * scallop_w
        x1 = x0 + scallop_w
        # draw bottom arc
        mask_draw.pieslice([x0, scallop_y - scallop_h, x1, scallop_y + scallop_h], 0, 180, fill=255)

    # Fill base ghost white
    ghost_layer = Image.new("RGBA", (s, s), white)
    img.paste(ghost_layer, (0, 0), mask)

    # Draw Blue Outline around the mask
    # We can stroke the path
    # Outer dome
    draw.arc([left, top, right, top + width], 180, 0, fill=blue, width=border_w)
    # Left & Right edges
    y_start = cy
    y_end = scallop_y
    draw.line([left + border_w // 2, y_start, left + border_w // 2, y_end], fill=blue, width=border_w)
    draw.line([right - border_w // 2, y_start, right - border_w // 2, y_end], fill=blue, width=border_w)

    # Bottom scallops outline
    for i in range(3):
        x0 = left + i * scallop_w
        x1 = x0 + scallop_w
        draw.arc([x0, scallop_y - scallop_h, x1, scallop_y + scallop_h], 0, 180, fill=blue, width=border_w)

    # Cute Expressive Eyes (Left: circle with catchlight, Right: winking or matching circle)
    eye_y = top + int(height * 0.42)
    eye_r = max(2, int(width * 0.09))
    left_eye_x = left + int(width * 0.35)
    right_eye_x = left + int(width * 0.65)

    # Left eye (round)
    draw.ellipse([left_eye_x - eye_r, eye_y - eye_r, left_eye_x + eye_r, eye_y + eye_r], fill=black)
    # Catchlight
    cl_r = max(1, int(eye_r * 0.35))
    draw.ellipse([left_eye_x - eye_r // 2 - cl_r, eye_y - eye_r // 2 - cl_r, left_eye_x - eye_r // 2 + cl_r, eye_y - eye_r // 2 + cl_r], fill=white)

    # Right eye (winking playful arc ">" or matching cute eye)
    # Cute wink: line >
    draw.line([right_eye_x - eye_r, eye_y - eye_r // 2, right_eye_x + eye_r, eye_y], fill=black, width=max(2, int(border_w * 0.8)))
    draw.line([right_eye_x + eye_r, eye_y, right_eye_x - eye_r, eye_y + eye_r // 2], fill=black, width=max(2, int(border_w * 0.8)))

    # Cute subtle blush under left eye (pastel pink/coral)
    blush_color = (255, 150, 170, 160)
    blush_rx = max(2, int(width * 0.08))
    blush_ry = max(1, int(height * 0.04))
    draw.ellipse([left_eye_x - blush_rx, eye_y + eye_r + 2, left_eye_x + blush_rx, eye_y + eye_r + 2 + blush_ry * 2], fill=blush_color)
    draw.ellipse([right_eye_x - blush_rx, eye_y + eye_r + 2, right_eye_x + blush_rx, eye_y + eye_r + 2 + blush_ry * 2], fill=blush_color)

    # Downscale with high-quality Lanczos resampling
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

def main():
    icons_dir = os.path.join(os.path.dirname(__file__), "..", "icons")
    os.makedirs(icons_dir, exist_ok=True)

    for sz in [16, 48, 128]:
        out_path = os.path.join(icons_dir, f"icon{sz}.png")
        img = draw_ghost(sz)
        img.save(out_path, "PNG")
        print(f"Generated {out_path} ({sz}x{sz})")

if __name__ == "__main__":
    main()
