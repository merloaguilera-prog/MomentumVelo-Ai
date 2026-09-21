(function () {
  "use strict";

  function loadScript(src, attributes = {}) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.crossOrigin = "anonymous";
      Object.entries(attributes).forEach(([key, value]) => script.setAttribute(key, value));
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error("No se pudo cargar el acceso seguro.")), { once: true });
      document.head.appendChild(script);
    });
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

  async function openCheckout(button) {
    const originalText = button.textContent;
    const status = document.querySelector("[data-premium-status]");
    button.disabled = true;
    button.textContent = "Abriendo pago seguro…";
    if (status) status.textContent = "Preparando Stripe Checkout…";
    try {
      const token = await window.Clerk.session.getToken();
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: primaryEmail(window.Clerk.user) })
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "No se ha podido abrir el pago.");
      window.location.assign(data.url);
    } catch (error) {
      if (status) {
        status.textContent = error instanceof Error ? error.message : "No se ha podido abrir el pago seguro.";
        status.classList.add("error");
      }
      button.disabled = false;
      button.textContent = originalText;
    }
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
      premiumButton.addEventListener("click", () => openCheckout(premiumButton), { once: true });
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
    try {
      const response = await fetch("/api/auth-config", { cache: "no-store" });
      if (!response.ok) return false;
      const config = await response.json();
      const domain = config.enabled && config.publishableKey
        ? clerkDomain(config.publishableKey)
        : "";
      if (!domain) return false;

      await loadScript(`https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js`);
      await loadScript(
        `https://${domain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`,
        { "data-clerk-publishable-key": config.publishableKey }
      );
      await window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });

      updatePublicHeader();
      const managedView = document.querySelector("[data-managed-auth]");
      const localView = document.querySelector("[data-auth-view]");
      if (!managedView) return true;

      if (window.Clerk.isSignedIn) {
        showManagedAccount();
        return true;
      }

      if (localView) localView.hidden = true;
      managedView.hidden = false;
      const mount = managedView.querySelector("[data-clerk-mount]");
      const mode = new URLSearchParams(window.location.search).get("mode");
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
      if (mode === "signup") {
        window.Clerk.mountSignUp(mount, { appearance, signInUrl: "/login?mode=login" });
      } else {
        window.Clerk.mountSignIn(mount, { appearance, signUpUrl: "/login?mode=signup" });
      }
      return true;
    } catch (error) {
      console.warn("managed_auth_unavailable", error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  window.MomentumVeloAuthReady = initializeManagedAuth();
})();
