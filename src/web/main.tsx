import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppLayout } from './AppLayout';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppLayout />
  </StrictMode>,
);
