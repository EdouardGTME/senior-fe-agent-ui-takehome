import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { AnalyticsWorkspace } from './app/analytics-copilot/AnalyticsWorkspace';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AnalyticsWorkspace />
  </React.StrictMode>,
);
