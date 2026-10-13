(async function () {
  "use strict";
  const sessionId = new URLSearchParams(window.location.search).get("session_id");
  const message = document.getElementById("verification-message");
  const status = document.getElementById("result-status");
  const portalButton = document.getElementById("portal-button");
  const retryButton = document.getElementById("retry-button");

  function withTimeout(operation) {
    let timer;
    const expired = new Promise((_, reject) => {
      timer = window.setTimeout(() => reject(new Error("La conexión de Premium ha tardado demasiado. Vuelve a intentarlo.")), 15000);
    });
    return Promise.race([operation, expired]).finally(() => window.clearTimeout(timer));
  }

  async function authHeaders() {
    const authMode = await withTimeout(window.MomentumVeloAuthReady || Promise.resolve("unavailable"));
    if (authMode !== "managed" || !window.Clerk?.isSignedIn || !window.Clerk.session) {
      throw new Error("Inicia sesión para comprobar o gestionar tu suscripción Premium.");
    }
    const token = await withTimeout(window.Clerk.session.getToken());
    if (!token) throw new Error("Tu sesión ha caducado. Vuelve a iniciar sesión.");
    return { Authorization: `Bearer ${token}` };
  }

  async function verify() {
    if (retryButton.disabled) return;
    retryButton.disabled = true;
    retryButton.setAttribute("aria-busy", "true");
    status.classList.remove("error");
    portalButton.hidden = true;
    try {
      const headers = await authHeaders();
      const response = await withTimeout(fetch(`/api/subscription?session_id=${encodeURIComponent(sessionId)}`, {
        headers, cache: "no-store"
      }));
      const data = await withTimeout(response.json());
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
      retryButton.setAttribute("aria-busy", "false");
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
    if (portalButton.disabled) return;
    portalButton.disabled = true;
    portalButton.textContent = "Abriendo Stripe…";
    portalButton.setAttribute("aria-busy", "true");
    status.classList.remove("error");
    status.textContent = "";
    try {
      const headers = await authHeaders();
      const response = await withTimeout(fetch("/api/portal", {
        method: "POST", headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ sessionId }), cache: "no-store"
      }));
      const data = await withTimeout(response.json());
      if (!response.ok || !data.url) throw new Error(data.error || "No se ha podido abrir el portal.");
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com" || url.port || url.username || url.password) {
        throw new Error("No se recibió una página de gestión segura.");
      }
      window.location.assign(url.href);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "No se ha podido abrir el portal.";
      status.classList.add("error");
      portalButton.disabled = false;
      portalButton.textContent = "Gestionar o cancelar suscripción";
    } finally {
      portalButton.setAttribute("aria-busy", "false");
    }
  });
  await verify();
})();
