"""Gera a tela de abertura animada dentro do index.html (entre os marcadores abertura:inicio/fim).

Uso (na raiz do projeto): python scripts/gerar-abertura.py
Fontes: logos/atleta-hib-simbolo.svg (gerado por scripts/vetorizar-simbolo.py) e o letreiro
recortado do logo horizontal (public/branding/atleta-hib-logo-horizontal.png).

Por que inline no index.html: pinta no 1º quadro, antes do JavaScript do app, emendando com a
splash do Android (mesmo fundo, símbolo começando com 115px no centro = 48% do ícone maskable
de 240dp, ver scripts/gerar-icones.py).

Sequência (1,45s): bolinha entra com zoom out; o traço desenha o arco da esquerda (de baixo
para cima), o arco de cima (da esquerda para a direita) e a curva em S (de cima até a ponta),
com a mesma velocidade de caneta nas emendas; o símbolo assenta à esquerda e o nome aparece da
esquerda para a direita. Quem decide quando sair é o app (src/lib/splash.ts → ready()).
"""
import base64
import io
import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SYMBOL_SVG = ROOT / 'logos' / 'atleta-hib-simbolo.svg'
HORIZONTAL = ROOT / 'public' / 'branding' / 'atleta-hib-logo-horizontal.png'
WORDMARK_OUT = ROOT / 'logos' / 'atleta-hib-letreiro.png'
INDEX = ROOT / 'index.html'

BACKGROUND = '#070a09'
START_SYMBOL = 115     # px CSS: largura do símbolo na splash do Android (0,48 x 240dp)
SYMBOL = 76            # px CSS: largura do símbolo no logo completo
WORDMARK = 200         # px CSS: largura do nome
GAP = 12               # px CSS entre símbolo e nome
WORDMARK_PIXELS = 650  # largura do PNG do nome (~3,25x, a densidade do Poco)

# Linha do tempo (ms). Traços: 780ms divididos pelo comprimento (377, 285, 495 no SVG).
DOT = (0, 300)
STROKES = {'arco-esquerda': (200, 454), 'arco-cima': (454, 646), 'curva-s': (646, 980)}
# O nome só começa quando o símbolo já quase assentou: antes disso o texto nasceria por cima dele.
SETTLE = (960, 1180)
NAME = (1120, 1450)
INTRO_MS = 1450


def wordmark() -> Image.Image:
    """Recorta 'Atleta Hib' do logo horizontal, sem o toco do traço verde que entra no A."""
    a = np.array(Image.open(HORIZONTAL).convert('RGBA')).astype(float)
    white = (a[:, :, 3] > 128) & (a[:, :, 0] > 200) & (a[:, :, 2] > 150)
    rows = np.arange(100, 175)
    left = np.array([np.nonzero(white[y, 370:520])[0][0] + 370 for y in rows])
    slope, offset = np.polyfit(rows, left, 1)  # borda de fora da perna esquerda do A
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    lime = (a[:, :, 3] > 0) & (a[:, :, 2] < 160) & (a[:, :, 0] < 230)
    outside_a = (xx < slope * yy + offset - 0.5) | (yy > 239.5)
    a[lime & outside_a & (xx < 520), 3] = 0
    crop = Image.fromarray(a[79:244, 376:1350].astype(np.uint8))
    height = round(crop.height * WORDMARK_PIXELS / crop.width)
    return crop.resize((WORDMARK_PIXELS, height), Image.LANCZOS)


def symbol_parts():
    svg = SYMBOL_SVG.read_text(encoding='utf-8')
    view_box = re.search(r'viewBox="([^"]+)"', svg).group(1)
    circle = re.search(r'<circle id="bolinha" cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"', svg).groups()
    width = re.search(r'stroke-width="([\d.]+)"', svg).group(1)
    paths = dict(re.findall(r'<path id="([a-z-]+)" d="([^"]+)"', svg))
    return view_box, circle, width, paths


def ms(value):
    return f'{value}ms'


def build() -> str:
    view_box, _, _, _ = symbol_parts()
    vb = [float(v) for v in view_box.split()]
    symbol_h = SYMBOL * vb[3] / vb[2]
    image = wordmark()
    image.save(WORDMARK_OUT, optimize=True)
    wordmark_h = WORDMARK * image.height / image.width
    start_scale = START_SYMBOL / SYMBOL
    start_shift = (GAP + WORDMARK) / 2  # leva o centro do símbolo ao centro da tela
    # Velocidade da caneta contínua: o 1º traço acelera até a velocidade de cruzeiro (inclinação
    # final 1), o do meio é linear e o último sai nela (inclinação inicial 1) e desacelera.
    easing = {
        'arco-esquerda': 'cubic-bezier(.5, 0, .7, .7)',
        'arco-cima': 'linear',
        'curva-s': 'cubic-bezier(.3, .3, .5, 1)',
    }
    stroke_rules = '\n'.join(
        f'      #app-splash .s-{name} {{ animation: app-splash-draw {ms(end - start)} {easing[name]} {ms(start)} both; }}'
        for name, (start, end) in STROKES.items())
    return f'''<!-- abertura:inicio (gerado por scripts/gerar-abertura.py; não edite à mão) -->
    <style>
      html {{ background: {BACKGROUND}; }}
      #app-splash {{ position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; background: {BACKGROUND}; opacity: 1; transition: opacity 200ms ease-out; -webkit-tap-highlight-color: transparent; }}
      #app-splash.is-leaving {{ opacity: 0; pointer-events: none; }}
      #app-splash.is-fast {{ transition-duration: 120ms; }}
      #app-splash .app-splash-lockup {{ display: flex; align-items: center; gap: {GAP}px; }}
      #app-splash svg {{ display: block; width: {SYMBOL}px; height: {symbol_h:.1f}px; overflow: visible; animation: app-splash-settle {ms(SETTLE[1] - SETTLE[0])} cubic-bezier(.65, 0, .35, 1) {ms(SETTLE[0])} both; }}
      #app-splash .s-dot {{ transform-box: fill-box; transform-origin: center; animation: app-splash-dot {ms(DOT[1] - DOT[0])} cubic-bezier(.2, .8, .2, 1) {ms(DOT[0])} both, app-splash-hold 1.6s ease-in-out {ms(INTRO_MS)} infinite; }}
      #app-splash .s-stroke path {{ stroke-dasharray: 1 2; stroke-dashoffset: 0; }}
{stroke_rules}
      #app-splash img {{ display: block; width: {WORDMARK}px; height: {wordmark_h:.1f}px; animation: app-splash-name {ms(NAME[1] - NAME[0])} cubic-bezier(.2, .7, .2, 1) {ms(NAME[0])} both; }}
      @keyframes app-splash-dot {{ from {{ transform: scale(2.2); opacity: 0; }} 40% {{ opacity: 1; }} to {{ transform: scale(1); opacity: 1; }} }}
      @keyframes app-splash-draw {{ from {{ stroke-dashoffset: 1.05; }} to {{ stroke-dashoffset: 0; }} }}
      @keyframes app-splash-settle {{ from {{ transform: translateX({start_shift:.1f}px) scale({start_scale:.4f}); }} to {{ transform: none; }} }}
      @keyframes app-splash-name {{ from {{ clip-path: inset(0 100% 0 0); transform: translateX(-6px); }} to {{ clip-path: inset(0 0 0 0); transform: none; }} }}
      @keyframes app-splash-hold {{ 0%, 100% {{ transform: scale(1); }} 50% {{ transform: scale(.88); }} }}
      /* Logo completo parado: movimento reduzido ou reabertura na mesma sessão (só a fria anima). */
      #app-splash.is-static *, #app-splash.is-static svg {{ animation: none !important; }}
      @media (prefers-reduced-motion: reduce) {{
        #app-splash, #app-splash * {{ animation: none !important; transition: none !important; }}
      }}
    </style>
    <!-- abertura:fim -->'''


def build_markup() -> str:
    view_box, (cx, cy, r), stroke, paths = symbol_parts()
    image = Image.open(WORDMARK_OUT)
    buffer = io.BytesIO()
    image.save(buffer, format='PNG', optimize=True)
    uri = 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()
    wordmark_h = WORDMARK * image.height / image.width
    path_tags = ''.join(f'<path class="s-{name}" pathLength="1" d="{paths[name]}"/>' for name in STROKES)
    return f'''<!-- abertura-tela:inicio (gerado por scripts/gerar-abertura.py) -->
    <div id="app-splash" aria-hidden="true"><div class="app-splash-lockup"><svg viewBox="{view_box}" aria-hidden="true"><circle class="s-dot" cx="{cx}" cy="{cy}" r="{r}" fill="#b8ff00"/><g class="s-stroke" fill="none" stroke="#b8ff00" stroke-width="{stroke}" stroke-linecap="round">{path_tags}</g></svg><img alt="" width="{WORDMARK}" height="{wordmark_h:.0f}" decoding="sync" src="{uri}"/></div></div>
    <script>
      // Controle da abertura: tocar pula; só a abertura fria anima; sai quando o app avisa que
      // está pronto (window.__atletaSplash.ready) e a animação terminou. Sem tempo mínimo além dela.
      (function () {{
        var el = document.getElementById('app-splash');
        if (!el) return;
        var again = false;
        try {{ again = sessionStorage.getItem('atleta-abertura') === '1'; sessionStorage.setItem('atleta-abertura', '1'); }} catch (e) {{}}
        if (again) el.classList.add('is-static');
        var gone = false, ready = false;
        function remove() {{ if (el.parentNode) el.parentNode.removeChild(el); }}
        function leave(fast) {{
          if (gone) return;
          gone = true;
          if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return remove();
          if (fast) el.classList.add('is-fast');
          el.classList.add('is-leaving');
          el.addEventListener('transitionend', remove, {{ once: true }});
          setTimeout(remove, 400);
        }}
        function introDone() {{
          if (!el.getAnimations) return new Promise(function (ok) {{ setTimeout(ok, again ? 0 : {INTRO_MS}); }});
          var finite = el.getAnimations({{ subtree: true }}).filter(function (a) {{
            var t = a.effect && a.effect.getTiming();
            return t && t.iterations !== Infinity;
          }});
          return Promise.all(finite.map(function (a) {{ return a.finished.catch(function () {{}}); }}));
        }}
        el.addEventListener('pointerdown', function () {{ leave(true); }});
        window.__atletaSplash = {{
          ready: function () {{ if (ready) return; ready = true; introDone().then(function () {{ leave(false); }}); }},
          skip: function () {{ leave(true); }}
        }};
      }})();
    </script>
    <!-- abertura-tela:fim -->'''


def replace_between(text, start, end, block):
    pattern = re.compile(re.escape(start) + r'.*?' + re.escape(end), re.S)
    assert len(pattern.findall(text)) == 1, f'marcadores {start} não encontrados uma vez'
    return pattern.sub(lambda _: block, text)


def main():
    html = INDEX.read_text(encoding='utf-8')
    style = build()
    markup = build_markup()
    html = replace_between(html, '<!-- abertura:inicio', '<!-- abertura:fim -->', style)
    html = replace_between(html, '<!-- abertura-tela:inicio', '<!-- abertura-tela:fim -->', markup)
    INDEX.write_text(html, encoding='utf-8')
    print(f'index.html: {len(html.encode()) // 1024} KB; letreiro {WORDMARK_OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
