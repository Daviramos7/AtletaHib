// Mede, na página renderizada, os sintomas de layout quebrado. Só lê o DOM.
import type { Page } from '@playwright/test';

export interface LayoutFinding {
  kind: 'clipped' | 'scroll_hidden' | 'overlap' | 'text_collision' | 'escapes_card' | 'nested_card' | 'page_overflow' | 'offscreen';
  selector: string;
  detail: string;
}

export async function auditLayout(page: Page): Promise<{ findings: LayoutFinding[]; cardCount: number; maxCardDepth: number }> {
  return page.evaluate(() => {
    const findings: Array<{ kind: string; selector: string; detail: string }> = [];
    const root = document.querySelector('#main-content') ?? document.body;
    const vw = document.documentElement.clientWidth;

    const describe = (el: Element) => {
      const classes = [...el.classList].slice(0, 3).join('.');
      const label = (el.querySelector('h2,h3,h4,strong,summary')?.textContent ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return `${el.tagName.toLowerCase()}${classes ? `.${classes}` : ''}${label ? ` «${label}»` : ''}`;
    };
    // Conteúdo de <details> fechado ainda tem caixa no Chrome atual, mas não aparece: ignorar.
    const insideClosedDetails = (el: Element) => {
      for (let details = el.closest('details'); details; details = details.parentElement?.closest('details') ?? null) {
        const summary = details.querySelector(':scope > summary');
        const inSummary = Boolean(summary && (summary === el || summary.contains(el)));
        if (!details.open && !inSummary && details !== el) return true;
      }
      return false;
    };
    const visible = (el: Element) => {
      if (insideClosedDetails(el)) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      // Texto só para leitor de tela (recortado de propósito em 1×1 px) não é conteúdo visível.
      const screenReaderOnly = style.clipPath === 'inset(50%)' && rect.width <= 1 && rect.height <= 1;
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && !screenReaderOnly;
    };
    const parse = (value: string) => Number.parseFloat(value) || 0;
    // "Cartão" = caixa com fundo ou borda ou sombra, cantos arredondados e padding próprio.
    const isCard = (el: Element) => {
      if (!(el instanceof HTMLElement) || !visible(el)) return false;
      if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'LABEL', 'SUMMARY', 'IMG', 'SVG', 'SPAN', 'SMALL', 'STRONG', 'P'].includes(el.tagName)) return false;
      const style = getComputedStyle(el);
      const radius = parse(style.borderTopLeftRadius);
      const bg = style.backgroundColor;
      const hasBg = bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
      const hasBorder = parse(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none';
      const hasShadow = style.boxShadow !== 'none';
      const padding = Math.min(parse(style.paddingTop), parse(style.paddingLeft));
      const rect = el.getBoundingClientRect();
      return radius >= 8 && padding >= 8 && (hasBg || hasBorder || hasShadow) && rect.width >= 120 && rect.height >= 48;
    };

    const all = [...root.querySelectorAll('*')].filter(visible);
    const cards = all.filter(isCard);
    const cardSet = new Set(cards);

    // Card dentro de card (profundidade).
    let maxCardDepth = 0;
    for (const card of cards) {
      let depth = 1;
      let parent = card.parentElement;
      while (parent && parent !== root.parentElement) {
        if (cardSet.has(parent)) depth += 1;
        parent = parent.parentElement;
      }
      maxCardDepth = Math.max(maxCardDepth, depth);
      if (depth >= 2) {
        const outer = (() => { let p = card.parentElement; while (p && !cardSet.has(p)) p = p.parentElement; return p; })();
        findings.push({ kind: 'nested_card', selector: describe(card), detail: `profundidade ${depth}${outer ? ` dentro de ${describe(outer)}` : ''}` });
      }
    }

    // Conteúdo cortado: overflow escondido com conteúdo maior que a caixa.
    for (const el of all) {
      const style = getComputedStyle(el);
      const hidesX = ['hidden', 'clip'].includes(style.overflowX);
      const hidesY = ['hidden', 'clip'].includes(style.overflowY);
      if (!hidesX && !hidesY) continue;
      const html = el as HTMLElement;
      const cutY = hidesY && html.scrollHeight > html.clientHeight + 2;
      const cutX = hidesX && html.scrollWidth > html.clientWidth + 2 && style.textOverflow !== 'ellipsis';
      if ((cutY || cutX) && (html.innerText ?? '').trim().length > 0) {
        findings.push({ kind: 'clipped', selector: describe(el), detail: `${cutY ? `altura ${html.clientHeight}px mostra ${html.scrollHeight}px` : ''}${cutY && cutX ? '; ' : ''}${cutX ? `largura ${html.clientWidth}px de ${html.scrollWidth}px` : ''} (overflow ${style.overflowX}/${style.overflowY}, height ${style.height}, max-height ${style.maxHeight})` });
      }
    }

    // Filho (botão, texto, input) saindo do card.
    for (const card of cards) {
      const box = card.getBoundingClientRect();
      for (const child of card.querySelectorAll('button, a, input, select, textarea, h2, h3, h4, p, strong, small, span')) {
        if (!visible(child)) continue;
        const rect = child.getBoundingClientRect();
        const out = Math.max(box.left - rect.left, rect.right - box.right, box.top - rect.top, rect.bottom - box.bottom);
        if (out > 2) {
          findings.push({ kind: 'escapes_card', selector: describe(child), detail: `sai ${Math.round(out)}px de ${describe(card)}` });
          break;
        }
      }
    }

    // Cards irmãos sobrepostos.
    const byParent = new Map<Element, Element[]>();
    for (const card of cards) {
      const parent = card.parentElement;
      if (!parent) continue;
      byParent.set(parent, [...(byParent.get(parent) ?? []), card]);
    }
    for (const siblings of byParent.values()) {
      for (let i = 0; i < siblings.length; i += 1) {
        for (let j = i + 1; j < siblings.length; j += 1) {
          const a = siblings[i].getBoundingClientRect();
          const b = siblings[j].getBoundingClientRect();
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w > 2 && h > 2) findings.push({ kind: 'overlap', selector: describe(siblings[i]), detail: `sobrepõe ${describe(siblings[j])} em ${Math.round(w)}×${Math.round(h)}px` });
        }
      }
    }

    // Elementos interativos fora da tela na horizontal.
    for (const el of root.querySelectorAll('button, a, input, select, textarea')) {
      if (!visible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.right > vw + 1 || rect.left < -1) findings.push({ kind: 'offscreen', selector: describe(el), detail: `x ${Math.round(rect.left)}→${Math.round(rect.right)} com viewport ${vw}` });
    }

    // Texto colidindo com texto (ou com pseudo-elemento ::before com content). Mede a caixa do texto real via Range.
    const fixedLayer = (el: Element) => { for (let n: Element | null = el; n; n = n.parentElement) { if (getComputedStyle(n).position === 'fixed') return n; } return null; };
    const scope = document.body;
    const texts: Array<{ el: Element; rect: DOMRect; layer: Element | null; label: string }> = [];
    for (const el of scope.querySelectorAll('*')) {
      if (!visible(el)) continue;
      const own = [...el.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim());
      if (own.length) {
        const range = document.createRange();
        range.setStartBefore(own[0]); range.setEndAfter(own[own.length - 1]);
        for (const rect of range.getClientRects()) {
          if (rect.width < 2 || rect.height < 2) continue;
          texts.push({ el, rect, layer: fixedLayer(el), label: (own.map((n) => n.textContent).join(' ').trim()).slice(0, 30) });
        }
      }
      const before = getComputedStyle(el, '::before');
      if (before.content && !['none', 'normal', '""', "''"].includes(before.content) && before.position === 'absolute') {
        const box = el.getBoundingClientRect();
        const left = box.left + parse(before.left); const top = box.top + parse(before.top);
        const width = parse(before.width) || parse(before.fontSize) * Math.max(1, before.content.replace(/["']/g, '').length) * 0.6;
        const height = parse(before.lineHeight) || parse(before.fontSize) * 1.2;
        texts.push({ el, rect: new DOMRect(left, top, width, height), layer: fixedLayer(el), label: `::before ${before.content}` });
      }
    }
    // Texto cortado de verdade: a caixa do texto sai de um ancestral que recorta (hidden/clip),
    // fica escondida atrás de rolagem lateral (auto/scroll) ou sai da tela. Pega o caso que o
    // scrollWidth não pega: texto vazando de um filho espremido por min-width: 0.
    const clipReported = new Set<Element>();
    for (const text of texts) {
      if (text.label.startsWith('::before')) continue;
      const r = text.rect;
      // Camada fixa inteira fora da janela (ex.: skip-link, que só desce no foco) está escondida de propósito.
      if (text.layer && (r.bottom <= 0 || r.top >= window.innerHeight)) continue;
      if (!text.layer && (r.right > vw + 1 || r.left < -1)) {
        if (!clipReported.has(text.el)) { clipReported.add(text.el); findings.push({ kind: 'offscreen', selector: describe(text.el), detail: `texto «${text.label}» x ${Math.round(r.left)}→${Math.round(r.right)} com viewport ${vw}` }); }
        continue;
      }
      for (let anc = text.el.parentElement; anc && anc !== document.body && anc !== document.documentElement; anc = anc.parentElement) {
        const style = getComputedStyle(anc);
        const modes = [style.overflowX, style.overflowY];
        if (modes.every((mode) => mode === 'visible')) continue;
        const box = anc.getBoundingClientRect();
        const outX = Math.max(box.left + parse(style.borderLeftWidth) - r.left, r.right - (box.right - parse(style.borderRightWidth)));
        const outY = Math.max(box.top + parse(style.borderTopWidth) - r.top, r.bottom - (box.bottom - parse(style.borderBottomWidth)));
        const cutX = style.overflowX !== 'visible' && outX > 2;
        const cutY = style.overflowY !== 'visible' && outY > 2;
        if ((cutX || cutY) && !clipReported.has(text.el)) {
          clipReported.add(text.el);
          const scrolls = (cutX ? style.overflowX : style.overflowY);
          findings.push({ kind: ['auto', 'scroll'].includes(scrolls) ? 'scroll_hidden' as any : 'clipped', selector: describe(text.el), detail: `texto «${text.label}» sai ${Math.round(Math.max(cutX ? outX : 0, cutY ? outY : 0))}px de ${describe(anc)} (overflow ${style.overflowX}/${style.overflowY})` });
        }
        if (cutX || cutY) break;
      }
    }
    // Reticências escondem texto: conta como corte.
    for (const el of all) {
      const style = getComputedStyle(el);
      const html = el as HTMLElement;
      if (style.textOverflow === 'ellipsis' && html.scrollWidth > html.clientWidth + 1 && (html.innerText ?? '').trim()) {
        findings.push({ kind: 'clipped', selector: describe(el), detail: `reticências: largura ${html.clientWidth}px de ${html.scrollWidth}px` });
      }
    }

    const seen = new Set<string>();
    for (let i = 0; i < texts.length; i += 1) {
      for (let j = i + 1; j < texts.length; j += 1) {
        const a = texts[i]; const b = texts[j];
        if (a.el === b.el || a.layer !== b.layer || a.el.contains(b.el) && a.label === b.label) continue;
        const w = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const h = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (w > 1.5 && h > 3) {
          const key = `${a.label}|${b.label}`;
          if (seen.has(key)) continue; seen.add(key);
          findings.push({ kind: 'text_collision', selector: describe(a.el.parentElement ?? a.el), detail: `«${a.label}» × «${b.label}» (${Math.round(w)}×${Math.round(h)}px)` });
        }
      }
    }

    const docWidth = document.documentElement.scrollWidth;
    if (docWidth > vw + 1) findings.push({ kind: 'page_overflow', selector: 'html', detail: `scrollWidth ${docWidth} > viewport ${vw}` });

    return { findings: findings as any, cardCount: cards.length, maxCardDepth };
  });
}
