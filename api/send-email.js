import { Resend } from 'resend';

const resend = new Resend('re_VzGJm45x_35Q2Gwkizy2z7ta1RCorvqp6');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { nome, email, telefone, endereco, pedido } = req.body;

    // Validar campos obrigatórios
    if (!nome || !email || !telefone || !endereco || !pedido) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    // Preparar email
    const assunto = `Novo pedido de evento - ${nome}`;
    const corpo = `
Dados do Cliente:
- Nome: ${nome}
- Email: ${email}
- Telefone: ${telefone}
- Endereço: ${endereco}

---

${pedido}

---

Este é um pedido automático. Responda a este email com sua confirmação.
    `.trim();

    // Enviar via Resend
    const result = await resend.emails.send({
      from: 'noreply@sushi-leblon.com',
      to: 'sushienola@gmail.com',
      replyTo: email,
      subject: assunto,
      text: corpo
    });

    if (result.error) {
      console.error('Erro Resend:', result.error);
      return res.status(500).json({ error: 'Erro ao enviar email' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Pedido enviado com sucesso!',
      id: result.data.id 
    });

  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: 'Erro ao processar pedido' });
  }
}
