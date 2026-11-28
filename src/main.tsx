// The editor's entry: React mounts App once on index.html's #root, in StrictMode; a page without #root is a fault.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/theme.scss';
import { App } from './editor/App';

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
