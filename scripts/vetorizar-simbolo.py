"""Vetoriza o símbolo do Atleta Hib (PNG 1024) em SVG com as 4 peças separadas.

Uso (na raiz do projeto): python scripts/vetorizar-simbolo.py
Saída: logos/atleta-hib-simbolo.svg (fonte oficial do símbolo daqui em diante).

Cada traço vira um <path> com stroke e ponta arredondada, para a abertura poder "desenhar"
com stroke-dashoffset. Como: separa as peças (componentes conexos), afina cada traço até a
linha central (Zhang-Suen), ordena os pontos de uma ponta à outra, mede a espessura pela
distância da linha central até a borda e ajusta curvas Bézier cúbicas por mínimos quadrados.
A conferência contra o PNG fica em scripts/conferir-simbolo.mjs.

Sentido de cada traço (é o sentido em que a abertura desenha):
  arco-esquerda: da ponta de baixo até a ponta de cima
  arco-cima:     da esquerda para a direita
  curva-s:       da ponta de cima (perto da bolinha) até a ponta da direita
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'public' / 'icons' / 'atleta-hib-symbol-1024.png'
OUT = ROOT / 'logos' / 'atleta-hib-simbolo.svg'
LIME = '#b8ff00'
FIT_TOLERANCE = 1.2  # px (na escala de 1024) de erro máximo entre a curva e a linha central


def components(mask):
    h, w = mask.shape
    labels = np.zeros(mask.shape, int)
    count = 0
    for y, x in zip(*np.nonzero(mask)):
        if labels[y, x]:
            continue
        count += 1
        labels[y, x] = count
        queue = deque([(y, x)])
        while queue:
            cy, cx = queue.popleft()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = count
                    queue.append((ny, nx))
    return [labels == i for i in range(1, count + 1)]


def thin(mask):
    """Afinamento de Zhang-Suen, vetorizado."""
    img = np.pad(mask.astype(np.uint8), 1)
    while True:
        changed = False
        for step in (0, 1):
            p2, p3, p4, p5 = img[:-2, 1:-1], img[:-2, 2:], img[1:-1, 2:], img[2:, 2:]
            p6, p7, p8, p9 = img[2:, 1:-1], img[2:, :-2], img[1:-1, :-2], img[:-2, :-2]
            ring = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
            neighbours = sum(ring[:8])
            transitions = sum(((ring[i] == 0) & (ring[i + 1] == 1)).astype(np.uint8) for i in range(8))
            if step == 0:
                cond = (p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0)
            else:
                cond = (p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0)
            core = img[1:-1, 1:-1]
            remove = (core == 1) & (neighbours >= 2) & (neighbours <= 6) & (transitions == 1) & cond
            if remove.any():
                core[remove] = 0
                changed = True
        if not changed:
            return img[1:-1, 1:-1].astype(bool)


def ordered_centerline(skeleton):
    """Caminho mais longo do esqueleto (descarta galhinhos), como lista de (x, y)."""
    points = {(int(x), int(y)) for y, x in zip(*np.nonzero(skeleton))}

    def neighbours(p):
        x, y = p
        return [(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy) and (x + dx, y + dy) in points]

    def farthest(start):
        prev = {start: None}
        queue = deque([start])
        last = start
        while queue:
            last = queue.popleft()
            for n in neighbours(last):
                if n not in prev:
                    prev[n] = last
                    queue.append(n)
        return last, prev

    a, _ = farthest(next(iter(points)))
    b, prev = farthest(a)
    path = [b]
    while prev[path[-1]] is not None:
        path.append(prev[path[-1]])
    return np.array(path, float)


def smooth(points, window=9):
    kernel = np.ones(window) / window
    padded = np.pad(points, ((window // 2, window // 2), (0, 0)), mode='edge')
    out = np.stack([np.convolve(padded[:, i], kernel, mode='valid') for i in range(2)], axis=1)
    out[0], out[-1] = points[0], points[-1]
    return out


def fit_ends(line, mask, width):
    """Ajusta cada ponta da linha central para a ponta arredondada cobrir o fim real do traço.

    O afinamento erra o fim (para antes numa ponta redonda, passa do ponto numa ponta mais
    achatada). Para cada ponta testa, de uma vez, de cortar meia espessura a prolongar 0,7
    espessura na direção da tangente, e fica com a posição de menor diferença com a peça.
    """
    def resample(points, step=1.0):
        d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))]
        s = np.arange(0, d[-1], step)
        return np.stack([np.interp(s, d, points[:, 0]), np.interp(s, d, points[:, 1])], axis=1)

    line = resample(line)
    for end in (0, -1):
        if end == 0:
            line = line[::-1]  # trabalha sempre na ponta do fim
        tip = line[-1]
        direction = tip - line[-12]
        direction /= np.linalg.norm(direction)
        window = int(width * 1.5)
        body = line[-window:]
        s = -np.linalg.norm(body - tip, axis=1)  # posição (negativa) de cada ponto antes da ponta
        ext = np.arange(1, int(width * 0.7))
        pts = np.vstack([body, tip + ext[:, None] * direction])
        pos = np.r_[s, ext]
        x0, y0 = np.floor(tip - width * 1.6).astype(int)
        size = int(width * 3.2)
        gx, gy = np.meshgrid(np.arange(x0, x0 + size), np.arange(y0, y0 + size))
        grid = np.stack([gx.ravel(), gy.ravel()], axis=1).astype(float)
        inside = mask[np.clip(gy.ravel(), 0, mask.shape[0] - 1), np.clip(gx.ravel(), 0, mask.shape[1] - 1)]
        # o resto do traço (antes da janela) também cobre parte da área
        rest = line[: -window]
        rest = rest[np.linalg.norm(rest - tip, axis=1) < width * 3]
        base = np.full(len(grid), np.inf) if len(rest) == 0 else np.sqrt(((grid[:, None, :] - rest[None, :, :]) ** 2).sum(-1)).min(axis=1)
        dist = np.sqrt(((grid[:, None, :] - pts[None, :, :]) ** 2).sum(-1))
        nearest = np.minimum(np.minimum.accumulate(dist, axis=1), base[:, None])
        covered = nearest <= width / 2
        score = (covered != inside[:, None]).sum(axis=0)
        valid = pos >= -width / 2
        k = int(np.argmin(np.where(valid, score, np.iinfo(np.int64).max)))
        line = np.vstack([line[: -window], pts[: k + 1]])
        if end == 0:
            line = line[::-1]
    return line


def bezier(p, t):
    t = t[:, None]
    return (1 - t) ** 3 * p[0] + 3 * (1 - t) ** 2 * t * p[1] + 3 * (1 - t) * t ** 2 * p[2] + t ** 3 * p[3]


def fit_cubic(points):
    """Cúbica com pontas fixas; controles por mínimos quadrados, com reparametrização."""
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))]
    t = d / d[-1]
    p0, p3 = points[0], points[-1]
    for _ in range(12):
        b1, b2 = 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2
        rhs = points - np.outer((1 - t) ** 3, p0) - np.outer(t ** 3, p3)
        a = np.stack([b1, b2], axis=1)
        ctrl, *_ = np.linalg.lstsq(a, rhs, rcond=None)
        curve = np.array([p0, ctrl[0], ctrl[1], p3])
        # reparametriza: cada ponto pega o t do ponto mais próximo numa amostragem fina da curva
        fine_t = np.linspace(0, 1, 800)
        fine = bezier(curve, fine_t)
        idx = np.argmin(((points[:, None, :] - fine[None, :, :]) ** 2).sum(-1), axis=1)
        t = np.maximum.accumulate(fine_t[idx])
        t[0], t[-1] = 0, 1
    error = np.sqrt(((points[:, None, :] - fine[None, :, :]) ** 2).sum(-1).min(axis=1))
    return curve, error


def fit_path(points):
    curve, error = fit_cubic(points)
    if error.max() <= FIT_TOLERANCE or len(points) < 12:
        return [curve]
    split = int(np.clip(np.argmax(error), len(points) // 4, 3 * len(points) // 4))
    left, right = fit_path(points[: split + 1]), fit_path(points[split:])
    # continuidade de tangente na emenda: alinha os controles vizinhos à emenda
    joint = left[-1][3]
    direction = right[0][1] - left[-1][2]
    direction /= np.linalg.norm(direction)
    left[-1][2] = joint - direction * np.linalg.norm(joint - left[-1][2])
    right[0][1] = joint + direction * np.linalg.norm(right[0][1] - joint)
    return left + right


def stroke_width(mask, centerline):
    ys, xs = np.nonzero(mask & ~np.pad(mask, 1)[2:, 1:-1] | mask & ~np.pad(mask, 1)[:-2, 1:-1]
                        | mask & ~np.pad(mask, 1)[1:-1, 2:] | mask & ~np.pad(mask, 1)[1:-1, :-2])
    border = np.stack([xs, ys], axis=1).astype(float)
    middle = centerline[len(centerline) // 5: -len(centerline) // 5: 4]
    dist = np.sqrt(((middle[:, None, :] - border[None, :, :]) ** 2).sum(-1)).min(axis=1)
    return 2 * float(np.median(dist)) + 1  # +1: a borda é o último pixel de dentro


def to_svg_path(curves):
    f = lambda p: f'{p[0]:.1f} {p[1]:.1f}'
    parts = [f'M{f(curves[0][0])}'] + [f'C{f(c[1])} {f(c[2])} {f(c[3])}' for c in curves]
    return ' '.join(parts)


def main():
    alpha = np.array(Image.open(SOURCE).convert('RGBA'))[:, :, 3] > 127
    parts = components(alpha)
    dot = min(parts, key=lambda m: m.sum())
    strokes = [m for m in parts if m is not dot]
    ys, xs = np.nonzero(dot)
    cx, cy, r = xs.mean(), ys.mean(), np.sqrt(dot.sum() / np.pi)

    lines = {}
    masks = {}
    widths = []
    for mask in strokes:
        line = ordered_centerline(thin(mask))
        widths.append(stroke_width(mask, line))
        mean = line.mean(axis=0)
        if mean[0] < cx - 50:
            name = 'arco-esquerda'
            line = line if line[0][1] > line[-1][1] else line[::-1]  # começa embaixo
        elif mean[1] < cy - 100:
            name = 'arco-cima'
            line = line if line[0][0] < line[-1][0] else line[::-1]  # começa à esquerda
        else:
            name = 'curva-s'
            line = line if line[0][1] < line[-1][1] else line[::-1]  # começa em cima
        lines[name] = line
        masks[name] = mask
    # +2: a borda do PNG é serrilhada e a medida cai no último pixel de dentro; com +2 a
    # sobreposição com o PNG é a maior (testado de 93 a 96 px em scripts/conferir-simbolo.mjs).
    width = float(np.mean(widths)) + 2
    for name, line in lines.items():
        lines[name] = fit_ends(smooth(line), masks[name], width)

    paths = {name: fit_path(line) for name, line in lines.items()}
    all_pts = np.vstack([np.vstack(c) for curves in paths.values() for c in curves] + [[[cx - r, cy - r], [cx + r, cy + r]]])
    pad = width / 2 + 2
    x0, y0 = np.floor(all_pts.min(axis=0) - pad)
    x1, y1 = np.ceil(all_pts.max(axis=0) + pad)
    # viewBox no sistema de coordenadas do PNG de 1024 (facilita sobrepor na conferência)
    order = ['arco-esquerda', 'arco-cima', 'curva-s']
    body = '\n'.join(
        f'  <path id="{name}" d="{to_svg_path(paths[name])}" />' for name in order)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.0f} {y0:.0f} {x1 - x0:.0f} {y1 - y0:.0f}" width="{x1 - x0:.0f}" height="{y1 - y0:.0f}">
  <!-- Símbolo do Atleta Hib. Gerado por scripts/vetorizar-simbolo.py a partir do PNG de 1024. -->
  <!-- Traços desenháveis: o sentido de cada path é o sentido em que a abertura o desenha. -->
  <circle id="bolinha" cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{LIME}" />
  <g fill="none" stroke="{LIME}" stroke-width="{width:.1f}" stroke-linecap="round" stroke-linejoin="round">
{body}
  </g>
</svg>
'''
    OUT.write_text(svg, encoding='utf-8')
    print(f'{OUT.relative_to(ROOT)}: bolinha r={r:.1f}, traço {width:.1f}px, viewBox {x0:.0f} {y0:.0f} {x1 - x0:.0f} {y1 - y0:.0f}')
    for name in order:
        print(f'  {name}: {len(paths[name])} cúbica(s), larguras medidas {[round(w, 1) for w in widths]}')


if __name__ == '__main__':
    main()
