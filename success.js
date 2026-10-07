(async function () {
  "use strict";
  const authMode = await (window.MomentumVeloAuthReady || Promise.resolve("unavailable"));
  const sessionId = new URLSearchParams(window.location.search).get("session_id");
  const message = document.getElementById("verification-message");
  const status = document.getElementById("result-status");
  const portalButton = document.getElementById("portal-button");
  const retryButton = document.getElementById("retry-button");

  async function authHeaders() {
    const token = authMode === "managed" && window.Clerk?.session
      ? await window.Clerk.session.getToken()
      : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function verify() {
    retryButton.disabled = true;
    status.classList.remove("error");
    portalButton.hidden = true;
    try {
      const response = await fetch(`/api/subscription?session_id=${encodeURIComponent(sessionId)}`, {
        headers: await authHeaders(), cache: "no-store"
      });
      const data = await response.json();
      if (response.status === 202 && data.pending) {
        message.textContent = "Tu pago está pendiente de confirmación.";
        status.textContent = data.message;
        retryButton.hidden = false;
        return;
      }
      if (!response.ok || !data.active) throw new Error(data.error || "No se ha podido verificar el pago.");
      message.textContent = data.email ? `Suscripción activa para ${data.email}.` : "Tu suscripción Premium está activa.";
      status.textContent = "Pago confirmado. Tu suscripción Premium figura como activa en Stripe.";
      portalButton.hidden = false;
      retryButton.hidden = true;
    } catch (error) {
      message.textContent = "No hemos podido confirmar todavía el estado de la suscripción.";
      status.textContent = error instanceof Error ? error.message : "Vuelve a intentarlo en unos minutos.";
      status.classList.add("error");
      retryButton.hidden = false;
    } finally {
      retryButton.disabled = false;
    }
  }

  if (!sessionId) {
    message.textContent = "No encontramos la referencia del pago.";
    status.textContent = "Vuelve a la página principal o contacta con soporte.";
    status.classList.add("error");
    return;
  }
  retryButton.addEventListener("click", verify);
  portalButton.addEventListener("click", async () => {
    portalButton.disabled = true;
    portalButton.textContent = "Abriendo Stripe…";
    try {
      const response = await fetch("/api/portal", {
        method: "POST", headers: { "Content-Type": "application/json", ...await authHeaders() },
        body: JSON.stringify({ sessionId })
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "No se ha podido abrir el portal.");
      window.location.assign(data.url);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "No se ha podido abrir el portal.";
      status.classList.add("error");
      portalButton.disabled = false;
      portalButton.textContent = "Gestionar o cancelar suscripción";
    }
  });
  await verify();
})();
