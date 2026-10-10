let warming = null;
/** Cache the optional feature chunks after the learner first opens assessments, including on a first install. */
export function warmAssessmentShell() {
  if (!import.meta.env.PROD || !globalThis.navigator?.serviceWorker) return Promise.resolve(false);
  if (warming) return warming;
  warming = new Promise(resolve => {
    let channel = null;
    let settled = false;
    const finish = ok => { if (settled) return; settled = true; clearTimeout(timer); channel?.port1.close(); if (!ok) warming = null; resolve(ok); };
    const timer = setTimeout(() => finish(false), 15000);
    navigator.serviceWorker.ready.then(registration => {
      if (settled) return;
      channel = new globalThis.MessageChannel();
      channel.port1.onmessage = event => finish(event.data?.ok === true);
      registration.active?.postMessage('CACHE_OPTIONAL', [channel.port2]);
    }).catch(() => finish(false));
  });
  return warming;
}
