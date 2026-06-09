import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import App from './App';
import '../app/globals.scss';
import { initAnalytics } from '@/lib/analytics';
import '@/lib/pwaInstall'; // capture beforeinstallprompt before React mounts

initAnalytics();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
