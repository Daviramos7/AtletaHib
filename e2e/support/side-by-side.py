"""Junta os prints ANTES e DEPOIS lado a lado em evidence/ux-v3/comparativo/.

Uso (na raiz do projeto): python e2e/support/side-by-side.py
Só lê evidence/ux-v3/{before,after} e {before,after}-stress; não toca em nada fora dela.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path('evidence/ux-v3')
OUT = ROOT / 'comparativo'
GAP = 24
HEAD = 56
BG = (20, 24, 22)
FG = (235, 240, 236)


def font(size: int):
    for name in ('segoeuib.ttf', 'arialbd.ttf', 'DejaVuSans-Bold.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def pair(before: Path, after: Path, target: Path, title: str) -> None:
    a, b = Image.open(before).convert('RGB'), Image.open(after).convert('RGB')
    width = a.width + b.width + GAP * 3
    height = max(a.height, b.height) + HEAD + GAP
    canvas = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(canvas)
    big = font(22)
    draw.text((GAP, 14), f'ANTES · {title}', fill=FG, font=big)
    draw.text((a.width + GAP * 2, 14), f'DEPOIS · {title}', fill=(184, 255, 0), font=big)
    canvas.paste(a, (GAP, HEAD))
    canvas.paste(b, (a.width + GAP * 2, HEAD))
    target.parent.mkdir(parents=True, exist_ok=True)
    # Páginas muito altas: reduz para caber num visualizador comum sem perder a leitura.
    if canvas.height > 6000:
        ratio = 6000 / canvas.height
        canvas = canvas.resize((int(canvas.width * ratio), 6000), Image.LANCZOS)
    canvas.save(target, optimize=True)


def main() -> None:
    count = 0
    for phase_dir in ('', '-stress'):
        before_root, after_root = ROOT / f'before{phase_dir}', ROOT / f'after{phase_dir}'
        if not before_root.exists() or not after_root.exists():
            continue
        for before in sorted(before_root.rglob('*.png')):
            rel = before.relative_to(before_root)
            after = after_root / rel
            if not after.exists() or before.stem.endswith('-expandido'):
                continue
            case = rel.parent.as_posix()
            title = f'{case}{"" if phase_dir else " px"} · {before.stem}'
            pair(before, after, OUT / f'{case}{"" if phase_dir else "px"}-{before.stem}.png', title)
            count += 1
    print(f'{count} comparativos em {OUT}')


if __name__ == '__main__':
    main()
