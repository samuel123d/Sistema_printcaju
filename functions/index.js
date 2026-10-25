import { randomBytes } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { defineSecret, defineString } from 'firebase-functions/params'
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https'

initializeApp()
const db = getFirestore()
const ML_APP_ID = defineSecret('ML_APP_ID')
const ML_CLIENT_SECRET = defineSecret('ML_CLIENT_SECRET')
const ML_REDIRECT_URI = defineString('ML_REDIRECT_URI', { default: 'https://sistema-de-controle-de.web.app/mercadolivre/callback' })
const REGION = 'southamerica-east1'
const API = 'https://api.mercadolibre.com'

async function workspaceFor(uid) {
  const [profile, owner] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc('_system/owner').get(),
  ])
  const isOwner = owner.exists && owner.data().uid === uid
  if (!isOwner && (!profile.exists || profile.data().role !== 'admin')) {
    throw new HttpsError('permission-denied', 'Apenas administradores podem conectar o Mercado Livre.')
  }
  return owner.exists ? owner.data().uid : uid
}

async function authorizedWorkspace(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Entre no sistema para continuar.')
  return workspaceFor(request.auth.uid)
}

export const startMercadoLivreConnection = onCall({ region: REGION, secrets: [ML_APP_ID] }, async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Entre no sistema para conectar sua conta.')
  const workspaceUid = await workspaceFor(uid)
  const state = randomBytes(32).toString('hex')
  await db.doc(`_oauthStates/${state}`).set({ uid, workspaceUid, createdAt: FieldValue.serverTimestamp(), expiresAt: Date.now() + 10 * 60 * 1000 })
  const url = new URL('https://auth.mercadolivre.com.br/authorization')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', ML_APP_ID.value())
  url.searchParams.set('redirect_uri', ML_REDIRECT_URI.value())
  url.searchParams.set('state', state)
  return { authorizationUrl: url.toString() }
})

export const mercadoLivreCallback = onRequest({ region: REGION, secrets: [ML_APP_ID, ML_CLIENT_SECRET], cors: false }, async (req, res) => {
  const { code, state, error } = req.query
  const finish = (success, message) => res.status(success ? 200 : 400).set('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mercado Livre</title><body style="font:16px system-ui;max-width:520px;margin:12vh auto;padding:24px;color:#25252b"><h1>${success ? 'Conta conectada' : 'Não foi possível conectar'}</h1><p>${message}</p><p>Você pode fechar esta janela e voltar ao sistema.</p></body></html>`)
  try {
    if (error) return finish(false, 'A autorização foi cancelada no Mercado Livre.')
    if (typeof code !== 'string' || typeof state !== 'string') return finish(false, 'O retorno da autorização está incompleto. Tente conectar novamente.')
    const stateRef = db.doc(`_oauthStates/${state}`)
    const stateSnapshot = await stateRef.get()
    if (!stateSnapshot.exists || stateSnapshot.data().expiresAt < Date.now()) return finish(false, 'A solicitação expirou. Volte ao sistema e conecte novamente.')
    const { workspaceUid } = stateSnapshot.data()
    await stateRef.delete()
    const tokenResponse = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: ML_APP_ID.value(), client_secret: ML_CLIENT_SECRET.value(), code, redirect_uri: ML_REDIRECT_URI.value() }),
    })
    const token = await tokenResponse.json()
    if (!tokenResponse.ok || !token.access_token || !token.refresh_token) return finish(false, 'O Mercado Livre não aceitou a autorização. Confira o endereço de retorno cadastrado e tente de novo.')
    await db.doc(`_privateIntegrations/${workspaceUid}`).set({
      provider: 'mercadolivre', sellerId: String(token.user_id), accessToken: token.access_token,
      refreshToken: token.refresh_token, expiresAt: Date.now() + Number(token.expires_in || 21600) * 1000,
      connectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    })
    return finish(true, 'A conta foi autorizada. Volte ao sistema e importe seus anúncios e estoques.')
  } catch (cause) {
    console.error('Falha no retorno OAuth Mercado Livre:', cause)
    return finish(false, 'Ocorreu um erro ao concluir a conexão. Tente novamente pelo sistema.')
  }
})

export const mercadoLivreNotification = onRequest({ region: REGION, cors: false }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')
  const { topic, user_id: userId } = req.body || {}
  console.info('Notificação recebida do Mercado Livre.', {
    topic: typeof topic === 'string' ? topic : 'unknown',
    userId: typeof userId === 'string' || typeof userId === 'number' ? userId : undefined,
  })
  return res.sendStatus(200)
})

async function getAccessToken(integrationRef, integration) {
  if (integration.expiresAt > Date.now() + 60_000) return integration.accessToken
  const response = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: ML_APP_ID.value(), client_secret: ML_CLIENT_SECRET.value(), refresh_token: integration.refreshToken }),
  })
  const token = await response.json()
  if (!response.ok || !token.access_token || !token.refresh_token) throw new HttpsError('failed-precondition', 'A autorização expirou. Desconecte e conecte sua conta novamente.')
  await integrationRef.set({ accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + Number(token.expires_in || 21600) * 1000, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  return token.access_token
}

async function mlGet(url, accessToken) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const body = await response.json()
  if (!response.ok) throw new HttpsError('unavailable', body.message || `O Mercado Livre respondeu com erro ${response.status}.`)
  return body
}

export const getMercadoLivreConnection = onCall({ region: REGION }, async (request) => {
  const workspaceUid = await authorizedWorkspace(request)
  const integration = await db.doc(`_privateIntegrations/${workspaceUid}`).get()
  return integration.exists ? { connected: true, sellerId: integration.data().sellerId, connectedAt: integration.data().connectedAt?.toDate?.().toISOString() || null } : { connected: false }
})

export const syncMercadoLivreProducts = onCall({ region: REGION, secrets: [ML_APP_ID, ML_CLIENT_SECRET], timeoutSeconds: 540, memory: '1GiB' }, async (request) => {
  const workspaceUid = await authorizedWorkspace(request)
  const integrationRef = db.doc(`_privateIntegrations/${workspaceUid}`)
  const integrationSnapshot = await integrationRef.get()
  if (!integrationSnapshot.exists) throw new HttpsError('failed-precondition', 'Conecte sua conta do Mercado Livre primeiro.')
  const integration = integrationSnapshot.data()
  const accessToken = await getAccessToken(integrationRef, integration)

  const itemIds = []
  let scrollId = ''
  do {
    const url = new URL(`${API}/users/${encodeURIComponent(integration.sellerId)}/items/search`)
    url.searchParams.set('search_type', 'scan')
    url.searchParams.set('status', 'active')
    if (scrollId) url.searchParams.set('scroll_id', scrollId)
    const page = await mlGet(url, accessToken)
    itemIds.push(...(page.results || []))
    scrollId = page.scroll_id || ''
    if (!page.scroll_id) break
  } while (itemIds.length < 20_000)

  const productsRef = db.collection(`users/${workspaceUid}/products`)
  const current = await productsRef.get()
  const existingByItemId = new Map(current.docs.filter((item) => item.data().mlItemId).map((item) => [item.data().mlItemId, item]))
  let imported = 0
  for (let offset = 0; offset < itemIds.length; offset += 20) {
    const ids = itemIds.slice(offset, offset + 20)
    const url = new URL(`${API}/items/bulk`)
    url.searchParams.set('ids', ids.join(','))
    url.searchParams.set('attributes', 'body.id,body.title,body.price,body.available_quantity,body.status,body.seller_custom_field,body.category_id,body.permalink,body.variations')
    const results = await mlGet(url, accessToken)
    const batch = db.batch()
    for (const result of results) {
      const item = result.body
      if (result.status_code < 200 || result.status_code >= 300 || !item?.id) continue
      const existing = existingByItemId.get(item.id)
      const productRef = existing?.ref || productsRef.doc()
      const prior = existing?.data() || {}
      const variationStock = Array.isArray(item.variations) && item.variations.length
        ? item.variations.reduce((sum, variation) => sum + (Number(variation.available_quantity) || 0), 0)
        : Number(item.available_quantity) || 0
      batch.set(productRef, {
        ...prior,
        name: item.title || prior.name || item.id,
        sku: item.seller_custom_field || prior.sku || item.id,
        type: 'mercadolivre', mlItemId: item.id, mlStatus: item.status || 'active',
        mlUrl: item.permalink || '', category: item.category_id || prior.category || '',
        quantity: variationStock, price: Number(item.price) || 0,
        cost: Number(prior.cost) || 0, minStock: Number(prior.minStock) || 0,
        description: prior.description || '', active: true,
        inventorySyncedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        ...(!existing ? { createdAt: FieldValue.serverTimestamp() } : {}),
      }, { merge: true })
      imported += 1
    }
    await batch.commit()
  }
  return { imported, sellerId: integration.sellerId, truncated: itemIds.length >= 20_000 }
})
