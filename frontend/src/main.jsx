import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../app/globals.scss';

// Apply saved theme before first paint to prevent flash of wrong theme
const _savedTheme = localStorage.getItem('mytrade-theme') || 'light';
document.documentElement.setAttribute('data-theme', _savedTheme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
