module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Use POST' });
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: 'RESEND_API_KEY nao configurada no Vercel' });
    }

    // Ler o corpo na mao (nao depende do parser do Vercel)
    var body = req.body;
    if (!body || typeof body === 'string') {
      var raw = '';
      if (typeof body === 'string') {
        raw = body;
      } else {
        raw = await new Promise(function (resolve, reject) {
          var d = '';
          req.on('data', function (c) { d += c; });
          req.on('end', function () { resolve(d); });
          req.on('error', reject);
        });
      }
      try { body = JSON.parse(raw || '{}'); } catch (e) { body = {}; }
    }

    var nome = body.nome || '';
    var email = body.email || '';
    var telefone = body.telefone || '';
    var endereco = body.endereco || '';
    var pedido = body.pedido || '';

    if (!nome || !email || !telefone || !endereco || !pedido) {
      return res.status(400).json({ error: 'Campos obrigatorios faltando' });
    }

    var texto =
      'Nome: ' + nome + '\n' +
      'Email: ' + email + '\n' +
      'Telefone: ' + telefone + '\n' +
      'Endereco: ' + endereco + '\n\n' +
      '----------------------------------------\n\n' +
      pedido;

    var r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Sushi Leblon <onboarding@resend.dev>',
        to: ['sushienola@gmail.com'],
        reply_to: email,
        subject: 'Novo pedido de evento - ' + nome,
        text: texto
      })
    });

    var texto_resposta = await r.text();
    var dados;
    try { dados = JSON.parse(texto_resposta); } catch (e) { dados = { raw: texto_resposta }; }

    if (!r.ok) {
      // Devolve o motivo real do Resend, para aparecer na tela
      return res.status(500).json({
        error: 'Resend recusou: ' + (dados.message || dados.name || texto_resposta)
      });
    }

    return res.status(200).json({ success: true, id: dados.id });

  } catch (e) {
    return res.status(500).json({ error: 'Falha: ' + (e && e.message ? e.message : String(e)) });
  }
};
