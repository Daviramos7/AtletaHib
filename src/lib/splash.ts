// Avisa a tela de abertura (index.html, gerada por scripts/gerar-abertura.py) que o app está
// pronto. Quem decide a saída é o controle inline de lá: espera a animação de entrada terminar
// (só na abertura fria) e sai; se os dados chegaram depois, sai na hora. Chamar de novo é seguro.
type SplashControl = { ready: () => void; skip: () => void };

function control(): SplashControl | undefined {
  return (window as Window & { __atletaSplash?: SplashControl }).__atletaSplash;
}

export function hideSplash() {
  const splash = control();
  if (splash) splash.ready();
  else document.getElementById('app-splash')?.remove();
}

/** Sai sem esperar a animação (ex.: erro que precisa aparecer já). */
export function skipSplash() {
  const splash = control();
  if (splash) splash.skip();
  else document.getElementById('app-splash')?.remove();
}
