import { createServer as createHttpServer, request as httpRequest } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import { join, resolve } from 'node:path'
import { X509Certificate } from 'node:crypto'

const cases = [
  ['camera', 'Tirar e enviar uma foto pela câmera'],
  ['gallery', 'Selecionar e enviar JPEG de 2–8 MB pela galeria'],
  ['orientation', 'Conferir fotos em pé e deitadas na galeria'],
  ['eight', 'Selecionar oito fotos e conferir o limite'],
  ['phases', 'Concluir uma O.S. com fotos de antes e depois'],
  ['reconnection', 'Interromper a conexão no envio, reconectar e tentar novamente'],
  ['saved', 'Reabrir a O.S. e conferir as fotos sem duplicação'],
]

export function createMobilePhotoReport(agent, values) {
  const ios = /(?:iPhone|iPad|iPod)/.test(agent)
  const android = /Android ([\d.]+)/.exec(agent)?.[1]
  const safari = ios && /Version\/[\d.]+.*Safari\//.test(agent) && !/(?:CriOS|FxiOS|EdgiOS|OPiOS)\//.test(agent)
  const chrome = Boolean(android) && /Chrome\/[\d.]+/.test(agent)
  return {
    filename: safari ? 'iphone-safari-manual.json' : chrome ? 'android-manual.json' : 'other-manual.json',
    report: {
      recordedAt: new Date().toISOString(), timeZone: 'Europe/Rome',
      browserName: safari ? 'Safari' : chrome ? 'Chrome' : 'unknown',
      browser: (safari ? /Version\/([\d.]+)/ : /Chrome\/([\d.]+)/).exec(agent)?.[1] ?? 'unknown',
      ...(ios ? { ios: /OS ([\d_]+)/.exec(agent)?.[1].replaceAll('_', '.') ?? 'unknown' } : { android: android ?? 'unknown' }),
      secureContext: values.get('secure') === 'true',
      results: Object.fromEntries(cases.map(([id]) => [id, ['pass', 'fail'].includes(values.get(id)) ? values.get(id) : 'not_verified'])),
    },
  }
}

function ipv4(value) {
  const parts = value.replace(/^::ffff:/, '').split('.')
  return parts.length === 4 && parts.every(part => /^\d+$/.test(part) && Number(part) <= 255)
    ? parts.reduce((result, part) => (result << 8) | Number(part), 0) >>> 0 : null
}

export async function startLocalPhotoMobile({ host, localStatus, fixture, appPort, onStop }) {
  const network = Object.values(networkInterfaces()).flat().find(item => item?.address === host && item.family === 'IPv4')
  if (!network || network.internal || !/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    throw new Error('PHOTO_TEST_HOST must be an existing private IPv4 interface.')
  }
  if (!['127.0.0.1', 'localhost'].includes(new URL(localStatus.apiUrl).hostname)) {
    throw new Error('Mobile photo tests require a loopback-only Supabase upstream.')
  }
  const certificate = process.env.PHOTO_TEST_CERT
  const privateKey = process.env.PHOTO_TEST_KEY
  const ca = process.env.PHOTO_TEST_CA
  if (!certificate || !privateKey || !ca) throw new Error('Configure PHOTO_TEST_CERT, PHOTO_TEST_KEY and PHOTO_TEST_CA outside the repository.')
  const [cert, key, caBytes] = await Promise.all([readFile(certificate), readFile(privateKey), readFile(ca)])
  const caDer = new X509Certificate(caBytes).raw
  const origin = `https://${host}:3443`
  const bootstrapOrigin = `http://${host}:3442`
  const mask = ipv4(network.netmask)
  const subnet = ipv4(host) & mask
  const roles = ['limpeza', 'admin', 'secretaria', 'consegna', 'cliente']
  let lastResult = 'Nenhum resultado manual registrado.'

  function allowed(request) {
    const address = ipv4(request.socket.remoteAddress ?? '')
    return address !== null && ((address & mask) === subnet || (address >>> 24) === 127)
  }
  function send(response, status, body, type = 'text/html; charset=utf-8') {
    response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    response.end(body)
  }
  async function form(request) {
    let body = ''
    for await (const chunk of request) {
      body += chunk
      if (body.length > 4096) throw new Error('Form too large')
    }
    return new URLSearchParams(body)
  }
  function page(body) {
    return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fotos — teste local</title><style>body{font:16px system-ui;max-width:680px;margin:24px auto;padding:0 18px;line-height:1.5}button,a.button{display:inline-block;padding:12px;margin:5px;border:1px solid #bbb;border-radius:8px;color:#123;background:#eef;text-decoration:none}label{display:block;margin:18px 0}select{display:block;padding:8px;margin-top:6px}small{color:#555}</style><h1>Fotos — ambiente local de teste</h1><p>Usuários, ordens e fotos deste ambiente estão separados da produção.</p>${body}</html>`
  }
  function proxy(request, response, target, path) {
    const headers = { ...request.headers, host: `${host}:3443`, 'x-forwarded-host': `${host}:3443`, 'x-forwarded-proto': 'https' }
    delete headers['x-forwarded-for']
    const upstreamUrl = new URL(target)
    const upstream = httpRequest({ hostname: upstreamUrl.hostname, port: upstreamUrl.port,
      path, method: request.method, headers }, result => {
      const resultHeaders = { ...result.headers }
      delete resultHeaders['access-control-allow-origin']
      response.writeHead(result.statusCode ?? 502, resultHeaders)
      result.pipe(response)
    })
    upstream.on('error', () => { if (!response.headersSent) send(response, 503, 'Serviço local indisponível.', 'text/plain; charset=utf-8'); else response.end() })
    request.on('aborted', () => upstream.destroy())
    request.pipe(upstream)
  }
  const secure = createHttpsServer({ key, cert }, async (request, response) => {
    try {
      if (!allowed(request) || request.headers.host !== `${host}:3443`) { send(response, 403, 'Acesso local restrito.'); return }
      if (!request.url.startsWith('/') || request.url.startsWith('//')) { send(response, 400, 'Caminho inválido.'); return }
      const path = new URL(request.url, origin).pathname
      if (request.method === 'POST' && path.startsWith('/__photo-test/')) {
        if (request.headers.origin !== origin) { send(response, 403, 'Origem inválida.'); return }
        const values = await form(request)
        if (path === '/__photo-test/login') {
          const role = values.get('role')
          if (!roles.includes(role)) { send(response, 400, 'Perfil inválido.'); return }
          const user = fixture.users.get(role)
          const result = await fetch(`http://127.0.0.1:${appPort}/api/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'x-forwarded-host': `${host}:3443`, 'x-forwarded-proto': 'https' },
            body: JSON.stringify({ email: user.email, password: user.password }),
          })
          if (result.status !== 200) { send(response, 503, 'Login local indisponível.'); return }
          response.writeHead(303, { Location: '/service-orders', 'Set-Cookie': result.headers.getSetCookie(), 'Cache-Control': 'no-store' })
          response.end()
          return
        }
        if (path === '/__photo-test/result') {
          const agent = request.headers['user-agent'] ?? ''
          const { filename, report } = createMobilePhotoReport(agent, values)
          const directory = resolve('artifacts', 'photo-stage-6')
          await mkdir(directory, { recursive: true })
          await writeFile(join(directory, filename), `${JSON.stringify(report, null, 2)}\n`)
          lastResult = `${report.browserName}: ${Object.values(report.results).filter(value => value === 'pass').length}/${cases.length} aprovados.`
          console.log(`[Photo mobile] ${lastResult}`)
        } else if (path === '/__photo-test/stop') {
          send(response, 200, page('<p>Encerrando o ambiente local descartável.</p>'))
          setTimeout(onStop, 100)
          return
        } else { send(response, 404, 'Não encontrado.'); return }
      }
      if (path === '/__photo-test' || path.startsWith('/__photo-test/')) {
        send(response, 200, page(`<p><b>${lastResult}</b></p><form method="post" action="/__photo-test/login">${roles.map(role => `<button name="role" value="${role}">Entrar como ${role}</button>`).join('')}</form><p>Comece como <b>limpeza</b>. Use a O.S. do imóvel <b>Photo reliability local test</b>. Retorne a esta página para registrar o resultado.</p><form method="post" action="/__photo-test/result"><input name="secure" id="secure" type="hidden">${cases.map(([id, label]) => `<label>${label}<select name="${id}"><option value="not_verified">Não testado</option><option value="pass">Passou</option><option value="fail">Falhou</option></select></label>`).join('')}<button>Registrar resultado</button></form><form method="post" action="/__photo-test/stop"><button>Encerrar e remover dados locais de teste</button></form><script>document.getElementById('secure').value=String(window.isSecureContext&&typeof crypto.randomUUID==='function')</script>`))
        return
      }
      if (path.startsWith('/supabase/')) {
        const upstreamPath = request.url.slice('/supabase'.length)
        const permitted = /^\/(rest\/v1\/|storage\/v1\/(object\/|render\/)|auth\/v1\/(token(?:\?|$)|logout(?:\?|$)|user(?:\?|$)|\.well-known\/))/.test(upstreamPath)
        if (!permitted) { send(response, 403, 'Endpoint indisponível no acesso móvel.'); return }
        proxy(request, response, localStatus.apiUrl, upstreamPath)
        return
      }
      proxy(request, response, `http://127.0.0.1:${appPort}`, request.url)
    } catch { send(response, 500, 'Não foi possível concluir a operação local.') }
  })
  const bootstrap = createHttpServer((request, response) => {
    if (!allowed(request) || request.headers.host !== `${host}:3442`) { send(response, 403, 'Acesso local restrito.'); return }
    if (request.method === 'GET' && request.url === '/local-photo-ca.crt') {
      response.setHeader('Content-Disposition', 'attachment; filename="veda-photo-local-ca.crt"')
      send(response, 200, caBytes, 'application/x-x509-ca-cert')
      return
    }
    if (request.method === 'GET' && request.url === '/local-photo-ca.cer') {
      response.setHeader('Content-Disposition', 'inline; filename="veda-photo-local-ca.cer"')
      send(response, 200, caDer, 'application/x-x509-ca-cert')
      return
    }
    if (request.method !== 'GET' || request.url !== '/') { send(response, 404, 'Não encontrado.'); return }
    send(response, 200, page(`<h2>iPhone — usar Safari</h2><ol><li><a href="/local-photo-ca.cer">Baixar o certificado público para iPhone</a> e permitir o download do perfil.</li><li>Abra <b>Ajustes → Perfil Baixado → Instalar</b> e siga as instruções.</li><li>Em <b>Ajustes → Geral → Sobre → Certificados Confiáveis</b>, ative a confiabilidade total do certificado <b>mkcert</b> deste teste.</li></ol><p><a href="https://support.apple.com/pt-br/102390">Instruções oficiais da Apple</a></p><h2>Android — usar Chrome</h2><ol><li><a href="/local-photo-ca.crt">Baixar o certificado público para Android</a>.</li><li>Nas Configurações, busque <b>Instalar certificado</b>, escolha <b>Certificado CA</b> e selecione o arquivo.</li></ol><a class="button" href="${origin}/__photo-test">Abrir o teste com HTTPS</a><p>O endereço deve abrir sem aviso de certificado. Após terminar, remova o certificado de usuário <b>mkcert</b> instalado para este ambiente.</p><small>Esta página HTTP serve somente o certificado público e as instruções. O login e as fotos usam HTTPS. Os resultados de Android e iPhone são registrados separadamente.</small>`))
  })
  await new Promise((yes, no) => { secure.once('error', no); secure.listen(3443, host, yes) })
  try {
    await new Promise((yes, no) => { bootstrap.once('error', no); bootstrap.listen(3442, host, yes) })
  } catch (error) { secure.closeAllConnections(); secure.close(); throw error }
  console.log(`[Photo mobile] Android/iPhone setup: ${bootstrapOrigin}/`)
  console.log(`[Photo mobile] HTTPS test: ${origin}/__photo-test`)
  return {
    publicApiUrl: `${origin}/supabase`,
    close: async () => {
      secure.closeAllConnections(); bootstrap.closeAllConnections()
      await Promise.all([new Promise(yes => secure.close(yes)), new Promise(yes => bootstrap.close(yes))])
    },
  }
}
