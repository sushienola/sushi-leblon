export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { nome, email, telefone, endereco, pedido } = req.body;

    if (!nome || !email || !telefone || !endereco || !pedido) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const assunto = `Novo pedido de evento - ${nome}`;
    const corpo = `Dados do Cliente:
- Nome: ${nome}
- Email: ${email}
- Telefone: ${telefone}
- Endereço: ${endereco}

---

${pedido}

---

Este é um pedido automático. Responda a este email com sua confirmação.`;

    // Chamar Resend API diretamente
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'noreply@sushi-leblon.com',
        to: 'sushienola@gmail.com',
        replyTo: email,
        subject: assunto,
        text: corpo
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro Resend:', data);
      return res.status(500).json({ error: 'Erro ao enviar email' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Pedido enviado com sucesso!',
      id: data.id 
    });

  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: 'Erro ao processar pedido' });
  }
}
