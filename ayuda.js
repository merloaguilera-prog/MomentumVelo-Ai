(function () {
  "use strict";

  const search = document.querySelector("[data-help-search]");
  const items = Array.from(document.querySelectorAll("[data-help-item]"));
  const chips = Array.from(document.querySelectorAll("[data-help-category]"));
  const count = document.querySelector("[data-help-count]");
  const empty = document.querySelector("[data-help-empty]");
  const form = document.querySelector("[data-contact-form]");
  let category = "all";

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function applyFilters() {
    const query = normalize(search?.value);
    let visible = 0;
    items.forEach((item) => {
      const haystack = normalize(`${item.textContent} ${item.dataset.keywords || ""}`);
      const matchesQuery = !query || haystack.includes(query);
      const matchesCategory = category === "all" || item.dataset.category === category;
      const show = matchesQuery && matchesCategory;
      item.hidden = !show;
      if (show) visible += 1;
    });
    if (count) count.textContent = `${visible} ${visible === 1 ? "respuesta" : "respuestas"}`;
    if (empty) empty.hidden = visible !== 0;
  }

  search?.addEventListener("input", applyFilters);
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      category = chip.dataset.helpCategory || "all";
      chips.forEach((button) => button.classList.toggle("is-active", button === chip));
      applyFilters();
    });
  });

  document.querySelectorAll("[data-topic-link]").forEach((link) => {
    link.addEventListener("click", () => {
      const select = document.querySelector("[data-contact-topic]");
      if (select) select.value = link.dataset.topicLink;
    });
  });

  const params = new URLSearchParams(window.location.search);
  const requestedTopic = normalize(params.get("tema"));
  const categoryChip = chips.find((chip) => chip.dataset.helpCategory === requestedTopic);
  if (categoryChip) categoryChip.click();
  const suppliedEmail = params.get("correo");
  if (suppliedEmail && form?.elements.email) form.elements.email.value = suppliedEmail;
  applyFilters();

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.querySelector("[data-contact-status]");
    if (!form.reportValidity()) return;
    const button = form.querySelector("button[type='submit']");
    const data = new FormData(form);
    const payload = {
      name: data.get("name"),
      email: data.get("email"),
      topic: data.get("topic"),
      message: data.get("message"),
      website: data.get("website"),
      acceptedPrivacy: data.get("privacy") === "on"
    };
    button.disabled = true;
    button.textContent = "Enviando…";
    status.classList.remove("error", "success");
    status.textContent = "Enviando tu consulta de forma segura…";
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.contactEmail) {
          const subject = encodeURIComponent(`MomentumVelo: ${payload.topic}`);
          const body = encodeURIComponent(`${payload.message}\n\nNombre: ${payload.name}\nCorreo: ${payload.email}`);
          status.innerHTML = `${result.error} <a href="mailto:${result.contactEmail}?subject=${subject}&body=${body}">Abrir mi correo</a>.`;
          status.classList.add("error");
          return;
        }
        throw new Error(result.error || "No se ha podido enviar la consulta.");
      }
      form.reset();
      status.textContent = "Consulta enviada. Gracias; ya tenemos la información necesaria para ayudarte.";
      status.classList.add("success");
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "No se ha podido enviar la consulta.";
      status.classList.add("error");
    } finally {
      button.disabled = false;
      button.textContent = "Enviar consulta";
    }
  });
})();
