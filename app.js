(function () {
  "use strict";

  const ACCOUNTS_KEY = "momentumvelo.accounts.v1";
  const SESSION_KEY = "momentumvelo.session.v1";
  const premiumCard = document.getElementById("premium");
  const authLink = document.querySelector("[data-auth-link]");
  const signupLink = document.querySelector("[data-signup-link]");

  try {
    const session = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null");
    const accounts = JSON.parse(window.localStorage.getItem(ACCOUNTS_KEY) || "{}");
    const account = session && session.email ? accounts[String(session.email).toLowerCase()] : null;
    if (authLink && account) {
      const firstName = String(account.name || "").trim().split(/\s+/)[0];
      authLink.textContent = firstName ? `Hola, ${firstName}` : "Mi cuenta";
      authLink.href = "/login?mode=account";
      authLink.setAttribute("aria-label", `Abrir mi cuenta${account.name ? ` de ${account.name}` : ""}`);
    }
    if (signupLink && account) {
      signupLink.textContent = "Entrar en mi cuenta";
      signupLink.href = "/login?mode=account";
    }
  } catch (_error) {
    // Si el navegador bloquea el almacenamiento, los enlaces conservan su estado público.
  }

  function highlightPremium() {
    if (!premiumCard) return;
    premiumCard.classList.remove("is-targeted");
    window.requestAnimationFrame(() => premiumCard.classList.add("is-targeted"));
    window.setTimeout(() => premiumCard.classList.remove("is-targeted"), 1500);
  }

  function goToPremium() {
    if (!premiumCard) return;
    premiumCard.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    window.history.replaceState(null, "", "#premium");
    window.setTimeout(() => { highlightPremium(); premiumCard.focus({ preventScroll: true }); }, 450);
  }

  document.querySelectorAll(".premium-jump").forEach((link) => {
    link.addEventListener("click", (event) => { event.preventDefault(); goToPremium(); });
  });

  if (window.location.hash === "#premium" && premiumCard) window.setTimeout(goToPremium, 350);
})();
