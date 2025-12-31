import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Theme } from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'
import './index.css'
import App from './App'
import { Service, ServiceProvider } from './services/serviceProvider'
import { ChatStreamProvider } from './domain/ChatStreamProvider'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
  <QueryClientProvider client={queryClient}>
    <Theme>
      <ServiceProvider service={new Service()}>
        <ChatStreamProvider>
          <App />
        </ChatStreamProvider>
      </ServiceProvider>
    </Theme>
  </QueryClientProvider>
  // </React.StrictMode>,
)
