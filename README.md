# Memora

Tu carpeta de estudio interactiva: cuadernos, temas, juegos y repaso espaciado.
Es una app web instalable (PWA): se instala en el celular desde el navegador y funciona sin internet.

El plan completo está en el documento [Memora: requisitos y plan por etapas](https://claude.ai/artifact/4Paia7pPPT8QyUP5keWre5).

## Etapas

1. **Base instalable (esta etapa):** cuadernos, temas y archivos guardados en el dispositivo, sin conexión.
2. Juegos, dosis y repaso espaciado.
3. Audio (leer en voz alta, responder con el micrófono) y descargas en PDF y Word.
4. Cuenta en la nube con Supabase.
5. IA con la API de Claude.

## Cómo correrla en tu computadora

Necesitas [Node.js](https://nodejs.org) 20 o más nuevo.

```bash
npm install      # instala las librerías (solo la primera vez)
npm run dev      # abre la app en http://localhost:5173 y se recarga al guardar cambios
npm test         # corre las pruebas automáticas
npm run build    # crea la versión final en la carpeta dist/
```

## Cómo está organizado el código

```
src/
  main.tsx              Punto de entrada: arranca React y el enrutador
  App.tsx               Encabezado, páginas y pie
  index.css             Estilos y colores (modo claro y oscuro)
  lib/
    db.ts               Base de datos local (IndexedDB con Dexie)
    db.test.ts          Pruebas de la base de datos
    format.ts           Utilidades: tamaño de archivos, íconos
  pages/
    HomePage.tsx        Mis cuadernos
    NotebookPage.tsx    Temas de un cuaderno
    TopicPage.tsx       Archivos de un tema y panel de opciones
  components/           Piezas reutilizables (subir archivos, listas, botones)
public/                 Íconos de la app
vite.config.ts          Configuración de compilación y de la PWA
vercel.json             Hace que /cuaderno/3 funcione al publicar en Vercel
```

## Herramientas

| Parte | Herramienta |
| --- | --- |
| Interfaz | React + TypeScript + Vite |
| App instalable y sin conexión | vite-plugin-pwa |
| Datos en el dispositivo | Dexie (IndexedDB) |
| Pruebas | Vitest |
| Publicación | Vercel |
