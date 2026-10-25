export default function PlannedPage({ title, description }) {
  return (
    <div className="page-stack">
      <div className="page-intro"><div><p className="eyebrow">PRINTCAJU ADMIN</p><h2>{title}</h2><p>{description}</p></div></div>
      <section className="panel planned-panel">
        <span className="planned-icon">✳</span>
        <span className="planned-badge">PLANEJADO</span>
        <h3>Este módulo está sendo preparado</h3>
        <p>Não há dados ou ações disponíveis nesta área ainda. Quando for implementada, ela usará os registros reais da sua conta.</p>
      </section>
    </div>
  )
}
