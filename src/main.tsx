import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PANEL_W } from './features/map/layout';
import './styles/index.css';
import App from './App';

document.documentElement.style.setProperty('--panel-w', `${PANEL_W}px`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import('./lib/sw').then((m) => {
  m.initNet();
  if (import.meta.env.PROD) {
    if (document.readyState === 'complete') m.initSW();
    else addEventListener('load', () => m.initSW(), { once: true });
  }
});
