const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL_TO || "hola@momentumvelo.ai";

function text(value, limit) {
  return String(value || "").trim().slice(0, limit);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }

  const body = req.body || {};
  if (text(body.website, 100)) return res.status(200).json({ received: true });

  const name = text(body.name, 80);
  const email = text(body.email, 180).toLowerCase();
  const topic = text(body.topic, 80);
  const message = text(body.message, 3000);
  const acceptedPrivacy = body.acceptedPrivacy === true;

  if (name.length < 2 || !validEmail(email) || message.length < 10 || !acceptedPrivacy) {
    return res.status(400).json({
      error: "Revisa tu nombre, correo, consulta y la aceptación de privacidad."
    });
  }

  if (!process.env.RESEND_API_KEY || !process.env.SUPPORT_EMAIL_TO) {
    return res.status(503).json({
      error: "El envío directo está en preparación.",
      contactEmail: SUPPORT_EMAIL
    });
  }

  const subject = `[MomentumVelo] ${topic || "Consulta de ayuda"}`;
  const html = `
    <h2>Nueva consulta de MomentumVelo</h2>
    <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
    <p><strong>Correo:</strong> ${escapeHtml(email)}</p>
    <p><strong>Tema:</strong> ${escapeHtml(topic || "General")}</p>
    <p><strong>Mensaje:</strong></p>
    <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `support-${Buffer.from(`${email}:${topic}:${message}`).toString("base64url").slice(0, 80)}`
      },
      body: JSON.stringify({
        from: process.env.SUPPORT_EMAIL_FROM || "MomentumVelo <onboarding@resend.dev>",
        to: [process.env.SUPPORT_EMAIL_TO],
        reply_to: email,
        subject,
        html
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudo enviar la consulta.");
    return res.status(200).json({ received: true, id: data.id || null });
  } catch (error) {
    console.error("support_email_error", {
      message: error instanceof Error ? error.message : String(error)
    });
    return res.status(502).json({
      error: "No hemos podido enviar la consulta. Puedes escribirnos directamente.",
      contactEmail: SUPPORT_EMAIL
    });
  }
};
