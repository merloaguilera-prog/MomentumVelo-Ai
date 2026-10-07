(function () {
  "use strict";

  function withTimeout(operation) {
    let timeout;
    const expired = new Promise((_, reject) => {
      timeout = window.setTimeout(() => reject(new Error("La conexión de acceso seguro ha tardado demasiado.")), 15000);
    });
    return Promise.race([operation, expired]).finally(() => window.clearTimeout(timeout));
  }

  function loadScript(src, attributes = {}) {
    return withTimeout(new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.crossOrigin = "anonymous";
      Object.entries(attributes).forEach(([key, value]) => script.setAttribute(key, value));
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error("No se pudo cargar el acceso seguro.")), { once: true });
      document.head.appendChild(script);
    }));
  }

  function showConnectionError() {
    const connection = document.querySelector("[data-auth-connection]");
    const message = document.querySelector("[data-auth-connection-message]");
    const retry = document.querySelector("[data-auth-retry]");
    if (connection) {
      connection.hidden = false;
      connection.setAttribute("aria-busy", "false");
    }
    if (message) message.textContent = "No hemos podido conectar con el acceso seguro. Reintenta la conexión o consulta la ayuda. No se ha creado ninguna cuenta local de prueba.";
    if (retry) retry.hidden = false;
    document.querySelectorAll("[data-auth-view], [data-managed-auth], [data-account-view]").forEach((view) => {
      view.hidden = true;
    });
    document.querySelectorAll("[data-auth-mode]").forEach((tab) => { tab.disabled = true; });
  }

  function finishConnection() {
    const connection = document.querySelector("[data-auth-connection]");
    if (connection) {
      connection.hidden = true;
      connection.setAttribute("aria-busy", "false");
    }
    document.querySelectorAll("[data-auth-mode]").forEach((tab) => { tab.disabled = false; });
  }

  function clerkDomain(publishableKey) {
    try {
      return window.atob(publishableKey.split("_")[2]).slice(0, -1);
    } catch (_error) {
      return "";
    }
  }

  function primaryEmail(user) {
    return user?.primaryEmailAddress?.emailAddress
      || user?.emailAddresses?.[0]?.emailAddress
      || "Cuenta verificada";
  }

  function showPremiumPreparation(button) {
    const status = document.querySelector("[data-premium-status]");
    button.disabled = true;
    if (status) {
      status.textContent = "Premium está en preparación. Te llevamos a la información actual antes de abrir la contratación.";
      status.classList.remove("error");
    }
    window.setTimeout(() => {
      window.location.href = "/ayuda?tema=premium#contacto";
    }, 450);
  }

  async function openPortal(button) {
    const originalText = button.textContent;
    const status = document.querySelector("[data-premium-status]");
    button.disabled = true;
    button.textContent = "Abriendo gestión segura…";
    try {
      const token = await window.Clerk.session.getToken();
      const response = await fetch("/api/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}"
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "No se ha podido abrir la gestión de Premium.");
      window.location.assign(data.url);
    } catch (error) {
      if (status) {
        status.textContent = error instanceof Error ? error.message : "No se ha podido abrir la gestión de Premium.";
        status.classList.add("error");
      }
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function showManagedAccount() {
    const user = window.Clerk.user;
    const accountView = document.querySelector("[data-account-view]");
    const localView = document.querySelector("[data-auth-view]");
    const managedView = document.querySelector("[data-managed-auth]");
    if (!user || !accountView) return;

    if (localView) localView.hidden = true;
    if (managedView) managedView.hidden = true;
    accountView.hidden = false;
    document.body.classList.add("is-account");

    const name = user.firstName || user.fullName || "de nuevo";
    const plan = user.publicMetadata?.plan === "premium" ? "premium" : "free";
    document.querySelector("[data-account-title]").textContent = `Hola, ${name}`;
    document.querySelector("[data-account-message]").textContent = plan === "premium"
      ? "Tu suscripción Premium está activa y vinculada a esta cuenta."
      : "Has iniciado sesión correctamente en tu cuenta gratuita.";
    document.querySelector("[data-account-email]").textContent = primaryEmail(user);
    document.querySelector("[data-account-plan]").textContent = plan === "premium"
      ? "Premium · 49 €/mes"
      : "Trader · 0 €/mes";

    const premiumButton = accountView.querySelector("[data-premium-next]");
    if (premiumButton) {
      premiumButton.hidden = plan === "premium";
      premiumButton.addEventListener("click", () => showPremiumPreparation(premiumButton), { once: true });
    }

    const portalButton = accountView.querySelector("[data-manage-subscription]");
    if (portalButton) {
      portalButton.hidden = plan !== "premium";
      portalButton.addEventListener("click", () => openPortal(portalButton), { once: true });
    }

    const signoutButton = accountView.querySelector("[data-signout]");
    if (signoutButton) {
      signoutButton.addEventListener("click", async () => {
        await window.Clerk.signOut({ redirectUrl: "/" });
      }, { once: true });
    }
  }

  function updatePublicHeader() {
    const user = window.Clerk?.user;
    if (!user) return;
    const authLink = document.querySelector("[data-auth-link]");
    const signupLink = document.querySelector("[data-signup-link]");
    const name = user.firstName || "Mi cuenta";
    if (authLink) {
      authLink.textContent = `Hola, ${name}`;
      authLink.href = "/login?mode=account";
    }
    if (signupLink) {
      signupLink.textContent = "Entrar en mi cuenta";
      signupLink.href = "/login?mode=account";
    }
  }

  async function initializeManagedAuth() {
    const retry = document.querySelector("[data-auth-retry]");
    if (retry) retry.addEventListener("click", () => window.location.reload());
    try {
      const response = await withTimeout(fetch("/api/auth-config", { cache: "no-store" }));
      if (!response.ok) throw new Error("No se pudo consultar la configuración de acceso seguro.");
      const config = await withTimeout(response.json());
      // Only an explicitly unconfigured instance may use the local demo.
      // An outage or a partial Clerk configuration must never create local accounts.
      if (config.enabled === false && !config.publishableKey) {
        finishConnection();
        const localView = document.querySelector("[data-auth-view]");
        if (localView) localView.hidden = false;
        return "demo";
      }
      const domain = config.enabled && config.publishableKey
        ? clerkDomain(config.publishableKey)
        : "";
      if (!domain) throw new Error("La configuración de acceso seguro está incompleta.");

      const proxyUrl = new URL("/__clerk", window.location.origin).href;
      await loadScript(`${proxyUrl}/npm/@clerk/ui@1/dist/ui.browser.js`);
      await loadScript(
        `${proxyUrl}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`,
        { "data-clerk-publishable-key": config.publishableKey, "data-clerk-proxy-url": proxyUrl }
      );
      // ClerkJS reads proxyUrl when its script creates the Clerk instance, before load().
      await withTimeout(window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } }));

      updatePublicHeader();
      const managedView = document.querySelector("[data-managed-auth]");
      const localView = document.querySelector("[data-auth-view]");
      if (!managedView) return "managed";

      if (window.Clerk.isSignedIn) {
        showManagedAccount();
        finishConnection();
        return "managed";
      }

      if (localView) localView.hidden = true;
      managedView.hidden = false;
      const mount = managedView.querySelector("[data-clerk-mount]");
      const mode = new URLSearchParams(window.location.search).get("mode");
      const activeMode = mode === "signup" ? "signup" : "login";
      mount.id = "managed-auth-mount";
      mount.setAttribute("role", "tabpanel");
      mount.setAttribute("aria-labelledby", `${activeMode}-tab`);
      document.querySelectorAll("[data-auth-mode]").forEach((tab) => {
        const selected = tab.dataset.authMode === activeMode;
        tab.classList.toggle("is-active", selected);
        tab.setAttribute("aria-selected", String(selected));
        tab.setAttribute("aria-controls", mount.id);
        tab.tabIndex = 0;
        tab.addEventListener("click", () => {
          if (tab.dataset.authMode === activeMode) return;
          const url = new URL(window.location.href);
          url.searchParams.set("mode", tab.dataset.authMode);
          if (tab.dataset.authMode === "login") url.searchParams.delete("plan");
          window.location.assign(url.href);
        });
      });
      const appearance = {
        variables: {
          colorPrimary: "#25e683",
          colorBackground: "#0f151b",
          colorText: "#f4f7f8",
          colorInputBackground: "#080c10",
          colorInputText: "#f4f7f8",
          borderRadius: "0.75rem"
        }
      };
      if (activeMode === "signup") {
        window.Clerk.mountSignUp(mount, { appearance, signInUrl: "/login?mode=login" });
      } else {
        window.Clerk.mountSignIn(mount, { appearance, signUpUrl: "/login?mode=signup" });
      }
      finishConnection();
      return "managed";
    } catch (error) {
      console.warn("managed_auth_unavailable", error instanceof Error ? error.message : String(error));
      showConnectionError();
      return "unavailable";
    }
  }

  window.MomentumVeloAuthReady = initializeManagedAuth();
})();
