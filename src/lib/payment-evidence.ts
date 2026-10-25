export interface SavedPayment { hash: string; source: string; destination: string; }
const KEY = 'cdp-clear-test-payment-confirmed';
export function savedPayment(): SavedPayment | null {
  for (const raw of [localStorage.getItem(KEY), sessionStorage.getItem('cdp-clear-test-payment-pending')]) {
    try {
      const value = JSON.parse(raw || 'null');
      const source = value?.source ?? value?.payment?.source;
      const destination = value?.destination ?? value?.payment?.destination;
      if (/^[a-f0-9]{64}$/.test(value?.hash) && /^G[A-Z2-7]{55}$/.test(source) && /^G[A-Z2-7]{55}$/.test(destination)) return { hash: value.hash, source, destination };
    } catch { /* Stored input is not independent network evidence. */ }
  }
  return null;
}
export function savePayment(value: SavedPayment) {
  localStorage.setItem(KEY, JSON.stringify(value));
  window.dispatchEvent(new Event('cdp-clear-confirmed-payment'));
}