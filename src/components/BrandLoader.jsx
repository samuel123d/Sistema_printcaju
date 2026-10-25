export default function BrandLoader({ message = 'Preparando seu espaço', fullScreen = false }) {
  return <div className={`brand-loader ${fullScreen ? 'brand-loader-screen' : ''}`} role="status" aria-live="polite">
    <div className="brand-loader-card">
      <div className="brand-loader-fruit" aria-hidden="true"><span /><img src="/printcaju-mark.png" alt="" /></div>
      <img className="brand-loader-logo" src="/printcaju-logo.png" alt="Print Caju" />
      <span className="brand-loader-track" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      <span className="brand-palette-strip" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
      <strong className="brand-loader-message">{message}</strong>
      <span className="brand-loader-motivation">Um passo de cada vez. Grandes ideias também florescem.</span>
    </div>
  </div>
}
