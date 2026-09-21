(async function () {
  const managedAuthEnabled = await (window.MomentumVeloAuthReady || Promise.resolve(false));
  const token = managedAuthEnabled && window.Clerk?.session
    ? await window.Clerk.session.getToken()
    : null;
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const sessionId = new URLSearchParams(window.location.search).get("session_id");
  const message = document.getElementById("verification-message");
  const status = document.getElementById("result-status");
  const telegramLink = document.getElementById("telegram-link");
  const portalButton = document.getElementById("portal-button");
  if (!sessionId) { message.textContent = "No encontramos la referencia del pago."; status.textContent = "Vuelve a la página principal o contacta con soporte."; status.classList.add("error"); return; }
  try {
    const response = await fetch(`/api/subscription?session_id=${encodeURIComponent(sessionId)}`, { headers: authHeaders });
    const data = await response.json();
    if (!response.ok || !data.active) throw new Error(data.error || "No se ha podido verificar el pago.");
    message.textContent = data.email ? `Suscripción activa para ${data.email}.` : "Tu suscripción Premium está activa.";
    status.textContent = data.telegramUrl ? "Ya puedes acceder al canal de alertas Premium." : "Pago confirmado. Te enviaremos el acceso Premium a tu correo.";
    try {
      const accounts = JSON.parse(window.localStorage.getItem("momentumvelo.accounts.v1") || "{}");
      const accountEmail = String(data.email || "").trim().toLowerCase();
      if (accountEmail && accounts[accountEmail]) {
        accounts[accountEmail].plan = "premium";
        accounts[accountEmail].premiumVerifiedAt = new Date().toISOString();
        window.localStorage.setItem("momentumvelo.accounts.v1", JSON.stringify(accounts));
      }
    } catch (_error) {}
    if (data.telegramUrl) { telegramLink.href = data.telegramUrl; telegramLink.hidden = false; }
    portalButton.hidden = false;
  } catch (error) { message.textContent = "Tu pago se ha recibido, pero la verificación está tardando más de lo normal."; status.textContent = error instanceof Error ? error.message : "Vuelve a intentarlo en unos minutos."; status.classList.add("error"); }
  portalButton.addEventListener("click", async () => {
    portalButton.disabled = true; portalButton.textContent = "Abriendo Stripe…";
    try {
      const response = await fetch("/api/portal", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ sessionId }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "No se ha podido abrir el portal.");
      window.location.assign(data.url);
    } catch (error) { status.textContent = error instanceof Error ? error.message : "No se ha podido abrir el portal."; status.classList.add("error"); portalButton.disabled = false; portalButton.textContent = "Gestionar o cancelar suscripción"; }
  });
})();
