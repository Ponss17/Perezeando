import { setApp } from '../store/useApp';

export function policiesInUrl() {
  return new URLSearchParams(location.search).get('politicas') === '1';
}

export function openPolicies() {
  const q = new URLSearchParams(location.search);
  if (q.get('politicas') !== '1') {
    q.set('politicas', '1');
    history.pushState(null, '', location.pathname + '?' + q.toString() + location.hash);
  }
  setApp({ policiesOpen: true, creditsOpen: false });
}

export function closePolicies() {
  const q = new URLSearchParams(location.search);
  if (q.get('politicas') === '1') {
    q.delete('politicas');
    const s = q.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
  }
  setApp({ policiesOpen: false });
}
