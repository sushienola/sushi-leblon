module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { nome, email, telefone, endereco, pedido } = req.body;

  if (!nome || !email || !telefone || !endereco || !pedido) {
    return res.status(400).json({ error: 'Campos faltando' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'noreply@sushi-leblon.com',
        to: 'sushienola@gmail.com',
        replyTo: email,
        subject: 'Novo pedido de evento - ' + nome,
        text: 'Nome: ' + nome + '\nEmail: ' + email + '\nTelefone: ' + telefone + '\nEndereço: ' + endereco + '\n\n---\n\n' + pedido
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: 'Erro ao enviar' });
    }

    return res.status(200).json({ success: true, id: data.id });

  } catch (error) {
    return res.status(500).json({ error: 'Erro: ' + error.message });
  }
};
