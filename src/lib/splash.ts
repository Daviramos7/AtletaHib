// Remove a tela de abertura do index.html (#app-splash) quando o app está pronto de verdade.
// Sem tempo mínimo: se carregou rápido, some rápido; a única espera é o fade de saída (180ms),
// e nem ele com prefers-reduced-motion. Chamar mais de uma vez é seguro.
const EXIT_MS = 180;

export function hideSplash() {
  const splash = document.getElementById('app-splash');
  if (!splash || splash.dataset.leaving === 'true') return;
  splash.dataset.leaving = 'true';
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    splash.remove();
    return;
  }
  splash.classList.add('is-leaving');
  // transitionend pode não vir (aba em segundo plano): o timer garante a remoção.
  const done = () => splash.remove();
  splash.addEventListener('transitionend', done, { once: true });
  window.setTimeout(done, EXIT_MS + 120);
}
