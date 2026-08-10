import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App.tsx';
import './index.css';
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';

window.addEventListener('vite:preloadError', (event) => {
  const reloadKey = 'carleton-preload-reload';
  if (sessionStorage.getItem(reloadKey) === '1') return;
  event.preventDefault();
  sessionStorage.setItem(reloadKey, '1');
  window.location.reload();
});

window.addEventListener('load', () => sessionStorage.removeItem('carleton-preload-reload'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>
);
