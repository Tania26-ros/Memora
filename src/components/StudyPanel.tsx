// Panel lateral con las opciones de estudio.
// En la etapa 1 solo se muestran: se activarán en las etapas siguientes.
const OPTIONS: { group: string; items: { label: string; stage: number }[] }[] = [
  {
    group: 'Material de estudio',
    items: [
      { label: 'Resumen largo', stage: 5 },
      { label: 'Resumen corto', stage: 5 },
      { label: 'Esquema', stage: 5 },
      { label: 'Vocabulario por nivel', stage: 5 },
    ],
  },
  {
    group: 'Juegos',
    items: [
      { label: 'Opción múltiple', stage: 2 },
      { label: 'Verdadero o falso', stage: 2 },
      { label: 'Unir columnas', stage: 2 },
      { label: 'Completar espacios', stage: 2 },
      { label: 'Ordenar y clasificar', stage: 2 },
    ],
  },
  {
    group: 'Escuchar y hablar',
    items: [
      { label: 'Leer en voz alta', stage: 3 },
      { label: 'Responder con el micrófono', stage: 3 },
    ],
  },
]

export default function StudyPanel() {
  return (
    <aside className="card panel" aria-label="Opciones de estudio">
      <h2>Opciones de estudio</h2>
      <p className="muted">Se irán activando en las próximas etapas.</p>
      {OPTIONS.map((g) => (
        <fieldset key={g.group} className="panel-group" disabled>
          <legend>{g.group}</legend>
          {g.items.map((it) => (
            <label key={it.label} className="panel-option">
              <input type="checkbox" />
              <span>{it.label}</span>
              <span className="badge">Etapa {it.stage}</span>
            </label>
          ))}
        </fieldset>
      ))}
    </aside>
  )
}
