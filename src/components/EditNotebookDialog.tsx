import { useEffect, useRef } from 'react'
import { createNotebook, updateNotebook, type Notebook } from '../lib/db'
import NotebookForm from './NotebookForm'

// Ventana para crear un cuaderno o editar su nombre, ícono y color.
// <dialog> es una ventana nativa del navegador: oscurece el fondo y se cierra con Esc.
export default function EditNotebookDialog({ notebook, onClose }: { notebook?: Notebook; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="nb-dialog-title">
      <h2 id="nb-dialog-title">{notebook ? 'Editar cuaderno' : 'Nuevo cuaderno'}</h2>
      <NotebookForm
        idPrefix={notebook ? `edit-${notebook.id}` : 'new'}
        initial={notebook}
        submitLabel={notebook ? 'Guardar cambios' : 'Crear cuaderno'}
        onCancel={() => ref.current?.close()}
        onSubmit={async (v) => {
          if (notebook) await updateNotebook(notebook.id, v)
          else await createNotebook(v)
          ref.current?.close()
        }}
      />
    </dialog>
  )
}
