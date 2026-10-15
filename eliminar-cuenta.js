(async function () {
  "use strict";
  const query = selector => document.querySelector(selector);
  const form = query("[data-deletion-form]");
  const status = query("[data-deletion-status]");
  const reauth = query("[data-deletion-reauth]");
  const localForm = query("[data-local-delete-form]");
  let finished = false;
  const loginUrl = "/login?mode=login&returnTo=delete-account";

  function message(node, value, error = false) {
    node.textContent = value;
    node.classList.toggle("error", error);
  }
  function clearLocal() {
    try { return window.MomentumVeloAccountData.clearLocalData([window.localStorage, window.sessionStorage]); }
    catch (_) { return { failed: true }; }
  }
  async function limited(operation) {
    let timer;
    try {
      return await Promise.race([operation, new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error("La respuesta está tardando demasiado. La operación podría seguir en curso. Vuelve a comprobarla antes de intentar otra acción.")), 30000);
      })]);
    } finally { window.clearTimeout(timer); }
  }
  reauth.addEventListener("click", async () => {
    reauth.disabled = true;
    try { await limited(window.Clerk.signOut({ redirectUrl: loginUrl })); }
    catch (_) { message(status, "No hemos podido cerrar la sesión para verificarte. Reintenta la conexión.", true); reauth.disabled = false; }
  });
  localForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!localForm.checkValidity() || !localForm.elements.confirmLocal.checked) { localForm.reportValidity(); return; }
    const result = clearLocal();
    message(query("[data-local-delete-status]"), result.failed
      ? "No se han podido borrar todos los datos. Reintenta o borra los datos de momentumvelo.app desde los ajustes del navegador."
      : "Los datos locales de MomentumVelo de este navegador se han borrado. Tu cuenta y Premium se conservan.", result.failed);
    localForm.reset();
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    if (finished || button.disabled) return;
    if (!form.checkValidity() || form.elements.confirmation.value !== "ELIMINAR" || !form.elements.acceptConsequences.checked) {
      form.reportValidity(); return;
    }
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    message(status, "Comprobando la cuenta y completando la eliminación…");
    try {
      const clerk = window.Clerk;
      if (!clerk?.isSignedIn || !clerk.session || !clerk.user) throw new Error("Identifícate de nuevo antes de continuar.");
      // Refresh the signed verification-age claim; issued-at alone is not proof
      // of recent credentials. The server checks both factors where applicable.
      const token = await limited(clerk.session.getToken({ skipCache: true }));
      if (!token) throw new Error("Tu sesión ha caducado. Vuelve a identificarte.");
      const response = await limited(fetch("/api/delete-account", {
        method: "POST", cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.elements.email.value.trim(), confirmation: form.elements.confirmation.value,
          acceptConsequences: form.elements.acceptConsequences.checked })
      }));
      const data = await limited(response.json());
      if (data.code === "REAUTHENTICATION_REQUIRED" || response.status === 401) reauth.hidden = false;
      if (!response.ok || data.deleted !== true) throw new Error(data.error || "No se ha confirmado la eliminación. Vuelve a intentarlo.");
      finished = true;
      form.hidden = true;
      reauth.hidden = true;
      const cleanup = clearLocal();
      message(status, cleanup.failed
        ? "Tu cuenta se ha eliminado. No se han podido borrar todos los datos locales: usa el botón de esta página o los ajustes del navegador."
        : "Tu cuenta se ha eliminado y los datos locales de este navegador se han borrado. Borra los datos guardados en tus otros dispositivos desde cada uno de ellos.");
      // Account deletion already invalidates sessions. A sign-out transport
      // failure must not turn that confirmed deletion into a false failure.
      try { await limited(clerk.signOut()); } catch (_) { /* account is already deleted */ }
    } catch (error) {
      message(status, error instanceof Error ? error.message : "La eliminación no está confirmada. Vuelve a comprobarla.", true);
    } finally {
      button.disabled = finished;
      button.setAttribute("aria-busy", "false");
    }
  });

  const mode = await (window.MomentumVeloAuthReady || Promise.resolve("unavailable"));
  if (mode !== "managed" || !window.Clerk?.isSignedIn || !window.Clerk.user) {
    query("[data-deletion-access]").hidden = false;
    const unavailable = mode === "unavailable";
    message(status, unavailable ? "El acceso seguro no está disponible. La eliminación de tu cuenta no se ha iniciado. Puedes reintentar el acceso; el borrado local sigue disponible."
      : "Identifícate para comprobar tu cuenta y mostrar la confirmación de eliminación.", unavailable);
    query("[data-deletion-temporary]").hidden = !unavailable || window.location.origin !== "https://momentumvelo.app";
    return;
  }
  const user = window.Clerk.user;
  query("[data-deletion-email]").textContent = user.primaryEmailAddress?.emailAddress || "Tu cuenta identificada";
  form.hidden = false;
  reauth.hidden = false;
  message(status, "Revisa las consecuencias y confirma tu correo. La eliminación solo se inicia cuando envías el formulario.");
})();
