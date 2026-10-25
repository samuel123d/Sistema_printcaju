export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function formatBrazilianPhone(value) {
  const digits = digitsOnly(value).slice(0, 11)
  if (!digits) return ''
  const areaCode = digits.slice(0, 2)
  const number = digits.slice(2)
  if (digits.length === 1) return `(${areaCode}`
  if (digits.length === 2) return `(${areaCode})`
  if (digits.length <= 6) return `(${areaCode}) ${number}`
  if (digits.length <= 10) return `(${areaCode}) ${number.slice(0, 4)}-${number.slice(4)}`
  return `(${areaCode}) ${number.slice(0, 5)}-${number.slice(5)}`
}

export function formatBrazilianTaxId(value) {
  const digits = digitsOnly(value).slice(0, 14)
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}
