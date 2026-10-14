(function () {
  "use strict";
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("/service-worker.js", { scope: "/", updateViaCache: "none" })
      .catch(() => { /* Public pages remain usable when installation is unavailable. */ });
  }
  const banner = document.createElement("p");
  banner.className = "offline-notice";
  banner.setAttribute("role", "status");
  banner.textContent = "Sin conexión. Las cotizaciones y el radar necesitan Internet. Puedes consultar los datos que ya tengas guardados en este dispositivo.";
  document.body.prepend(banner);
  const update = () => { banner.hidden = navigator.onLine !== false; };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
})();
