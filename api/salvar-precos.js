// api/salvar-precos.js
// Painel de preços: lê e grava o index.html direto no GitHub.
// Depois de gravar, o Vercel publica sozinho (cerca de 1 minuto).
//
// Variáveis de ambiente no Vercel:
//   ADMIN_SENHA   (obrigatória) senha do painel
//   GITHUB_TOKEN  (obrigatória) token do GitHub com permissão "Contents: Read and write"
//   GITHUB_REPO   (opcional)    "usuario/repositorio" — se faltar, usa o repositório ligado ao Vercel
//   GITHUB_BRANCH (opcional)    padrão: o branch publicado, ou "main"
//   GITHUB_PATH   (opcional)    padrão: "index.html"

var crypto = require('crypto');

var INICIO = 'const CONFIG = {';
var FIM = '\n};';

function senhaOk(recebida) {
  var certa = process.env.ADMIN_SENHA || '';
  if (!certa || typeof recebida !== 'string') return false;
  var a = crypto.createHash('sha256').update(recebida).digest();
  var b = crypto.createHash('sha256').update(certa).digest();
  return crypto.timingSafeEqual(a, b);
}

async function lerCorpo(req) {
  var body = req.body;
  if (body && typeof body === 'object') return body;
  var raw = typeof body === 'string' ? body : await new Promise(function (resolve, reject) {
    var d = '';
    req.on('data', function (c) { d += c; });
    req.on('end', function () { resolve(d); });
    req.on('error', reject);
  });
  try { return JSON.parse(raw || '{}'); } catch (e) { return {}; }
}

function repoInfo() {
  var repo = process.env.GITHUB_REPO ||
    (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
      ? process.env.VERCEL_GIT_REPO_OWNER + '/' + process.env.VERCEL_GIT_REPO_SLUG
      : '');
  return {
    repo: repo,
    branch: process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'main',
    path: process.env.GITHUB_PATH || 'index.html'
  };
}

function gh(url, opts) {
  opts = opts || {};
  opts.headers = Object.assign({
    'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'sushi-leblon-painel'
  }, opts.headers || {});
  return fetch(url, opts);
}

async function lerArquivo(info) {
  var url = 'https://api.github.com/repos/' + info.repo + '/contents/' +
    encodeURI(info.path) + '?ref=' + encodeURIComponent(info.branch) + '&t=' + Date.now();
  var r = await gh(url);
  var d = await r.json().catch(function () { return {}; });
  if (!r.ok) throw new Error('GitHub (leitura) ' + r.status + ': ' + (d.message || ''));
  return { html: Buffer.from(d.content || '', 'base64').toString('utf8'), sha: d.sha, url: url.split('?')[0] };
}

module.exports = async function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
    if (!process.env.ADMIN_SENHA) return res.status(500).json({ error: 'ADMIN_SENHA não configurada no Vercel' });

    var body = await lerCorpo(req);

    if (!senhaOk(body.senha)) {
      await new Promise(function (r) { setTimeout(r, 800); }); // freia tentativas de adivinhar
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    if (body.acao === 'entrar') return res.status(200).json({ ok: true });

    if (!process.env.GITHUB_TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN não configurado no Vercel' });
    var info = repoInfo();
    if (!info.repo) return res.status(500).json({ error: 'GITHUB_REPO não configurado no Vercel' });

    if (body.acao === 'ler') {
      var atual = await lerArquivo(info);
      return res.status(200).json({ html: atual.html });
    }

    if (body.acao === 'salvar') {
      var config = String(body.config || '');

      // Conferências: o bloco novo precisa ter o formato certo e nada perigoso
      if (config.indexOf(INICIO) !== 0 ||
          config.indexOf(FIM) !== config.length - FIM.length ||
          /<\/script/i.test(config) ||
          config.length > 200000) {
        return res.status(400).json({ error: 'Configuração inválida, nada foi salvo' });
      }

      var arq = await lerArquivo(info);
      var i = arq.html.indexOf(INICIO);
      var j = arq.html.indexOf(FIM, i);
      if (i < 0 || j < 0) return res.status(500).json({ error: 'CONFIG não encontrado no index.html do GitHub' });

      var novo = arq.html.slice(0, i) + config + arq.html.slice(j + FIM.length);
      if (novo === arq.html) return res.status(200).json({ ok: true, semMudanca: true });

      var put = await gh(arq.url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Painel: preços atualizados',
          content: Buffer.from(novo, 'utf8').toString('base64'),
          sha: arq.sha,
          branch: info.branch
        })
      });
      var pd = await put.json().catch(function () { return {}; });
      if (put.status === 409) return res.status(409).json({ error: 'O arquivo mudou enquanto você editava. Recarregue a página e tente de novo.' });
      if (!put.ok) return res.status(500).json({ error: 'GitHub (gravação) ' + put.status + ': ' + (pd.message || '') });

      return res.status(200).json({ ok: true, commit: pd.commit && pd.commit.sha });
    }

    return res.status(400).json({ error: 'Ação desconhecida' });
  } catch (e) {
    return res.status(500).json({ error: 'Falha: ' + (e && e.message ? e.message : String(e)) });
  }
};
