function tlv(id, value) {
  const text = String(value)
  return `${id}${String(text.length).padStart(2, '0')}${text}`
}

function crc16(payload) {
  let crc = 0xffff
  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function normalizePixKey(value) {
  const key = String(value ?? '').trim()
  if (key.includes('@')) return key.toLowerCase()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return key.toLowerCase()
  const digits = key.replace(/\D/g, '')
  if ([11, 14].includes(digits.length)) return digits
  if (digits.length >= 10 && digits.length <= 13) return digits.startsWith('55') ? `+${digits}` : `+55${digits}`
  return key
}

function normalizeText(value, maxLength) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 $%*+\-./:]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function makeTxid() {
  const random = Math.random().toString(36).slice(2, 10).toUpperCase()
  return `PC${Date.now().toString(36).toUpperCase()}${random}`.slice(0, 25)
}

export function buildPixPayload({ key, name, city, amount, txid }) {
  const normalizedKey = normalizePixKey(key)
  const merchantName = normalizeText(name, 25)
  const merchantCity = normalizeText(city, 15)
  const numericAmount = Number(amount)
  if (!normalizedKey || normalizedKey.length > 77) throw new Error('Configure uma chave Pix válida em Configurações.')
  if (!merchantName || !merchantCity) throw new Error('Preencha o nome do recebedor e a cidade em Configurações.')
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('O valor da venda precisa ser maior que zero para gerar o QR Pix.')

  const transactionId = String(txid || makeTxid()).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 25) || 'PRINTCAJU'
  const merchantAccount = tlv('00', 'br.gov.bcb.pix') + tlv('01', normalizedKey)
  const additionalData = tlv('05', transactionId)
  const payloadWithoutCrc = [
    tlv('00', '01'),
    tlv('01', '11'),
    tlv('26', merchantAccount),
    tlv('52', '0000'),
    tlv('53', '986'),
    tlv('54', numericAmount.toFixed(2)),
    tlv('58', 'BR'),
    tlv('59', merchantName),
    tlv('60', merchantCity),
    tlv('62', additionalData),
    '6304',
  ].join('')
  return `${payloadWithoutCrc}${crc16(payloadWithoutCrc)}`
}
