export default function BrandLoader({ message = 'Preparando seu espaço', fullScreen = false }) {
  return <div className={`brand-loader ${fullScreen ? 'brand-loader-screen' : ''}`} role="status" aria-live="polite">
    <img src="/printcaju-logo.png" alt="Print Caju" />
    <span className="brand-loader-track"><i /><i /><i /></span>
    <span className="brand-palette-strip" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
    <span>{message}</span>
  </div>
}
