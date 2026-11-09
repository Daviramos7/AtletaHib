"""Gera os ícones do PWA a partir do símbolo.

Uso (na raiz do projeto): python scripts/gerar-icones.py

Por que existe: os ícones antigos eram imagens pequenas esticadas (o maskable de 512 tinha
detalhe de ~128 px) e o próprio symbol-1024 tem borda em escadinha. Não há vetor do símbolo,
então o script reconstrói uma silhueta lisa: amplia o alfa 4x, suaviza e corta no meio do
degradê (some a escadinha), e desenha cada ícone em 4x o tamanho final antes de reduzir com
Lanczos (anti-aliasing de verdade em todo tamanho).

Tamanho do símbolo no maskable: o Android 12+ abre o PWA com o ícone maskable desenhado em
240dp e recortado num círculo de 160dp (os 66,7% centrais). O símbolo ocupa 48% da largura
do ícone, então cabe inteiro nesse círculo e na zona segura de qualquer máscara. A tela de
abertura do app (scripts/gerar-abertura.py) começa com o símbolo nesse tamanho: 0,48 x 240 = 115 px.
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'public' / 'icons' / 'atleta-hib-symbol-1024.png'
OUT = ROOT / 'public' / 'icons'
LIME = (184, 255, 0)          # --brand-lime
BACKGROUND = (7, 10, 9)       # manifest background_color / theme_color #070a09
SUPER = 4                     # desenha em 4x e reduz
MASKABLE_SYMBOL = 0.48        # largura do símbolo / largura do ícone maskable


def smooth_mask() -> Image.Image:
    """Silhueta lisa do símbolo, recortada justa, em 4x a resolução do arquivo-fonte."""
    alpha = Image.open(SOURCE).convert('RGBA').getchannel('A')
    big = alpha.resize((alpha.width * SUPER, alpha.height * SUPER), Image.BICUBIC)
    # O degrau da escadinha mede ~1px da fonte = 4px aqui; o desfoque o apaga e o corte em 50%
    # devolve uma borda nítida que segue a curva média.
    big = big.filter(ImageFilter.GaussianBlur(radius=SUPER * 1.6))
    big = big.point(lambda v: 255 if v >= 128 else 0)
    return big.crop(big.getbbox())


def render(mask: Image.Image, size: int, symbol_ratio: float, background) -> Image.Image:
    """Ícone quadrado `size` com o símbolo centrado ocupando `symbol_ratio` da largura."""
    canvas = size * SUPER
    width = round(canvas * symbol_ratio)
    height = round(mask.height * width / mask.width)
    shape = mask.resize((width, height), Image.LANCZOS)
    layer = Image.new('L', (canvas, canvas), 0)
    layer.paste(shape, ((canvas - width) // 2, (canvas - height) // 2))
    color = Image.new('RGBA', (canvas, canvas), LIME + (255,))
    if background is None:
        color.putalpha(layer)
        out = color
    else:
        out = Image.new('RGBA', (canvas, canvas), background + (255,))
        out.paste(color, (0, 0), layer)
    return out.resize((size, size), Image.LANCZOS)


def main() -> None:
    mask = smooth_mask()
    outputs = {
        'atleta-hib-any-192.png': render(mask, 192, 0.80, None),
        'atleta-hib-any-512.png': render(mask, 512, 0.80, None),
        'atleta-hib-maskable-192.png': render(mask, 192, MASKABLE_SYMBOL, BACKGROUND),
        'atleta-hib-maskable-512.png': render(mask, 512, MASKABLE_SYMBOL, BACKGROUND),
        # O Poco (3,25x) desenha o ícone da splash com ~780 px: com 1024 o Chrome não precisa ampliar.
        'atleta-hib-maskable-1024.png': render(mask, 1024, MASKABLE_SYMBOL, BACKGROUND),
        'atleta-hib-any-1024.png': render(mask, 1024, 0.80, None),
        # iOS preenche transparência de preto e arredonda sozinho: ícone opaco com respiro.
        'atleta-hib-apple-touch-180.png': render(mask, 180, 0.62, BACKGROUND),
    }
    for name, image in outputs.items():
        image.save(OUT / name, optimize=True)
        print(f'{name}: {image.width}x{image.height}, {(OUT / name).stat().st_size // 1024} KB')
    # Conferência: o símbolo do maskable cabe no círculo de 66,7% da splash do Android 12+.
    icon = outputs['atleta-hib-maskable-512.png']
    lime = ImageChops.difference(icon.convert('RGB'), Image.new('RGB', icon.size, BACKGROUND)).convert('L').point(lambda v: 255 if v > 40 else 0)
    left, top, right, bottom = lime.getbbox()
    cx = cy = icon.width / 2
    far = max(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 for x in (left, right) for y in (top, bottom))
    print(f'maskable: canto mais distante do símbolo a {far / icon.width:.3f} da largura (limite do círculo da splash: 0.333)')


if __name__ == '__main__':
    main()
