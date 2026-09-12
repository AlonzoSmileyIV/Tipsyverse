import './globalInteractionTracker';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Provider } from 'react-redux';
import {store} from './store/store';
import { HelmetProvider } from 'react-helmet-async';
import * as Sentry from '@sentry/react';
import { ThemeProvider } from '@mui/material/styles';
import appTheme from './styles/appTheme';

if (process.env.REACT_APP_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.REACT_APP_RELEASE || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
<Provider store={store}> 
  <ThemeProvider theme={appTheme}>
    <HelmetProvider>
      <Sentry.ErrorBoundary fallback={<p>Something went wrong. Please refresh and try again.</p>}>
        <App />
      </Sentry.ErrorBoundary>
    </HelmetProvider>
  </ThemeProvider>
</Provider>
    
  
);
