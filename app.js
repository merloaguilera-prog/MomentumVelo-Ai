(function () {
  const premiumCard = document.getElementById("premium");
  const pricingGrid = document.querySelector(".pricing-grid");
  const checkoutButton = document.querySelector("[data-checkout]");
  const checkoutStatus = document.querySelector(".checkout-status");

  function setPremiumView(active) {
    if (!pricingGrid) return;
    pricingGrid.classList.toggle("is-premium-view", active);
  }

  function highlightPremium() {
    if (!premiumCard) return;
    premiumCard.classList.remove("is-targeted");
    window.requestAnimationFrame(() => premiumCard.classList.add("is-targeted"));
    window.setTimeout(() => premiumCard.classList.remove("is-targeted"), 1500);
  }

  document.querySelectorAll(".premium-jump").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (!premiumCard) return;
      setPremiumView(true);
      premiumCard.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      window.history.replaceState(null, "", "#premium");
      window.setTimeout(() => {
        highlightPremium();
        premiumCard.focus({ preventScroll: true });
      }, 450);
    });
  });

  document.querySelectorAll('a[href="#precios"]').forEach((link) => {
    link.addEventListener("click", () => setPremiumView(false));
  });

  if (window.location.hash === "#premium" && premiumCard) {
    setPremiumView(true);
    window.setTimeout(() => {
      premiumCard.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      highlightPremium();
      premiumCard.focus({ preventScroll: true });
    }, 350);
  }
  if (!checkoutButton || !checkoutStatus) return;

  checkoutButton.addEventListener("click", async () => {
    const originalLabel = checkoutButton.textContent;
    checkoutButton.disabled = true;
    checkoutButton.textContent = "Abriendo pago seguro…";
    checkoutStatus.textContent = "Conectando con Stripe…";
    checkoutStatus.classList.remove("error");
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "premium-monthly" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || "No se ha podido abrir el pago.");
      checkoutStatus.textContent = "Redirigiendo a la página segura de Stripe…";
      window.location.assign(data.url);
    } catch (error) {
      checkoutStatus.textContent = error instanceof Error ? error.message : "No se ha podido abrir el pago. Inténtalo de nuevo.";
      checkoutStatus.classList.add("error");
      checkoutButton.disabled = false;
      checkoutButton.textContent = originalLabel;
    }
  });
})();
