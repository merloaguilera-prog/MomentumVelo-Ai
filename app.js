(function () {
  const premiumCard = document.getElementById("premium");
  const checkoutButton = document.querySelector("[data-checkout]");
  const checkoutStatus = document.querySelector(".checkout-status");
  const authLink = document.querySelector("[data-auth-link]");

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
    checkoutButton.addEventListener("click", async () => {
      checkoutButton.disabled = true;
      checkoutButton.textContent = "Abriendo pago seguro…";
      if (checkoutStatus) {
        checkoutStatus.textContent = "Preparando el pago seguro…";
        checkoutStatus.classList.remove("error");
      }
      try {
        const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" } });
        const data = await response.json();
        if (!response.ok || !data.url) throw new Error(data.error || "No se ha podido abrir el pago.");
        window.location.assign(data.url);
      } catch (error) {
        if (checkoutStatus) {
          checkoutStatus.textContent = error instanceof Error ? error.message : "No se ha podido abrir el pago seguro.";
          checkoutStatus.classList.add("error");
        }
        checkoutButton.disabled = false;
        checkoutButton.textContent = "Unirse a MomentumVelo Premium";
      }
    });
  }
})();
