// Mede, na página renderizada, os sintomas de layout quebrado. Só lê o DOM.
import type { Page } from '@playwright/test';

export interface LayoutFinding {
  kind: 'clipped' | 'scroll_hidden' | 'overlap' | 'text_collision' | 'escapes_card' | 'nested_card' | 'page_overflow' | 'offscreen'
    | 'tight_padding' | 'chip_wrap' | 'double_divider' | 'cramped' | 'text_covered';
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
    // Caixa visível: fundo (cor ou gradiente), borda ou sombra.
    const hasVisibleBox = (style: CSSStyleDeclaration) => {
      const bg = style.backgroundColor;
      const hasBg = (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') || style.backgroundImage !== 'none';
      const hasBorder = parse(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none';
      return hasBg || hasBorder || style.boxShadow !== 'none';
    };
    // "Cartão" = caixa visível com cantos arredondados. Não exige padding próprio: um card com
    // padding 0 (o conteúdo encostado na borda) é justamente um dos defeitos que queremos ver.
    const boxLike = (style: CSSStyleDeclaration) => {
      const bg = style.backgroundColor;
      const hasBg = (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') || style.backgroundImage !== 'none';
      const side = (s: string) => parse((style as any)[`border${s}Width`]) > 0 && (style as any)[`border${s}Style`] !== 'none';
      return hasBg || style.boxShadow !== 'none' || (side('Top') && side('Right') && side('Bottom') && side('Left'));
    };
    const hasDivider = (style: CSSStyleDeclaration) => ['Top', 'Bottom'].some((s) => parse((style as any)[`border${s}Width`]) > 0 && (style as any)[`border${s}Style`] !== 'none');
    const isCard = (el: Element) => {
      if (!(el instanceof HTMLElement) || !visible(el)) return false;
      if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'LABEL', 'SUMMARY', 'IMG', 'SVG', 'SPAN', 'SMALL', 'STRONG', 'P'].includes(el.tagName)) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return parse(style.borderTopLeftRadius) >= 8 && boxLike(style) && rect.width >= 120 && rect.height >= 48;
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
    // Texto saindo da caixa pintada mais próxima (selo, pílula, botão com fundo): o caso do número
    // grande dentro de um quadrado de altura fixa. Card já é coberto por escapes_card acima.
    const escapedBox = new Set<Element>();
    for (const text of texts) {
      if (text.label.startsWith('::before') || escapedBox.has(text.el)) continue;
      let box: Element | null = null;
      for (let anc: Element | null = text.el; anc && anc !== document.body; anc = anc.parentElement) {
        const st = getComputedStyle(anc);
        if (st.display === 'inline') continue;
        if (boxLike(st) || cardSet.has(anc)) { box = anc; break; }
      }
      if (!box || cardSet.has(box)) continue;
      const b = box.getBoundingClientRect(); const r = text.rect;
      const out = Math.max(b.left - r.left, r.right - b.right, b.top - r.top, r.bottom - b.bottom);
      if (out > 1.5) { escapedBox.add(text.el); findings.push({ kind: 'escapes_card', selector: describe(text.el), detail: `texto «${text.label}» sai ${Math.round(out)}px da caixa ${describe(box)}` }); }
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

    // Texto coberto por outro elemento (campo, caixa, item vizinho): pergunta ao navegador o que está
    // pintado por cima de 3 pontos de cada linha de texto. Pega o que a colisão texto×texto não pega,
    // como subtítulo atrás de um campo de data ou texto atrás de uma caixa com fundo.
    const paints = (el: Element) => {
      const style = getComputedStyle(el);
      if (parse(style.opacity) === 0 || style.visibility === 'hidden') return false;
      return boxLike(style) || ['INPUT', 'SELECT', 'TEXTAREA', 'IMG', 'svg', 'CANVAS'].includes(el.tagName)
        || [style.borderTopWidth, style.borderBottomWidth, style.borderLeftWidth, style.borderRightWidth].some((w) => parse(w) > 0);
    };
    const stuck = (el: Element) => { for (let n: Element | null = el; n; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return n; } return null; };
    const startY = window.scrollY;
    const docTexts = texts.filter((t) => !t.label.startsWith('::before') && !t.layer && !stuck(t.el)).map((t) => ({ ...t, docTop: t.rect.top + startY }));
    const coveredReported = new Set<Element>();
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    for (let y = 0; y <= Math.max(0, maxScroll) + 1; y += Math.max(200, Math.floor(window.innerHeight / 2))) {
      window.scrollTo(0, y);
      const sy = window.scrollY;
      for (const t of docTexts) {
        if (coveredReported.has(t.el)) continue;
        const top = t.docTop - sy;
        if (top < 0 || top + t.rect.height > window.innerHeight) continue;
        const cy = top + t.rect.height / 2;
        for (const cx of [t.rect.left + 3, t.rect.left + t.rect.width / 2, t.rect.right - 3]) {
          if (cx < 0 || cx > vw) continue;
          const stack = document.elementsFromPoint(cx, cy);
          let cover: Element | null = null;
          for (const hit of stack) {
            if (hit === t.el || t.el.contains(hit) || hit.contains(t.el)) break;
            if (stuck(hit)) continue; // nav fixa/toast: some ao rolar, não é defeito de layout
            if (paints(hit)) { cover = hit; break; }
          }
          if (cover) {
            coveredReported.add(t.el);
            findings.push({ kind: 'text_covered', selector: describe(t.el), detail: `texto «${t.label}» coberto por ${describe(cover)}` });
            break;
          }
        }
      }
    }
    window.scrollTo(0, startY);

    // ── Ritmo visual (não é corte nem colisão, mas o olho pega) ──────────────────────────────
    const MIN_PADDING = 12;
    const isControl = (el: Element) => ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
    const outOfFlow = (el: Element) => { for (let n: Element | null = el; n && n !== root; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'absolute' || p === 'fixed') return true; } return false; };
    const nearestCard = (el: Element) => { for (let p = el.parentElement; p; p = p.parentElement) if (cardSet.has(p)) return p; return null; };

    // 1) Padding mínimo: texto ou controle a menos de 12px da borda interna do card que o contém.
    const tight = new Map<Element, { gap: number; what: string }>();
    const measure = (card: Element, rect: DOMRect, what: string) => {
      const style = getComputedStyle(card);
      const box = card.getBoundingClientRect();
      const gap = Math.min(
        rect.left - (box.left + parse(style.borderLeftWidth)),
        (box.right - parse(style.borderRightWidth)) - rect.right,
        rect.top - (box.top + parse(style.borderTopWidth)),
        (box.bottom - parse(style.borderBottomWidth)) - rect.bottom,
      );
      const current = tight.get(card);
      if (gap < MIN_PADDING - 0.5 && (!current || gap < current.gap)) tight.set(card, { gap, what });
    };
    for (const text of texts) {
      if (text.label.startsWith('::before') || text.layer || outOfFlow(text.el)) continue;
      const card = nearestCard(text.el) ?? (cardSet.has(text.el) ? text.el : null);
      if (card) measure(card, text.rect, `texto «${text.label}»`);
    }
    for (const control of all.filter(isControl)) {
      if (outOfFlow(control)) continue;
      const card = nearestCard(control);
      if (card) measure(card, control.getBoundingClientRect(), `${control.tagName.toLowerCase()} «${(control.textContent ?? '').trim().slice(0, 24) || (control as HTMLInputElement).placeholder || ''}»`);
    }
    for (const [card, { gap, what }] of tight) {
      findings.push({ kind: 'tight_padding', selector: describe(card), detail: `${what} a ${Math.round(gap)}px da borda interna (mínimo ${MIN_PADDING}px)` });
    }

    // 2) Etiqueta/chip quebrando por dentro: pílula (raio ≥ 20px) com texto próprio em mais de uma linha.
    //    Bloco de canto pouco arredondado com frase é um quadro, e frase pode quebrar.
    for (const el of all) {
      if (isControl(el) || el.tagName === 'A' || el.tagName === 'SUMMARY') continue;
      const style = getComputedStyle(el);
      if (!hasVisibleBox(style) || parse(style.borderTopLeftRadius) < 20) continue;
      const own = [...el.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim());
      const text = own.map((node) => node.textContent).join(' ').trim();
      if (!own.length || text.length > 48 || el.children.length > 2) continue;
      const range = document.createRange();
      range.setStartBefore(own[0]); range.setEndAfter(own[own.length - 1]);
      const lines = new Set([...range.getClientRects()].filter((r) => r.width > 1).map((r) => Math.round(r.top)));
      if (lines.size > 1) findings.push({ kind: 'chip_wrap', selector: describe(el), detail: `etiqueta «${text.slice(0, 30)}» quebrou em ${lines.size} linhas` });
    }

    // 3) Divisórias consecutivas: duas linhas horizontais a menos de 24px sem conteúdo entre elas.
    //    Linha = borda superior/inferior de algo que não é caixa fechada (sem as quatro bordas),
    //    ou a borda de uma caixa quando encosta numa linha.
    type Line = { y: number; x1: number; x2: number; el: Element; boxed: boolean };
    const lines: Line[] = [];
    for (const el of all) {
      if (isControl(el) || outOfFlow(el)) continue;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width < 40) continue;
      const side = (s: 'Top' | 'Bottom' | 'Left' | 'Right') => parse((style as any)[`border${s}Width`]) > 0 && (style as any)[`border${s}Style`] !== 'none' && !/rgba\(\d+, \d+, \d+, 0\)/.test((style as any)[`border${s}Color`]);
      const boxed = boxLike(style);
      if (side('Top')) lines.push({ y: rect.top, x1: rect.left, x2: rect.right, el, boxed });
      if (side('Bottom')) lines.push({ y: rect.bottom, x1: rect.left, x2: rect.right, el, boxed });
      if (el.tagName === 'HR') lines.push({ y: rect.top, x1: rect.left, x2: rect.right, el, boxed: false });
    }
    const contentRects = [
      ...texts.filter((t) => !t.label.startsWith('::before')).map((t) => t.rect),
      ...all.filter((el) => isControl(el) || ['IMG', 'svg', 'SVG', 'CANVAS'].includes(el.tagName)).map((el) => el.getBoundingClientRect()),
    ];
    const reportedPairs = new Set<string>();
    lines.sort((a, b) => a.y - b.y);
    for (let i = 0; i < lines.length; i += 1) {
      for (let j = i + 1; j < lines.length && lines[j].y - lines[i].y < 24; j += 1) {
        const a = lines[i]; const b = lines[j];
        if (a.el === b.el || (a.boxed && b.boxed) || a.el.contains(b.el) && b.boxed || b.el.contains(a.el) && a.boxed) continue;
        // Linha perto de uma caixa só incomoda quando encosta nela; duas linhas soltas, até 24px.
        if ((a.boxed || b.boxed) && b.y - a.y >= 6) continue;
        const overlap = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
        if (overlap < 0.5 * Math.min(a.x2 - a.x1, b.x2 - b.x1)) continue;
        const between = contentRects.some((r) => r.bottom > a.y + 1 && r.top < b.y - 1 && r.right > Math.max(a.x1, b.x1) && r.left < Math.min(a.x2, b.x2));
        if (between) continue;
        const key = `${describe(a.el)}|${describe(b.el)}`;
        if (reportedPairs.has(key)) continue; reportedPairs.add(key);
        findings.push({ kind: 'double_divider', selector: describe(a.el), detail: `linha em y=${Math.round(a.y)} e outra de ${describe(b.el)} em y=${Math.round(b.y)}, sem conteúdo entre elas` });
      }
    }

    // 4) Elementos colados: irmãos empilhados cujas caixas PINTADAS mais próximas (o próprio irmão ou
    //    um descendente na borda: campo dentro do cabeçalho, botão dentro de uma div) ficam a menos de
    //    6px; e ícone encostado no marcador ▶ do <summary>.
    const MIN_GAP = 6;
    const boxedEl = (el: Element) => boxLike(getComputedStyle(el));
    const paintedEdge = (el: Element, side: 'top' | 'bottom') => {
      const own = el.getBoundingClientRect();
      let best: number | null = null;
      for (const node of [el, ...el.querySelectorAll('*')]) {
        if (!visible(node) || (node !== el && outOfFlow(node))) continue;
        if (!(isControl(node) || boxedEl(node))) continue;
        const r = node.getBoundingClientRect();
        if (r.height < 2) continue;
        if (side === 'bottom' && r.bottom >= own.bottom - 2) best = Math.max(best ?? -Infinity, r.bottom);
        if (side === 'top' && r.top <= own.top + 2) best = Math.min(best ?? Infinity, r.top);
      }
      return best;
    };
    for (const parent of all) {
      const kids = [...parent.children].filter((kid) => visible(kid) && !outOfFlow(kid) && kid.tagName !== 'SUMMARY');
      for (let i = 0; i + 1 < kids.length; i += 1) {
        const a = kids[i]; const b = kids[i + 1];
        const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
        if (ra.height < 2 || rb.height < 2 || rb.top < ra.bottom - 1) continue;
        if (Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left) <= 0) continue;
        const ea = paintedEdge(a, 'bottom'); const eb = paintedEdge(b, 'top');
        if (ea === null && eb === null) continue;
        // Itens irmãos da mesma lista separados por divisória (linhas de tabela, fila, histórico).
        if (a.tagName === b.tagName && (hasDivider(getComputedStyle(a)) || hasDivider(getComputedStyle(b)))) continue;
        // Linhas de lista separadas por divisória já têm o respiro dentro delas.
        if (cardSet.has(parent) && !boxedEl(a) && !boxedEl(b) && ea === null && eb === null) continue;
        const gap = (eb ?? rb.top) - (ea ?? ra.bottom);
        if (gap < MIN_GAP) findings.push({ kind: 'cramped', selector: describe(b), detail: `colado ${Math.round(gap)}px abaixo de ${describe(a)}` });
      }
    }
    for (const summary of all.filter((el) => el.tagName === 'SUMMARY')) {
      const style = getComputedStyle(summary);
      if (style.display !== 'list-item' || style.listStyleType === 'none') continue;
      const first = summary.firstChild;
      if (!first || first.nodeType !== Node.ELEMENT_NODE) continue;
      const offset = (first as Element).getBoundingClientRect().left - (summary.getBoundingClientRect().left + parse(style.paddingLeft) + parse(style.borderLeftWidth));
      if (offset < parse(style.fontSize) * 1.3) findings.push({ kind: 'cramped', selector: describe(summary), detail: `ícone a ${Math.round(offset)}px do início, encostado no marcador ▶` });
    }

    const docWidth = document.documentElement.scrollWidth;
    if (docWidth > vw + 1) findings.push({ kind: 'page_overflow', selector: 'html', detail: `scrollWidth ${docWidth} > viewport ${vw}` });

    return { findings: findings as any, cardCount: cards.length, maxCardDepth };
  });
}
