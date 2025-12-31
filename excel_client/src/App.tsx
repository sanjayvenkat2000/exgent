import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom'
import { Header } from './components/Header'
import { Welcome } from './pages/Welcome'
import { SheetInfoPage } from './pages/SheetInfoPage'

const AppLayout = () => {
  return (
    <>
      <Header />
      <main className="app-content">
        <Outlet />
      </main>
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        path: '/',
        element: <Welcome />,
      },
      {
        path: '/file/:file_id/:sheet_idx',
        element: <SheetInfoPage />,
      },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
