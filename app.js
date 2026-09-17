(function () {
  const premiumCard = document.getElementById("premium");
  const checkoutButton = document.querySelector("[data-checkout]");
  const checkoutStatus = document.querySelector(".checkout-status");
  const authLink = document.querySelector("[data-auth-link]");
  const LIVE_PREMIUM_CHECKOUT = "https://buy.stripe.com/5kQdR89oW8fA3Mn7Tm2VG01";

  if (authLink) {
    try {
      const session = JSON.parse(window.localStorage.getItem("momentumvelo.session.v1") || "null");
      if (session && session.email) {
        authLink.textContent = "Mi cuenta";
        authLink.href = "/login?mode=account";
      }
    } catch (_error) {}
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

  if (checkoutButton) {
    checkoutButton.addEventListener("click", () => {
      checkoutButton.disabled = true;
      checkoutButton.textContent = "Abriendo pago seguro…";
      if (checkoutStatus) {
        checkoutStatus.textContent = "Redirigiendo al pago seguro de Stripe…";
        checkoutStatus.classList.remove("error");
      }
      window.location.assign(LIVE_PREMIUM_CHECKOUT);
    });
  }
})();
