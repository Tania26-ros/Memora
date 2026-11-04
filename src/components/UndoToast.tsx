import { dismissUndo, useUndo } from '../lib/undo'

export default function UndoToast() {
  const item = useUndo()
  if (!item) return null
  return (
    <div className="undo-toast" role="status" key={item.id}>
      <span>{item.message}</span>
      <button
        className="btn btn-small undo-btn"
        onClick={async () => {
          dismissUndo()
          await item.undo()
        }}
      >
        Deshacer
      </button>
    </div>
  )
}
