(function () {
  "use strict";
  let premiumSalesEnabled = false;
  let managedTabsReady = false;
  let temporaryAccessAllowed = false;

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
    managedTabsReady = false;
    const connection = document.querySelector("[data-auth-connection]");
    const message = document.querySelector("[data-auth-connection-message]");
    const retry = document.querySelector("[data-auth-retry]");
    if (connection) {
      connection.hidden = false;
      connection.setAttribute("aria-busy", "false");
    }
    if (message) message.textContent = "El registro y el inicio de sesión están temporalmente bloqueados porque no se ha podido conectar con Clerk. Pulsa Reintentar conexión; no se ha creado ninguna cuenta local de prueba ni se ha realizado ningún cobro.";
    if (retry) retry.hidden = false;
    const temporary = document.querySelector("[data-auth-temporary]");
    const temporaryLink = document.querySelector("[data-auth-temporary-link]");
    // Offer an explicit route to the same Clerk application, never an automatic
    // cross-origin redirect or a destination supplied by query parameters.
    if (temporaryAccessAllowed && temporary && temporaryLink && window.location.origin === "https://momentumvelo.app") {
      const mode = new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "login";
      temporaryLink.href = `https://momentum-velo.vercel.app/login?mode=${mode}`;
      temporaryLink.textContent = mode === "signup" ? "Crear cuenta en el acceso temporal" : "Entrar en el acceso temporal";
      temporary.hidden = false;
    }
    document.querySelectorAll("[data-auth-view], [data-managed-auth], [data-account-view]").forEach((view) => {
      view.hidden = true;
    });
    const canUseTemporary = temporaryAccessAllowed && temporary && temporaryLink && window.location.origin === "https://momentumvelo.app";
    if (canUseTemporary && message) {
      message.textContent += " Los botones Crear cuenta gratis e Iniciar sesión abren el acceso temporal de MomentumVelo.";
    }
    document.querySelectorAll("[data-auth-mode]").forEach((tab) => {
      tab.disabled = !canUseTemporary;
      if (!canUseTemporary) return;
      const mode = tab.dataset.authMode === "signup" ? "signup" : "login";
      tab.setAttribute("title", "Abrir el acceso temporal de MomentumVelo");
      tab.addEventListener("click", () => {
        // Navigation is explicit and carries only a fixed mode. Never forward
        // emails, tokens, payment references or arbitrary redirect parameters.
        window.location.assign(`https://momentum-velo.vercel.app/login?mode=${mode}`);
      });
    });
  }

  function finishConnection() {
    managedTabsReady = true;
    const temporary = document.querySelector("[data-auth-temporary]");
    if (temporary) temporary.hidden = true;
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

  async function startPremium(button) {
    if (button.disabled) return;
    const status = document.querySelector("[data-premium-status]");
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Preparando pago seguro…";
    button.setAttribute("aria-busy", "true");
    if (status) { status.textContent = ""; status.classList.remove("error"); }
    try {
      if (!premiumSalesEnabled || !window.Clerk?.isSignedIn || !window.Clerk.session) {
        throw new Error("Inicia sesión para activar Premium.");
      }
      const token = await withTimeout(window.Clerk.session.getToken());
      if (!token) throw new Error("Tu sesión ha caducado. Vuelve a iniciar sesión.");
      const response = await withTimeout(fetch("/api/checkout", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}", cache: "no-store"
      }));
      const data = await withTimeout(response.json());
      if (data.manageSubscription) {
        const portal = document.querySelector("[data-manage-subscription]");
        if (portal) portal.hidden = false;
      }
      if (!response.ok || !data.url) throw new Error(data.error || "No se pudo preparar la contratación de Premium.");
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.port || url.username || url.password) {
        throw new Error("No se recibió una página de pago segura.");
      }
      window.location.assign(url.href);
    } catch (error) {
      if (status) { status.textContent = error instanceof Error ? error.message : "No se pudo abrir el pago."; status.classList.add("error"); }
      button.disabled = false;
      button.textContent = originalText;
    } finally {
      button.setAttribute("aria-busy", "false");
    }
  }

  async function openPortal(button) {
    if (button.disabled) return;
    const originalText = button.textContent;
    const status = document.querySelector("[data-premium-status]");
    button.disabled = true;
    button.textContent = "Abriendo gestión segura…";
    button.setAttribute("aria-busy", "true");
    if (status) { status.textContent = ""; status.classList.remove("error"); }
    try {
      if (!window.Clerk?.isSignedIn || !window.Clerk.session) {
        throw new Error("Inicia sesión para gestionar Premium.");
      }
      const token = await withTimeout(window.Clerk.session.getToken());
      if (!token) throw new Error("Tu sesión ha caducado. Vuelve a iniciar sesión.");
      const response = await withTimeout(fetch("/api/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}", cache: "no-store"
      }));
      const data = await withTimeout(response.json());
      if (!response.ok || !data.url) throw new Error(data.error || "No se ha podido abrir la gestión de Premium.");
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com" || url.port || url.username || url.password) {
        throw new Error("No se recibió una página de gestión segura.");
      }
      window.location.assign(url.href);
    } catch (error) {
      if (status) {
        status.textContent = error instanceof Error ? error.message : "No se ha podido abrir la gestión de Premium.";
        status.classList.add("error");
      }
      button.disabled = false;
      button.textContent = originalText;
    } finally {
      button.setAttribute("aria-busy", "false");
    }
  }

  async function closeSession(button) {
    if (button.disabled) return;
    const originalText = button.textContent;
    const status = document.querySelector("[data-premium-status]");
    button.disabled = true;
    button.textContent = "Cerrando sesión…";
    button.setAttribute("aria-busy", "true");
    if (status) { status.textContent = ""; status.classList.remove("error"); }
    try {
      await withTimeout(window.Clerk.signOut({ redirectUrl: "/" }));
    } catch (error) {
      if (status) {
        status.textContent = error instanceof Error ? error.message : "No se ha podido cerrar la sesión. Vuelve a intentarlo.";
        status.classList.add("error");
      }
      button.disabled = false;
      button.textContent = originalText;
    } finally {
      button.setAttribute("aria-busy", "false");
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
    const billingStatus = user.publicMetadata?.premiumStatus;
    const paymentPending = plan !== "premium" && ["past_due", "unpaid", "incomplete"].includes(billingStatus);
    const hasOngoingSubscription = ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(billingStatus);
    const freeBillingMessages = {
      active: "Tienes una suscripción vinculada. Revisa su estado desde la gestión de Premium antes de iniciar otra contratación.",
      trialing: "Tu suscripción está en periodo de prueba. Puedes consultar su estado desde la gestión de Premium.",
      paused: "Tu suscripción Premium está en pausa. Puedes revisar sus opciones desde la gestión de tu suscripción."
    };
    const freeBillingPlans = {
      active: "Trader · Premium por confirmar",
      trialing: "Trader · Premium en periodo de prueba",
      paused: "Trader · Premium en pausa"
    };
    // Billing management remains available after access is suspended or canceled.
    // The API verifies the user and their private Stripe customer ID before opening it.
    const hasBillingHistory = hasOngoingSubscription || ["incomplete_expired", "canceled"].includes(billingStatus);
    document.querySelector("[data-account-title]").textContent = `Hola, ${name}`;
    document.querySelector("[data-account-message]").textContent = plan === "premium"
      ? "Tu suscripción Premium está activa y vinculada a esta cuenta."
      : paymentPending
        ? "Tu pago de Premium está pendiente. Puedes revisarlo o actualizar el método de pago desde la gestión de tu suscripción."
        : freeBillingMessages[billingStatus] || "Has iniciado sesión correctamente en tu cuenta gratuita.";
    document.querySelector("[data-account-email]").textContent = primaryEmail(user);
    document.querySelector("[data-account-plan]").textContent = plan === "premium"
      ? "Premium · 49 €/mes"
      : paymentPending ? "Trader · Premium pendiente de pago" : freeBillingPlans[billingStatus] || "Trader · 0 €/mes";

    const premiumButton = accountView.querySelector("[data-premium-next]");
    if (premiumButton) {
      premiumButton.hidden = plan === "premium" || hasOngoingSubscription;
      premiumButton.textContent = premiumSalesEnabled ? "Activar Premium · 49 €/mes" : "Premium · en preparación";
      premiumButton.setAttribute("aria-label", premiumSalesEnabled ? "Abrir el pago seguro de Premium, 49 euros al mes" : "Consultar el estado de Premium");
      premiumButton.addEventListener("click", () => premiumSalesEnabled
        ? startPremium(premiumButton) : showPremiumPreparation(premiumButton));
    }

    const portalButton = accountView.querySelector("[data-manage-subscription]");
    if (portalButton) {
      portalButton.hidden = plan !== "premium" && !hasBillingHistory;
      if (paymentPending) portalButton.textContent = "Revisar pago de Premium";
      portalButton.addEventListener("click", () => openPortal(portalButton));
    }

    const signoutButton = accountView.querySelector("[data-signout]");
    if (signoutButton) {
      signoutButton.addEventListener("click", () => closeSession(signoutButton));
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
      premiumSalesEnabled = config.premiumSalesEnabled === true;
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

      // Keep the old route available only for the existing proxied instance.
      // A new direct instance must never send a failed login to another app.
      const proxyEnabled = config.proxyEnabled !== false;
      temporaryAccessAllowed = proxyEnabled;
      if (!proxyEnabled && domain !== "clerk.momentumvelo.app"
          && !/^[a-z0-9-]+\.clerk\.accounts\.dev$/.test(domain)) {
        throw new Error("El dominio del acceso seguro no es válido.");
      }
      const proxyUrl = proxyEnabled ? new URL("/__clerk", window.location.origin).href : null;
      const sdkUrl = proxyUrl || `https://${domain}`;
      await loadScript(`${sdkUrl}/npm/@clerk/ui@1/dist/ui.browser.js`);
      await loadScript(
        `${sdkUrl}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`,
        { "data-clerk-publishable-key": config.publishableKey,
          ...(proxyUrl ? { "data-clerk-proxy-url": proxyUrl } : {}) }
      );
      // ClerkJS reads proxyUrl when its script creates the Clerk instance, before load().
      await withTimeout(window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } }));

      updatePublicHeader();
      const managedView = document.querySelector("[data-managed-auth]");
      const localView = document.querySelector("[data-auth-view]");
      if (!managedView) return "managed";

      if (window.Clerk.isSignedIn) {
        if (new URLSearchParams(window.location.search).get("returnTo") === "delete-account") {
          window.location.assign("/eliminar-cuenta");
          finishConnection();
          return "managed";
        }
        showManagedAccount();
        finishConnection();
        return "managed";
      }

      if (localView) localView.hidden = true;
      managedView.hidden = false;
      const mount = managedView.querySelector("[data-clerk-mount]");
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("mode");
      // A fixed destination only: query parameters never supply redirect URLs.
      const deletionReturn = params.get("returnTo") === "delete-account" ? "/eliminar-cuenta" : null;
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
          if (!managedTabsReady) return;
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
        window.Clerk.mountSignUp(mount, { appearance, signInUrl: deletionReturn ? "/login?mode=login&returnTo=delete-account" : "/login?mode=login",
          ...(deletionReturn ? { forceRedirectUrl: deletionReturn, signInForceRedirectUrl: deletionReturn } : {}) });
      } else {
        window.Clerk.mountSignIn(mount, { appearance, signUpUrl: deletionReturn ? "/login?mode=signup&returnTo=delete-account" : "/login?mode=signup",
          ...(deletionReturn ? { forceRedirectUrl: deletionReturn, signUpForceRedirectUrl: deletionReturn } : {}) });
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
