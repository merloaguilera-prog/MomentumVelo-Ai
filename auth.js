(async function () {
  "use strict";

  const managedAuthEnabled = await (window.MomentumVeloAuthReady || Promise.resolve(false));
  if (managedAuthEnabled) return;

  const ACCOUNTS_KEY = "momentumvelo.accounts.v1";
  const SESSION_KEY = "momentumvelo.session.v1";
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const authView = document.querySelector("[data-auth-view]");
  const accountView = document.querySelector("[data-account-view]");
  const title = document.querySelector("[data-auth-title]");
  const eyebrow = document.querySelector("[data-auth-eyebrow]");
  const description = document.querySelector("[data-auth-description]");
  const tabs = Array.from(document.querySelectorAll("[data-auth-mode]"));
  const premiumLinks = Array.from(document.querySelectorAll("[data-premium-next]"));
  const premiumStatus = document.querySelector("[data-premium-status]");
  const forgotPasswordButton = document.querySelector("[data-forgot-password]");
  const signoutButton = document.querySelector("[data-signout]");

  function readJson(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function bytesToBase64(bytes) {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return window.btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = window.atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  async function makePasswordHash(password, salt) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("Este navegador no permite proteger la contraseña.");
    }
    const key = await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await window.crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 180000, hash: "SHA-256" },
      key,
      256
    );
    return bytesToBase64(new Uint8Array(bits));
  }

  function setStatus(form, message, kind) {
    const status = form.querySelector(".auth-status");
    status.textContent = message;
    status.classList.toggle("error", kind === "error");
    status.classList.toggle("success", kind === "success");
  }

  function setMode(mode, updateUrl) {
    const activeMode = mode === "login" ? "login" : "signup";
    const isLogin = activeMode === "login";
    signupForm.hidden = isLogin;
    loginForm.hidden = !isLogin;
    tabs.forEach((tab) => {
      const active = tab.dataset.authMode === activeMode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    eyebrow.textContent = isLogin ? "Área de usuario" : "Registro gratuito";
    title.textContent = isLogin ? "Inicia sesión" : "Crea tu cuenta";
    description.textContent = isLogin
      ? "Accede con el correo y la contraseña que utilizaste al registrarte."
      : "Empieza con el plan Trader de 0 €/mes. No necesitas tarjeta.";
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("mode", activeMode);
      window.history.replaceState(null, "", url);
    }
    const firstField = (isLogin ? loginForm : signupForm).querySelector("input");
    window.setTimeout(() => firstField.focus(), 0);
  }

  function premiumRequested() {
    return new URLSearchParams(window.location.search).get("plan") === "premium";
  }

  function showAccount(email, isNewAccount) {
    const account = readJson(ACCOUNTS_KEY, {})[email];
    if (!account) return;
    authView.hidden = true;
    accountView.hidden = false;
    document.body.classList.add("is-account");
    document.querySelector("[data-account-title]").textContent = isNewAccount
      ? `¡Bienvenida, ${account.name}!`
      : `Hola de nuevo, ${account.name}`;
    document.querySelector("[data-account-message]").textContent = premiumRequested()
      ? "Paso 1 completado. Tu cuenta gratuita está lista. Premium se activará cuando la contratación pública esté abierta."
      : isNewAccount
        ? "Tu cuenta gratuita ya está creada. Premium queda como una opción para más adelante."
        : "Has iniciado sesión correctamente en tu cuenta gratuita.";
    document.querySelector("[data-account-email]").textContent = account.email;
    document.querySelector("[data-account-plan]").textContent = account.plan === "premium"
      ? "Premium · 49 €/mes"
      : "Trader · 0 €/mes";
    const premiumButton = accountView.querySelector("[data-premium-next]");
    if (premiumButton) premiumButton.hidden = account.plan === "premium";
    if (account.plan === "premium") {
      document.querySelector("[data-account-message]").textContent = "Tu suscripción Premium está activa.";
    }
    if (premiumStatus) {
      premiumStatus.textContent = "";
      premiumStatus.classList.remove("error");
    }
  }

  function showPremiumPreparation(button) {
    const account = readJson(SESSION_KEY, null);
    if (!account || !account.email) {
      const url = new URL(window.location.href);
      url.searchParams.set("mode", "signup");
      url.searchParams.set("plan", "premium");
      window.history.replaceState(null, "", url);
      authView.hidden = false;
      accountView.hidden = true;
      document.body.classList.remove("is-account");
      setMode("signup", false);
      setStatus(signupForm, "Crea primero tu cuenta gratuita. Premium quedará disponible cuando se abra la contratación pública.", "success");
      return;
    }

    if (premiumStatus) {
      premiumStatus.textContent = "Premium está en preparación. Te llevamos a la información actual antes de abrir la contratación.";
      premiumStatus.classList.remove("error");
    }
    button.disabled = true;
    window.setTimeout(() => {
      window.location.href = "/ayuda?tema=premium#contacto";
    }, 450);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.authMode, true));
  });

  premiumLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showPremiumPreparation(link);
    });
  });

  if (forgotPasswordButton) {
    forgotPasswordButton.addEventListener("click", () => {
      const email = normalizeEmail(document.getElementById("login-email")?.value);
      const accounts = readJson(ACCOUNTS_KEY, {});
      if (!email) {
        setStatus(loginForm, "Escribe primero el correo de tu cuenta.", "error");
        document.getElementById("login-email")?.focus();
        return;
      }
      if (!accounts[email]) {
        setStatus(loginForm, "No encontramos una cuenta con ese correo en este dispositivo.", "error");
        return;
      }
      setStatus(
        loginForm,
        "Esta cuenta está guardada en este dispositivo. Consulta Ayuda para recuperar el acceso o activar una cuenta segura multidispositivo.",
        "success"
      );
      window.setTimeout(() => {
        window.location.href = `/ayuda?tema=cuenta&correo=${encodeURIComponent(email)}#contacto`;
      }, 1400);
    });
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(signupForm, "", "");
    if (!signupForm.reportValidity()) return;
    const formData = new FormData(signupForm);
    const name = String(formData.get("name") || "").trim();
    const email = normalizeEmail(formData.get("email"));
    const phone = String(formData.get("phone") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmation = String(formData.get("confirmPassword") || "");
    if (password !== confirmation) {
      setStatus(signupForm, "Las contraseñas no coinciden.", "error");
      document.getElementById("signup-confirm").focus();
      return;
    }
    const accounts = readJson(ACCOUNTS_KEY, {});
    if (accounts[email]) {
      setStatus(signupForm, "Ya existe una cuenta con este correo. Inicia sesión.", "error");
      document.getElementById("login-email").value = email;
      window.setTimeout(() => setMode("login", true), 800);
      return;
    }
    const submitButton = signupForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Creando tu cuenta…";
    try {
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const passwordHash = await makePasswordHash(password, salt);
      accounts[email] = {
        name,
        email,
        phone,
        salt: bytesToBase64(salt),
        passwordHash,
        plan: "free",
        createdAt: new Date().toISOString()
      };
      writeJson(ACCOUNTS_KEY, accounts);
      writeJson(SESSION_KEY, { email, signedInAt: new Date().toISOString() });
      signupForm.reset();
      showAccount(email, true);
    } catch (error) {
      setStatus(signupForm, error instanceof Error ? error.message : "No se ha podido crear la cuenta.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Crear mi cuenta gratis";
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(loginForm, "", "");
    if (!loginForm.reportValidity()) return;
    const formData = new FormData(loginForm);
    const email = normalizeEmail(formData.get("email"));
    const password = String(formData.get("password") || "");
    const account = readJson(ACCOUNTS_KEY, {})[email];
    if (!account) {
      setStatus(loginForm, "No encontramos una cuenta con ese correo. Créala gratis primero.", "error");
      return;
    }
    const submitButton = loginForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Comprobando…";
    try {
      const passwordHash = await makePasswordHash(password, base64ToBytes(account.salt));
      if (passwordHash !== account.passwordHash) {
        setStatus(loginForm, "La contraseña no es correcta.", "error");
        return;
      }
      writeJson(SESSION_KEY, { email, signedInAt: new Date().toISOString() });
      loginForm.reset();
      showAccount(email, false);
    } catch (error) {
      setStatus(loginForm, error instanceof Error ? error.message : "No se ha podido iniciar sesión.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Entrar en MomentumVelo";
    }
  });

  if (signoutButton) {
    signoutButton.addEventListener("click", () => {
      window.localStorage.removeItem(SESSION_KEY);
      accountView.hidden = true;
      authView.hidden = false;
      document.body.classList.remove("is-account");
      setMode("login", true);
    });
  }

  const params = new URLSearchParams(window.location.search);
  const session = readJson(SESSION_KEY, null);
  if ((params.get("mode") === "account" || !params.has("mode")) && session && session.email) {
    showAccount(normalizeEmail(session.email), false);
  } else {
    setMode(params.get("mode") === "login" ? "login" : "signup", false);
  }
})();
