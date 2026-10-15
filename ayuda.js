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
    const terms = query.split(/\s+/).filter(Boolean);
    let visible = 0;

    items.forEach((item) => {
      const haystack = normalize(`${item.textContent} ${item.dataset.keywords || ""}`);
      const matchesQuery = !terms.length || terms.every((term) => haystack.includes(term));
      const matchesCategory = category === "all" || item.dataset.category === category;
      const show = matchesQuery && matchesCategory;
      item.hidden = !show;
      if (show) visible += 1;
    });

    if (count) count.textContent = `${visible} ${visible === 1 ? "respuesta" : "respuestas"}`;
    if (empty) empty.hidden = visible !== 0;

    if (visible === 0 && form?.elements.message && query.length >= 3 && !form.elements.message.value) {
      form.elements.message.value = `No encontré respuesta para: ${search.value.trim()}`;
    }
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
  const contactTopics = new Map([
    ["cuenta", "Cuenta y acceso"],
    ["premium", "Premium y pagos"],
    ["empresas", "Plan Fondo / empresas"],
    ["seguridad", "Privacidad y seguridad"],
    ["cancelacion", "Cancelación de Premium"]
  ]);
  const contactTopic = document.querySelector("[data-contact-topic]");
  if (contactTopic && contactTopics.has(requestedTopic)) {
    contactTopic.value = contactTopics.get(requestedTopic);
  }

  const suppliedEmail = params.get("correo");
  if (suppliedEmail && form?.elements.email) form.elements.email.value = suppliedEmail;
  applyFilters();

if (!form) return;
  const status=document.querySelector("[data-contact-status]"), availability=document.querySelector("[data-contact-availability]");
  const button=form.querySelector("button[type='submit']"), retry=document.querySelector("[data-contact-retry]"), draft=document.querySelector("[data-contact-draft]");
  let available=false, checking=false, sending=false;
  function showStatus(message,error=false) {
    status.textContent=message;status.classList.toggle("error",error);status.classList.toggle("success",!error);
  }
  function readPayload() {
    const data=new FormData(form);
    return {name:data.get("name"),email:data.get("email"),topic:data.get("topic"),message:data.get("message"),
      website:data.get("website"),acceptedPrivacy:data.get("privacy")==="on"};
  }
  async function request(options,timeoutMessage) {
    const controller=new AbortController();let timer;
    try {
      return await Promise.race([
        (async()=>{const response=await fetch("/api/contact",{...options,cache:"no-store",signal:controller.signal});
          return {response,result:await response.json()};})(),
        new Promise((_,reject)=>{timer=window.setTimeout(()=>{controller.abort();reject(new Error(timeoutMessage));},15000);})
      ]);
    } finally {window.clearTimeout(timer);}
  }
  function setAvailability(value,message) {
    available=value;availability.textContent=message;button.disabled=!available||sending;
    button.textContent=available?"Enviar consulta":"Envío no disponible";retry.hidden=available;
  }
  async function checkAvailability() {
    if(checking||sending)return;checking=true;button.disabled=true;retry.disabled=true;
    availability.textContent="Comprobando la disponibilidad del envío…";
    try {
      const {response,result}=await request({method:"GET"},"No se ha podido comprobar el envío.");
      if(!response.ok||typeof result?.available!=="boolean")throw new Error("unavailable");
      setAvailability(result.available,result.available
        ?"El formulario está habilitado. Al enviarlo recibirás una referencia si la consulta se acepta."
        :"El envío de consultas todavía está en preparación. Puedes escribir tu consulta y guardarla como borrador.");
    }catch(_){setAvailability(false,"No hemos podido comprobar la disponibilidad. Puedes volver a comprobarla y conservar tu consulta como borrador.");}
    finally{checking=false;retry.disabled=false;}
  }
  retry.addEventListener("click",checkAvailability);
  draft.addEventListener("click",()=>{
    const payload=readPayload();
    if(!String(payload.message||"").trim()){showStatus("Escribe tu consulta antes de guardar el borrador.",true);return;}
    let url;
    try {
      const content=`BORRADOR DE CONSULTA · MOMENTUMVELO\nEste archivo no acredita el envío de una consulta.\n\nNombre: ${payload.name||""}\nCorreo: ${payload.email||""}\nTema: ${payload.topic||"Ayuda general"}\n\n${payload.message}\n`;
      url=URL.createObjectURL(new Blob([content],{type:"text/plain;charset=utf-8"}));
      const link=document.createElement("a");link.href=url;link.download="MomentumVelo-consulta-borrador.txt";
      document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      showStatus("Borrador preparado para descargar en este dispositivo. La consulta sigue sin enviarse.");
    }catch(_){if(url)URL.revokeObjectURL(url);showStatus("No hemos podido preparar el archivo. El texto sigue en el formulario para que puedas copiarlo.",true);}
  });
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(sending||checking)return;
    if(!available){showStatus("El envío no está disponible. Conserva tu consulta como borrador.",true);return;}
    if(!form.reportValidity())return;
    const serialized=JSON.stringify(readPayload());
    sending=true;button.disabled=true;retry.disabled=true;button.textContent="Enviando…";form.setAttribute("aria-busy","true");
    status.classList.remove("error","success");status.textContent="Enviando tu consulta de forma segura…";
    try {
      const {response,result}=await request({method:"POST",headers:{"Content-Type":"application/json"},body:serialized},
        "El envío no se ha confirmado a tiempo. Conserva el borrador y reintenta la misma consulta si lo necesitas.");
      if(!response.ok||result?.received!==true||result.status!=="accepted"||typeof result.id!=="string"||!/^[A-Za-z0-9_-]{8,128}$/.test(result.id)){
        if(response.status===503&&result?.available===false)setAvailability(false,"El envío de consultas no está disponible. Puedes volver a comprobarlo o guardar el borrador.");
        throw new Error(typeof result?.error==="string"?result.error:"El envío no se ha confirmado. Tu texto se conserva en el formulario.");
      }
      const edited=JSON.stringify(readPayload())!==serialized;
      if(!edited)form.reset();
      showStatus(`Consulta aceptada para envío. Referencia: ${result.id}.${edited?" Los cambios que has escrito durante el envío siguen en el formulario como borrador.":" Conserva esta referencia para el seguimiento."}`);
    }catch(error){showStatus(error instanceof Error?error.message:"El envío no se ha confirmado. Conserva el borrador.",true);}
    finally{sending=false;button.disabled=!available;button.textContent=available?"Enviar consulta":"Envío no disponible";retry.disabled=false;form.setAttribute("aria-busy","false");}
  });
  checkAvailability();
})();
