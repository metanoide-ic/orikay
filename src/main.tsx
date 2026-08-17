import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { UpdateBanner } from './components/UpdateBanner';
import '@fontsource-variable/geist';
import '@fontsource-variable/space-grotesk';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
    <UpdateBanner />
  </StrictMode>,
);
