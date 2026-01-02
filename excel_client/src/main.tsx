import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Theme } from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'
import './index.css'
import App from './App'
import { Service, ServiceProvider } from './domain/serviceProvider'
import { ChatStreamProvider } from './domain/ChatStreamProvider'

const queryClient = new QueryClient()

const API_BASE_URL = 'http://localhost:8080';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Theme>
        <ServiceProvider service={new Service(API_BASE_URL)}>
          <ChatStreamProvider apiUrl={API_BASE_URL}>
            <App />
          </ChatStreamProvider>
        </ServiceProvider>
      </Theme>
    </QueryClientProvider>
  </React.StrictMode>,
)
