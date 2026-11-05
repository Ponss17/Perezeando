import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App';

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
