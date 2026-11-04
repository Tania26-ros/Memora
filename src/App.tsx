import { Link, Route, Routes } from 'react-router-dom'
import InstallButton from './components/InstallButton'
import StorageInfo from './components/StorageInfo'
import HomePage from './pages/HomePage'
import NotebookPage from './pages/NotebookPage'
import TopicPage from './pages/TopicPage'

// Estructura general: encabezado, la página actual y pie.
// <Routes> elige qué página mostrar según la dirección.
export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>Memora</span>
        </Link>
        <InstallButton />
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/cuaderno/:notebookId" element={<NotebookPage />} />
          <Route path="/tema/:topicId" element={<TopicPage />} />
          <Route path="*" element={<p className="empty">Esta página no existe. <Link to="/">Volver al inicio</Link></p>} />
        </Routes>
      </main>

      <footer className="footer">
        <StorageInfo />
      </footer>
    </div>
  )
}
