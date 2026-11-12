import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PANEL_W } from './features/map/layout';
import './styles/index.css';
import App from './App';
import { initNet, initSW } from './lib/sw';

document.documentElement.style.setProperty('--panel-w', `${PANEL_W}px`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

initNet();
if (import.meta.env.PROD) {
  if (document.readyState === 'complete') void initSW();
  else addEventListener('load', () => void initSW(), { once: true });
}
