export default function Brand({ compact = false }) {
  return <div className={`brand ${compact ? 'brand-compact' : ''}`}>
    <img className="brand-logo" src="/printcaju-logo.png" alt="Print Caju — Fabricação 3D & Objetos" />
  </div>
}
