(function () {
  "use strict";
  const NOTICE_KEY = "momentumvelo.privacy.notice.v1";
  try {
    if (window.localStorage.getItem(NOTICE_KEY)) return;
  } catch (_error) {
    return;
  }

  const notice = document.createElement("aside");
  notice.className = "privacy-notice";
  notice.setAttribute("aria-label", "Información de privacidad");
  notice.innerHTML = `<p><strong>Privacidad clara.</strong> Usamos almacenamiento esencial para la sesión y las preferencias. No instalamos analítica publicitaria en esta versión. <a href="/legal#cookies">Más información</a>.</p><button type="button">Entendido</button>`;
  notice.querySelector("button").addEventListener("click", () => {
    try { window.localStorage.setItem(NOTICE_KEY, "acknowledged"); } catch (_error) { /* no-op */ }
    notice.remove();
  });
  document.body.appendChild(notice);
})();
