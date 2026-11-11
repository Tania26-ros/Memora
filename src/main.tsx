import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './lib/settings' // aplica el estilo elegido antes de mostrar la app
import App from './App.tsx'

// Punto de entrada: monta la app de React dentro de <div id="root">.
// BrowserRouter permite tener direcciones como /cuaderno/3 o /tema/8.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
