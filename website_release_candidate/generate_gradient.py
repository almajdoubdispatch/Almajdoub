import sys
from pathlib import Path
from PIL import Image

def create_teal_gradient(width=800, height=200, teal='#76D2E0'):
    # Convert hex to RGB
    teal_rgb = tuple(int(teal[i:i+2], 16) for i in (1, 3, 5))
    img = Image.new('RGBA', (width, height))
    for y in range(height):
        alpha = int(255 * (1 - y / height))  # top opaque, bottom transparent
        for x in range(width):
            img.putpixel((x, y), (*teal_rgb, alpha))
    return img

out_path = Path('C:/Users/MSI/Downloads/Dispatch work/website_release_candidate/assets/img/teal-gradient-overlay.png')
out_path.parent.mkdir(parents=True, exist_ok=True)
img = create_teal_gradient()
img.save(out_path)
print(f'Gradient PNG saved to {out_path}')
