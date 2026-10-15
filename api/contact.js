const { createHash } = require("node:crypto");
  const { authorizedParties } = require("./_clerk");
  const text = value => typeof value === "string" ? value.trim() : "";
  const validEmail = value => /^[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+$/.test(value);
  function contactConfigured() {
    const sender = text(process.env.SUPPORT_EMAIL_FROM);
    const senderEmail = sender.includes("<") ? /^.*<([^<>]+)>$/.exec(sender)?.[1] : sender;
    return Boolean(process.env.RESEND_API_KEY && validEmail(text(process.env.SUPPORT_EMAIL_TO))
      && !/[\r\n]/.test(sender) && senderEmail && validEmail(senderEmail));
  }
  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[character]);
  }
  module.exports = async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    // Availability never exposes the private sender, recipient or credential.
    if (req.method === "GET") return res.status(200).json({ available: contactConfigured() });
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Método no permitido." });
    }
    const headers = req.headers || {};
    if (!authorizedParties().includes(headers.origin) || headers["sec-fetch-site"] === "cross-site") {
      return res.status(403).json({ error: "Abre el formulario de ayuda de MomentumVelo para enviar tu consulta." });
    }
    if (String(headers["content-type"] || "").split(";")[0].trim().toLowerCase() !== "application/json") {
      return res.status(415).json({ error: "Envía la consulta desde el formulario de ayuda." });
    }
    const body = req.body || {};
    if (text(body.website)) return res.status(200).json({ received: false, ignored: true });
    const name=text(body.name), email=text(body.email).toLowerCase(), topic=text(body.topic), message=text(body.message);
    if (name.length<2 || name.length>80 || !validEmail(email) || email.length>180 || topic.length>80
        || message.length<10 || message.length>3000 || body.acceptedPrivacy!==true) {
      return res.status(400).json({ error: "Revisa tu nombre, correo, consulta y la aceptación de privacidad." });
    }
    if (!contactConfigured()) return res.status(503).json({
      available:false, error:"El envío de consultas todavía no está disponible. Conserva tu texto como borrador."
    });
    const html = `<h2>Nueva consulta de MomentumVelo</h2>
      <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
      <p><strong>Correo:</strong> ${escapeHtml(email)}</p>
      <p><strong>Tema:</strong> ${escapeHtml(topic || "General")}</p>
      <p><strong>Mensaje:</strong></p><p>${escapeHtml(message).replace(/\n/g,"<br>")}</p>`;
    const emailBody=JSON.stringify({
      from:text(process.env.SUPPORT_EMAIL_FROM),to:[text(process.env.SUPPORT_EMAIL_TO)],reply_to:email,
      subject:`[MomentumVelo] ${topic || "Consulta de ayuda"}`,html
    });
    const idempotencyKey=`support-${createHash("sha256").update(emailBody).digest("hex")}`;
    let providerStatus=null;
    try {
      const response=await fetch("https://api.resend.com/emails",{
        method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":idempotencyKey},
        body:emailBody,signal:AbortSignal.timeout(10000)
      });
      providerStatus=response.status;
      const data=await response.json();
      if (!response.ok || typeof data?.id!=="string" || !/^[A-Za-z0-9_-]{8,128}$/.test(data.id)) throw new Error("provider_not_confirmed");
      return res.status(200).json({received:true,status:"accepted",id:data.id});
    } catch (_) {
      console.warn("support_email_not_confirmed",{status:Number.isInteger(providerStatus)?providerStatus:null});
      return res.status(502).json({error:"El envío no se ha confirmado. Conservamos el texto en el formulario. Puedes guardar un borrador o reintentar la misma consulta."});
    }
  };
