// Panel lateral con las opciones de estudio.
// Por ahora solo se muestran: se activarán en las etapas siguientes.
// Lo que necesita IA de pago será parte de Memora Premium (etapa 7).
const OPTIONS: { group: string; items: { label: string; stage: number }[] }[] = [
  {
    group: 'Material de estudio',
    items: [
      { label: 'Vocabulario (sombreando palabras)', stage: 3 },
      { label: 'Lector tipo libro', stage: 4 },
      { label: 'Descargar en PDF o Word', stage: 4 },
      { label: 'Resúmenes y esquemas automáticos', stage: 7 },
    ],
  },
  {
    group: 'Juegos',
    items: [
      { label: 'Puntos, rachas y niveles', stage: 2 },
      { label: 'Competir con amigos', stage: 6 },
      { label: 'Crear preguntas automáticamente', stage: 7 },
    ],
  },
  {
    group: 'Escuchar y hablar',
    items: [
      { label: 'Leer en voz alta', stage: 3 },
      { label: 'Responder con el micrófono', stage: 3 },
      { label: 'Practicar pronunciación', stage: 3 },
    ],
  },
]

export default function StudyPanel() {
  return (
    <aside className="card panel" aria-label="Opciones de estudio">
      <h2>Opciones de estudio</h2>
      <p className="muted">Ya puedes crear y jugar tus preguntas arriba (escribiéndolas o pegándolas). Lo demás se irá activando en las próximas etapas.</p>
      {OPTIONS.map((g) => (
        <fieldset key={g.group} className="panel-group" disabled>
          <legend>{g.group}</legend>
          {g.items.map((it) => (
            <label key={it.label} className="panel-option">
              <input type="checkbox" />
              <span>{it.label}</span>
              <span className="badge">{it.stage === 7 ? 'Premium' : `Etapa ${it.stage}`}</span>
            </label>
          ))}
        </fieldset>
      ))}
    </aside>
  )
}
