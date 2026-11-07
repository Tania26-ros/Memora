import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import InstallButton from './components/InstallButton'
import StatsChips from './components/StatsChips'
import StorageInfo from './components/StorageInfo'
import UndoToast from './components/UndoToast'
import HomePage from './pages/HomePage'

// Las páginas de cuaderno y tema se cargan solo cuando se abren ("lazy"),
// así la primera pantalla descarga menos código y aparece antes.
const NotebookPage = lazy(() => import('./pages/NotebookPage'))
const TopicPage = lazy(() => import('./pages/TopicPage'))
const QuestionsPage = lazy(() => import('./pages/QuestionsPage'))
const PracticePage = lazy(() => import('./pages/PracticePage'))
const ImportPage = lazy(() => import('./pages/ImportPage'))
const ReaderPage = lazy(() => import('./pages/ReaderPage'))
const ListenPage = lazy(() => import('./pages/ListenPage'))
const VocabPage = lazy(() => import('./pages/VocabPage'))
const VocabPracticePage = lazy(() => import('./pages/VocabPracticePage'))
const ProgressPage = lazy(() => import('./pages/ProgressPage'))
const AccountPage = lazy(() => import('./pages/AccountPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

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
        <div className="topbar-right">
          <InstallButton />
          <StatsChips />
          <Link to="/ajustes" className="icon-btn" aria-label="Ajustes">
            ⚙️
          </Link>
        </div>
      </header>

      <main className="content">
        <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/cuaderno/:notebookId" element={<NotebookPage />} />
          <Route path="/tema/:topicId" element={<TopicPage />} />
          <Route path="/tema/:topicId/preguntas" element={<QuestionsPage />} />
          <Route path="/tema/:topicId/jugar" element={<PracticePage />} />
          <Route path="/tema/:topicId/pegar" element={<ImportPage />} />
          <Route path="/tema/:topicId/escuchar" element={<ListenPage />} />
          <Route path="/tema/:topicId/leer" element={<ReaderPage />} />
          <Route path="/tema/:topicId/vocabulario" element={<VocabPage />} />
          <Route path="/tema/:topicId/vocabulario/practicar" element={<VocabPracticePage />} />
          <Route path="/progreso" element={<ProgressPage />} />
          <Route path="/ajustes" element={<SettingsPage />} />
          <Route path="/cuenta" element={<AccountPage />} />
          <Route path="*" element={<p className="empty">Esta página no existe. <Link to="/">Volver al inicio</Link></p>} />
        </Routes>
        </Suspense>
      </main>

      <footer className="footer">
        <StorageInfo />
      </footer>
      <UndoToast />
    </div>
  )
}
