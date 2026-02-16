// 1. DEFINICIÓ DE L'ESTAT (Netejat de duplicats)
let estat = {
  userActiu: null,
  pgc: [],
  preguntes: [],
  temaActiu: null,
  preguntaActual: null,
  assentament: [],
  completats: [],
  punts: 0,
  historialPerExportar: [],
};

let ivaSeleccionat = 0.21;

const API_URL =
  "https://script.google.com/macros/s/AKfycby0quB8-pxsfHLwLZfCuXwIMJjJeTrzjsYnUAlulj8axku8kDKe5NKYHqWCCZGl-fCG/exec"; // <--- ENGANXA LA URL AQUÍ
let modoActual = "login";

// Aquest objecte contindrà tots els epígrafs dels teus PDFs
// ESTRUCTURA PGC SEGONS ELS TEUS PDFS
const ESTRUCTURA_PGC_FINAL = {
  actiu: [
    {
      titol: "A) ACTIU NO CORRIENT",
      sub: [
        { titol: "I. Immobilitzat intangible", regex: /^(20)/ },
        { titol: "II. Immobilitzat material", regex: /^(21|23)/ },
        { titol: "III. Inversions immobiliàries", regex: /^(22)/ },
        {
          titol: "V. Inversions financeres a llarg termini",
          regex: /^(24|25)/,
        },
      ],
    },
    {
      titol: "B) ACTIU CORRIENT",
      sub: [
        { titol: "II. Existències", regex: /^(3)/ },
        {
          titol: "III. Deutors comercials i altres comptes a cobrar",
          regex: /^(43|44|470|471|472)/,
        },
        {
          titol: "VII. Efectiu i altres actius líquids equivalents",
          regex: /^(57)/,
        },
      ],
    },
  ],
  passiu: [
    {
      titol: "A) PATRIMONI NET",
      sub: [
        { titol: "I. Capital", regex: /^(10)/ },
        { titol: "VII. Resultat de l'exercici", esResultat: true }, // Aquí s'integra P&G
      ],
    },
    {
      titol: "C) PASSIU CORRIENT",
      sub: [
        { titol: "III. Deutes a curt termini", regex: /^(51|52)/ },
        {
          titol: "V. Creditors comercials i altres comptes a pagar",
          regex: /^(40|41|475|476|477)/,
        },
      ],
    },
  ],
};

const ESTRUCTURA_PYG_PGC = [
  {
    titol: "1. Import net de la xifra de negocis",
    regex: /^(700|701|702|703|704|705|706|708|709)/,
  },
  { titol: "2. Variació d'existències i aprovisionaments", regex: /^(60|61)/ },
  { titol: "3. Altres ingressos d'explotació", regex: /^(74|75)/ },
  { titol: "4. Despeses de personal", regex: /^(64)/ },
  { titol: "5. Altres despeses d'explotació", regex: /^(62|63|65|694|695)/ },
  { titol: "6. Amortització de l'immobilitzat", regex: /^(68)/ },
  { titol: "A) RESULTAT D'EXPLOTACIÓ", esSubtotal: "explotacio" },
  { titol: "7. Ingressos financers", regex: /^(76)/ },
  { titol: "8. Despeses financeres", regex: /^(66)/ },
  { titol: "B) RESULTAT FINANCER", esSubtotal: "financer" },
  { titol: "C) RESULTAT ABANS D'IMPOSTOS (A + B) ", esSubtotal: "ebt" },
  { titol: "9. Impost sobre beneficis", regex: /^(630)/ },
  { titol: "RESULTAT DE L'EXERCICI (PÈRDUES O GUANYS)", esSubtotal: "final" },
];

// FORMAT SAP: 1.250,50 €
function formatSAP(valor) {
  // 1. Si és pràcticament zero, el convertim en 0 absolut
  if (Math.abs(valor) < 0.005) {
    valor = 0;
  }

  // 2. Truc per eliminar el -0: Sumar 0 a un número -0 el converteix en 0 positiu
  // També fem un format previ per assegurar que treballem amb el número arrodonit
  valor = Number(valor.toFixed(2)) + 0;

  return (
    new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor) + " €"
  );
}

function formatContable(valor) {
  // Si el valor és pràcticament zero (menys de mig cèntim), forcem 0 positiu
  if (Math.abs(valor) < 0.005) valor = 0;

  return (
    new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor) + " €"
  );
}

function formatarNumeroEuropeu(numero) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero);
}

// Canviar entre pestanyes de Login i Registre
function canviarTab(tab) {
  modoActual = tab;
  const tLogin = document.getElementById("tab-login");
  const tReg = document.getElementById("tab-registre");
  const cGrup = document.getElementById("contenedor-grup");
  const cEmail = document.getElementById("contenedor-email");
  const lRec = document.getElementById("link-recuperar");

  if (tab === "login") {
    tLogin.className =
      "font-black text-xs uppercase tracking-widest text-indigo-600 border-b-2 border-indigo-600 pb-4 transition-all";
    tReg.className =
      "font-black text-xs uppercase tracking-widest text-slate-400 border-b-2 border-transparent pb-4 transition-all";
    cGrup.classList.add("hidden");
    cEmail.classList.add("hidden");
    lRec.classList.remove("hidden");
  } else {
    tReg.className =
      "font-black text-xs uppercase tracking-widest text-indigo-600 border-b-2 border-indigo-600 pb-4 transition-all";
    tLogin.className =
      "font-black text-xs uppercase tracking-widest text-slate-400 border-b-2 border-transparent pb-4 transition-all";
    cGrup.classList.remove("hidden");
    cEmail.classList.remove("hidden");
    lRec.classList.add("hidden");
  }
}

// funcions de navegació de recuperació:
function obrirPantallaRecuperacio() {
  document.getElementById("tabs-contenidor").classList.add("hidden");
  document.getElementById("form-usuari").classList.add("hidden");
  document.getElementById("form-recuperar").classList.remove("hidden");
}

// Obre el panell de recuperació
function obrirPantallaRecuperacio() {
  document.getElementById("tabs-contenidor").classList.add("hidden");
  document.getElementById("form-usuari").classList.add("hidden");
  document.getElementById("form-recuperar").classList.remove("hidden");
}

// PAS 1: Validar si el nom i la paraula secreta coincideixen
async function verificarParaulaSecreta() {
  const nom = document.getElementById("recup-nom").value.trim();
  const paraula = document.getElementById("recup-paraula").value.trim();

  if (!nom || !paraula) return alert("Si us plau, omple els dos camps");

  try {
    const resposta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "verificarParaulaClau",
        nom: nom,
        paraula: paraula,
      }),
    });
    const dades = await resposta.json();

    if (dades.success) {
      // Si és correcte, passem al Pas 2 (triar nova pass)
      document.getElementById("pas1-recuperar").classList.add("hidden");
      document.getElementById("pas2-recuperar").classList.remove("hidden");
    } else {
      alert("⚠️ " + dades.message);
    }
  } catch (e) {
    alert("Error de connexió amb el servidor.");
  }
}

// PAS 2: Canviar la contrasenya definitivament
async function executarCanviDirecte() {
  const nom = document.getElementById("recup-nom").value.trim();
  const paraula = document.getElementById("recup-paraula").value.trim();
  const novaPass = document.getElementById("recup-nova-pass").value.trim();

  if (novaPass.length < 4) return alert("La contrasenya és massa curta");

  try {
    const resposta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "canviarPassDirecte",
        nom: nom,
        paraula: paraula,
        novaPass: novaPass,
      }),
    });
    const dades = await resposta.json();

    if (dades.success) {
      alert("✅ Contrasenya actualitzada correctament!");
      tornarAlLoginDesDeRecuperar();
    } else {
      alert("❌ " + dades.message);
    }
  } catch (e) {
    alert("Error al processar el canvi.");
  }
}

// Torna a la pantalla de login inicial
function tornarAlLoginDesDeRecuperar() {
  document.getElementById("tabs-contenidor").classList.remove("hidden");
  document.getElementById("form-usuari").classList.remove("hidden");
  document.getElementById("form-recuperar").classList.add("hidden");

  // Reset dels passos per la pròxima vegada
  document.getElementById("pas1-recuperar").classList.remove("hidden");
  document.getElementById("pas2-recuperar").classList.add("hidden");

  // Netegem els inputs
  document.getElementById("recup-nom").value = "";
  document.getElementById("recup-paraula").value = "";
  document.getElementById("recup-nova-pass").value = "";
}

function tornarAlLoginDesDeRecuperar() {
  document.getElementById("tabs-contenidor").classList.remove("hidden");
  document.getElementById("form-usuari").classList.remove("hidden");
  document.getElementById("form-recuperar").classList.add("hidden");
  document.getElementById("pas1-recuperar").classList.remove("hidden");
  document.getElementById("pas2-recuperar").classList.add("hidden");
}

// Afegeix aquesta funció al teu script.js
async function executarAccio() {
  const nom = document.getElementById("nom-input").value.trim();
  const pass = document.getElementById("pass-input").value.trim();
  const email = document.getElementById("email-input").value.trim(); // NOU
  const grup = document.getElementById("grup-input")
    ? document.getElementById("grup-input").value
    : "";

  if (!nom || !pass) return alert("Si us plau, omple tots els camps");

  // Validació extra per al registre
  if (modoActual === "registre" && !email) {
    return alert(
      "L'email és necessari per poder recuperar la contrasenya en el futur.",
    );
  }

  const btn = document.getElementById("btn-principal");
  btn.disabled = true;
  btn.innerText = "Connectant...";

  try {
    const dadesEnviament = {
      action: modoActual,
      nom: nom,
      pass: pass,
    };

    if (modoActual === "registre") {
      dadesEnviament.grup = grup;
      dadesEnviament.email = email; // NOU: S'envia a la columna C
    }

    const resposta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(dadesEnviament),
    });

    const dades = await resposta.json();

    if (dades.success) {
      if (modoActual === "registre") {
        alert("✨ Usuari creat amb èxit! Ja pots iniciar sessió.");
        // Netegem el camp d'email per seguretat abans de tornar al login
        document.getElementById("email-input").value = "";
        canviarTab("login");
      } else {
        iniciarApp(dades.usuari);
      }
    } else {
      alert("⚠️ " + dades.message);
    }
  } catch (error) {
    alert("Error de connexió. Revisa la URL de l'API.");
    console.error(error);
  } finally {
    btn.disabled = false;
    btn.innerText =
      modoActual === "login" ? "Validar i Accedir" : "Registrar-me";
  }
}

async function iniciarApp(user) {
  console.log("🚀 Iniciant sessió per a:", user.nom);

  // 1. Assignació de l'estat inicial
  estat.userActiu = user;
  estat.punts = parseInt(user.punts) || 0;
  estat.completats = user.completats || [];
  estat.historialPerExportar = []; // Netegem historial de sessions anteriors

  // 2. Interfície d'usuari
  document.getElementById("modal-login").classList.add("hidden");
  document.getElementById("user-nom").innerText = user.nom;

  // 3. Permisos de Rànquing
  const btnRanquing = document.getElementById("item-menu-ranquing");
  if (btnRanquing) {
    // Verifiquem si té permís (marcat amb "X" o true al Google Sheets)
    if (user.veureRanquing === true || user.veureRanquing === "X") {
      btnRanquing.classList.remove("hidden");
    } else {
      btnRanquing.classList.add("hidden");
    }
  }

  // 4. Gestió de l'Avatar (Corregit per evitar ERR_FILE_NOT_FOUND)
  // Verifiquem que user.avatar existeixi i que sembli una URL real (comenci per http)
  const esUrlValida =
    user.avatar &&
    typeof user.avatar === "string" &&
    user.avatar.toLowerCase().startsWith("http");

  const avatarUrl = esUrlValida
    ? user.avatar
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nom)}&background=6366f1&color=fff&bold=true`;

  document.getElementById("user-icon").innerHTML = `
    <img src="${avatarUrl}" class="w-full h-full object-cover rounded-full" 
         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.nom)}&background=ef4444&color=fff'">`;

  // 5. Càrrega del sistema
  try {
    await carregarDadesContables();
    generarMenuTemes();
    actualitzarDashboard();
    mostrarSeccio("dashboard");
    console.log("✅ App carregada correctament.");
  } catch (error) {
    console.error("❌ Error carregant l'App:", error);
    alert("Error en carregar dades remotes.");
  }
}
async function carregarDadesContables() {
  try {
    const res = await fetch(API_URL);
    const dades = await res.json();

    // Estructurem les dades assegurant-nos que l'ID sigui el "DNI" de l'exercici
    estat.preguntes = dades.preguntes.map((p) => ({
      ...p,
      id: String(p.id), // Ens assegurem que l'ID enviat pel code.gs és un text
      descripcio: p.descripcio || "",
    }));

    estat.pgc = dades.pgc;

    generarMenuTemes();
    generarDatalistPGC();
  } catch (e) {
    console.error("Error alineant dades del Sheet:", e);
  }
}

//--------------------------------

// Navegació entre Dashboard, Exercici, Progrés i Rànquing
function mostrarSeccio(id) {
  // 1. Llista de seccions actualitzada amb 'seccio-informes'
  const seccions = [
    "seccio-dashboard",
    "seccio-exercici",
    "seccio-progres",
    "seccio-ranquing",
    "seccio-informes", // <--- Afegida
  ];

  // 2. Netegem els filtres del header per defecte
  const filtreHeader = document.getElementById("filtre-header-container");
  if (filtreHeader) filtreHeader.innerHTML = "";

  // 3. Gestionem la visibilitat
  seccions.forEach((s) => {
    const el = document.getElementById(s);
    if (el) {
      el.classList.toggle("hidden", s !== `seccio-${id}`);
    }
  });

  // 4. Lògica Responsive
  const sidebar = document.getElementById("sidebar");
  if (sidebar && window.innerWidth < 1024) {
    if (!sidebar.classList.contains("-translate-x-full")) {
      toggleSidebar();
    }
  }

  // 5. Accions específiques segons la secció
  if (id === "progres") {
    mostrarProgres();
  } else if (id === "ranquing") {
    mostrarRanquing();
  } else if (id === "informes") {
    // Quan entrem a informes, executem el motor de càlcul i renderitzat
    mostrarInformesFinancers();
  } else if (id === "exercici") {
  }
}

function generarMenuTemes() {
  const menu = document.getElementById("menu-temes");
  if (!menu) return;

  // 1. Corregim l'accés a la columna B (Tema)
  // Fem servir 'p.Tema' o 'p.tema' per si de cas
  const temes = [
    ...new Set(estat.preguntes.map((p) => p.Tema || p.tema)),
  ].filter(Boolean);

  menu.innerHTML = temes
    .map((nomTema) => {
      const preguntesDelTema = estat.preguntes.filter(
        (p) => (p.Tema || p.tema) === nomTema,
      );

      // DETERMINEM SI EL TEMA HA D'ESTAR OBERT
      const esTemaActiu = estat.temaActiu === nomTema;

      return `
      <li class="mb-2">
        <details class="group" ${esTemaActiu ? "open" : ""}>
          <summary class="flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-800/50 transition text-indigo-400 font-black text-[9px] uppercase tracking-widest list-none">
            <span class="flex items-center gap-2">
              <span class="group-open:rotate-90 transition-transform text-[8px]">▶</span>
              ${nomTema}
            </span>
          </summary>
          
          <ul class="mt-1 space-y-0.5 border-l border-slate-800 ml-4">
            ${preguntesDelTema
              .map((p, index) => {
                // Referència a la columna A (ID_Activitat) i columna H (Descripcio)
                const idPregunta = p.ID_Activitat || p.id;
                const descripcioPregunta =
                  p.Descripcio ||
                  p.descripcio ||
                  p.titol ||
                  `Activitat ${index + 1}`;

                const feta = estat.completats
                  .map(String)
                  .includes(String(idPregunta));
                const esActiva =
                  estat.preguntaActual &&
                  String(
                    estat.preguntaActual.ID_Activitat ||
                      estat.preguntaActual.id,
                  ) === String(idPregunta);

                return `
                <li class="relative">
                  <button onclick="seleccionarPreguntaDirecta('${idPregunta}')" 
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group
                    ${esActiva ? "bg-indigo-500/20 border border-indigo-500/30" : "border border-transparent hover:bg-slate-800/40"}">
                    
                    <div class="w-5 h-5 shrink-0 flex items-center justify-center rounded-md text-[9px] font-bold border
                      ${
                        esActiva
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : feta
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "bg-slate-800 border-slate-700 text-slate-500"
                      }">
                      ${feta ? "✓" : index + 1}
                    </div>

                    <span class="text-[11px] font-bold truncate 
                      ${esActiva ? "text-indigo-200" : feta ? "text-slate-500" : "text-slate-300 group-hover:text-white"}">
                      ${descripcioPregunta}
                    </span>
                  </button>
                </li>`;
              })
              .join("")}
          </ul>
        </details>
      </li>`;
    })
    .join("");
}

// AQUESTA FUNCIÓ ÉS LA QUE FA QUE EL MENÚ FUNCIONI EN CLICAR
function seleccionarPreguntaDirecta(id) {
  // 1. Busquem la pregunta assegurant que comparem text amb text
  const pregunta = estat.preguntes.find(
    (p) => String(p.ID_Activitat || p.id) === String(id),
  );

  if (pregunta) {
    // 2. Actualitzem l'estat amb el tema i la pregunta activa
    estat.temaActiu = pregunta.Tema || pregunta.tema;
    estat.preguntaActual = pregunta;

    // 4. ACTUALITZEM EL MENÚ LATERAL
    generarMenuTemes();

    // 5. NAVEGACIÓ I INTERFÍCIE
    mostrarSeccio("exercici");
    mostrarPregunta();

    // 6. Scroll a dalt i log
    window.scrollTo({ top: 0, behavior: "smooth" });
    console.log("Navegant al tema:", estat.temaActiu, "Activitat:", id);
  } else {
    console.error("Error: No s'ha trobat l'ID " + id + " a la base de dades.");
  }
}

// Funció generar llista suggerida ------------------------------------------------------------------------------------

function generarDatalistPGC() {
  // Creem un element <datalist> dinàmicament
  let dl = document.getElementById("pgc-list");
  if (!dl) {
    dl = document.createElement("datalist");
    dl.id = "pgc-list";
    document.body.appendChild(dl);
  }

  dl.innerHTML = estat.pgc
    .map((c) => `<option value="${c.codi}">${c.nom}</option>`)
    .join("");
}

// Funció generar les preguntes  ------------------------------------------------------------------------------------

function carregarTema(nomTema) {
  estat.temaActiu = nomTema;
  // Filtrem totes les preguntes d'aquell tema
  const preguntesTema = estat.preguntes.filter((p) => p.tema === nomTema);

  if (preguntesTema.length > 0) {
    // Comencem per la primera
    estat.preguntaActual = preguntesTema[0];
    mostrarPregunta();
    mostrarSeccio("exercici");
  }
}

function mostrarPregunta() {
  const p = estat.preguntaActual;
  if (!p) return;

  // DEFINIM EL TEMA ACTIU (Indispensable per filtrar els Majors)
  estat.temaActiu = p.Tema || p.tema;

  const btnValidar = document.getElementById("btn-validar");
  const btnSeguent = document.getElementById("btn-seguent");
  if (!btnValidar || !btnSeguent) return;

  // Comprovem si l'ID ja està a la llista de completats
  const idActual = String(p.ID || p.id).trim();
  const jaFeta = estat.completats.includes(idActual);

  if (jaFeta) {
    btnValidar.classList.add("hidden");
    btnSeguent.innerText = "Següent Exercici ➡️";
    btnSeguent.classList.remove("hidden");
  } else {
    btnValidar.classList.remove("hidden");
    btnSeguent.innerText = "Saltar Exercici ⏭️";
    btnSeguent.classList.remove("hidden");
  }

  const enunciatEl = document.getElementById("txt-enunciat");
  const temaEl = document.getElementById("info-pregunta");
  if (enunciatEl)
    enunciatEl.innerText = p.Enunciat || p.enunciat || p.Descripcio;
  if (temaEl) temaEl.innerText = estat.temaActiu;

  // --- REFRESC DEL LLIBRE MAJOR ACUMULAT ---
  // Això mostrarà totes les "T" del tema actual que ja estiguin al Sheet

  // Reset de la taula de treball
  estat.assentament = [];
  afegirFila();
  renderTaula();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

//------------------------------------------------------------------Taula -------------------------------

// Funcionalitat de les respostes  ---
// Afegeix una fila buida a l'objecte d'estat i actualitza la taula
function afegirFila() {
  estat.assentament.push({ codi: "", nom: "", deure: 0, haver: 0 });
  renderTaula();
}

// Funció per esborrar una línia específica
function eliminarLinia(index) {
  // 1. Eliminem de l'array
  estat.assentament.splice(index, 1);

  // 2. Si l'array queda buit, afegim una línia buida per defecte
  if (estat.assentament.length === 0) {
    estat.assentament.push({ codi: "", nom: "", deure: 0, haver: 0 });
  }

  // 3. Renderitzem la taula de nou
  renderTaula();
}

// Quan l'usuari canvia una dada a la taula
function updateLinia(index, camp, valor) {
  if (!estat.assentament[index]) return;

  // 1. Actualitzem la dada a la memòria
  estat.assentament[index][camp] = valor;

  // 2. Busquem la fila a la pantalla per fer canvis visuals directes
  const fila = document.querySelector(`tr[data-index="${index}"]`);
  if (!fila) return;

  // 3. Si canvia el CODI, busquem el nom i l'actualitzem a la pantalla
  if (camp === "codi") {
    const compteTrobat = estat.pgc.find(
      (c) => String(c.codi) === String(valor),
    );
    const nomNet = compteTrobat ? compteTrobat.nom : "Compte no trobat";
    estat.assentament[index].nom = nomNet;

    // Busquem l'element on es mostra el nom (assegura't que tingui la classe 'nom-compte')
    const cel·laNom = fila.querySelector(".nom-compte");
    if (cel·laNom) cel·laNom.innerText = nomNet;
  }

  // 4. LÒGICA D'EXCLUSIVITAT (Neteja visual d'imports)
  if (camp === "deure" && parseFloat(valor) > 0) {
    estat.assentament[index].haver = 0;
    const inputHaver = fila.querySelector(".input-haver");
    if (inputHaver) inputHaver.value = "";
  } else if (camp === "haver" && parseFloat(valor) > 0) {
    estat.assentament[index].deure = 0;
    const inputDeure = fila.querySelector(".input-deure");
    if (inputDeure) inputDeure.value = "";
  }
}

// Funció auxiliar per formatar números (1.234.567,89 €)
function formatarMoneda(valor) {
  return (
    new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor) + " €"
  );
}

function renderTaula() {
  const body = document.getElementById("diari-body");
  if (!body) return;

  let totalDeure = 0;
  let totalHaver = 0;

  body.innerHTML = estat.assentament
    .map((linia, idx) => {
      totalDeure += parseFloat(linia.deure || 0);
      totalHaver += parseFloat(linia.haver || 0);

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100" data-index="${idx}">
            <td class="p-2 w-32">
                <input type="text" list="pgc-list" value="${linia.codi}" 
                    onchange="updateLinia(${idx}, 'codi', this.value)"
                    class="select-compte w-full p-2 outline-none font-bold text-xl text-indigo-600 bg-transparent focus:ring-2 focus:ring-indigo-200 rounded">
            </td>
            <td class="p-2 text-slate-500 text-sm font-medium nom-compte">${linia.nom}</td>
            
            <td class="p-2">
                <div class="flex flex-col">
                    <div class="flex items-center bg-emerald-50 rounded px-2">
                        <input type="number" step="0.01" value="${linia.deure || ""}" placeholder="0,00"
                            oninput="actualitzarLecturaBona(this)"
                            onchange="updateLinia(${idx}, 'deure', this.value)" 
                            class="input-deure w-full text-right p-3 outline-none text-2xl text-emerald-700 font-bold bg-transparent">
                        <span class="ml-1 text-emerald-400 font-bold text-xl">€</span>
                    </div>
                    <div class="lectura-formatada text-right text-[11px] text-emerald-500 font-mono mt-1 h-4 px-2">
                        ${linia.deure > 0 ? formatarMoneda(linia.deure) : ""}
                    </div>
                </div>
            </td>

            <td class="p-2">
                <div class="flex flex-col">
                    <div class="flex items-center bg-sky-50 rounded px-2">
                        <input type="number" step="0.01" value="${linia.haver || ""}" placeholder="0,00"
                            oninput="actualitzarLecturaBona(this)"
                            onchange="updateLinia(${idx}, 'haver', this.value)" 
                            class="input-haver w-full text-right p-3 outline-none text-2xl text-sky-700 font-bold bg-transparent">
                        <span class="ml-1 text-sky-400 font-bold text-xl">€</span>
                    </div>
                    <div class="lectura-formatada text-right text-[11px] text-sky-500 font-mono mt-1 h-4 px-2">
                        ${linia.haver > 0 ? formatarMoneda(linia.haver) : ""}
                    </div>
                </div>
            </td>

            <td class="p-2 text-center">
                <button onclick="eliminarLinia(${idx})" class="text-slate-300 hover:text-rose-500 transition text-2xl">✕</button>
            </td>
        </tr>`;
    })
    .join("");

  const elTotalDeure = document.getElementById("total-deure");
  const elTotalHaver = document.getElementById("total-haver");

  elTotalDeure.innerText = formatarMoneda(totalDeure);
  elTotalHaver.innerText = formatarMoneda(totalHaver);

  elTotalDeure.className = "text-3xl font-black text-emerald-700";
  elTotalHaver.className = "text-3xl font-black text-sky-700";

  renderMajors();
}

// Afegeix també aquesta funció per fer el visor dinàmic
function actualitzarLecturaBona(el) {
  const valor = parseFloat(el.value) || 0;
  const visor = el
    .closest("div")
    .parentElement.querySelector(".lectura-formatada");
  if (valor > 0) {
    visor.innerText = formatarMoneda(valor);
  } else {
    visor.innerText = "";
  }
}
// VALIDAR -----------------------------------------------------VALIDAR
async function validarAssentament() {
  // 1. LECTURA DELS INPUTS DE LA TAULA
  const filesTaula = document.querySelectorAll("#diari-body tr");
  const dadesUsuari = [];

  filesTaula.forEach((fila) => {
    const codi = fila.querySelector(".select-compte")?.value.trim() || "";
    const deure = parseFloat(fila.querySelector(".input-deure")?.value) || 0;
    const haver = parseFloat(fila.querySelector(".input-haver")?.value) || 0;

    if (codi !== "" && (deure > 0 || haver > 0)) {
      dadesUsuari.push({
        codi: String(codi),
        deure: Number(deure.toFixed(2)),
        haver: Number(haver.toFixed(2)),
      });
    }
  });

  // 2. QUADRATURA BÀSICA
  const tD = dadesUsuari.reduce((a, l) => a + l.deure, 0);
  const tH = dadesUsuari.reduce((a, l) => a + l.haver, 0);

  if (Math.abs(tD - tH) > 0.01 || dadesUsuari.length === 0) {
    alert("⚠️ L'assentament no quadra o està buit.");
    return;
  }

  // 3. FUNCIÓ DE NORMALITZACIÓ PER COMPARAR
  const normalitzar = (arr) => {
    if (!arr) return "[]";
    return JSON.stringify(
      arr
        .filter((l) => l.codi && (Number(l.deure) > 0 || Number(l.haver) > 0))
        .map((l) => ({
          c: String(l.codi).trim(),
          d: Number(l.deure).toFixed(2),
          h: Number(l.haver).toFixed(2),
        }))
        .sort((a, b) => (a.c + a.d + a.h).localeCompare(b.c + b.d + b.h)),
    );
  };

  const solucioEsperada = estat.preguntaActual.solucio;

  const stringUsuari = normalitzar(dadesUsuari);
  const stringSolucio = normalitzar(solucioEsperada);

  // DEBUG: Això t'ajudarà a veure l'error a la consola del navegador (F12)
  console.log("USUARI:", stringUsuari);
  console.log("SOLUCIÓ:", stringSolucio);

  if (stringUsuari === stringSolucio) {
    // --- TOT CORRECTE ---
    estat.assentament = dadesUsuari;
    const idActual = String(
      estat.preguntaActual.id || estat.preguntaActual.ID,
    ).trim();

    // Guardar per a PDF
    if (!estat.historialPerExportar.some((h) => h.id === idActual)) {
      estat.historialPerExportar.push({
        id: idActual,
        enunciat: estat.preguntaActual.enunciat,
        linies: JSON.parse(JSON.stringify(dadesUsuari)),
      });
    }

    // Punts i registre
    if (!estat.completats.includes(idActual)) {
      estat.completats.push(idActual);
      try {
        await fetch(API_URL, {
          method: "POST",
          mode: "no-cors",
          body: JSON.stringify({
            action: "registrarActivitat",
            nom: estat.userActiu.nom,
            idActivitat: idActual,
            tema: estat.temaActiu,
            punts: 10,
          }),
        });
        estat.punts = (parseInt(estat.punts) || 0) + 10;
        actualitzarDashboard();
        generarMenuTemes();
      } catch (e) {
        console.error(e);
      }
    }

    mostrarExit();
    document.getElementById("btn-validar").classList.add("hidden");
    document.getElementById("btn-seguent").classList.remove("hidden");
  } else {
    alert(
      "❌ L'assentament encara té algun error en els comptes o els imports.",
    );
  }
}
// VALIDAR -----------------------------------------------------VALIDAR

function actualitzarLecturaBona(el) {
  const valor = parseFloat(el.value) || 0;
  const visor = el
    .closest("div")
    .parentElement.querySelector(".lectura-formatada");
  if (valor > 0) {
    visor.innerText = formatarMoneda(valor);
  } else {
    visor.innerText = "";
  }
  // També aprofitem per actualitzar els totals de sota en temps real
  actualitzarTotalsEnTempsReal();
}

// FUNCIÓ AUXILIAR PER AL SCROLL AUTOMÀTIC------------------------------------------------
function ferScrollAlSegüent(idCompletat) {
  const menu = document.getElementById("menu-temes");
  if (!menu) return;

  const botons = menu.querySelectorAll("button");
  let trobatIndex = -1;

  botons.forEach((btn, i) => {
    // Busquem el botó que hem clicat (per ID)
    if (btn.getAttribute("onclick").includes(`'${idCompletat}'`)) {
      trobatIndex = i;
    }
  });

  // Si hi ha un exercici següent, fem scroll fins a ell
  if (trobatIndex !== -1 && botons[trobatIndex + 1]) {
    const següentBtn = botons[trobatIndex + 1];
    següentBtn.scrollIntoView({ behavior: "smooth", block: "center" });

    // Feedback visual: un petit parpelleig
    següentBtn.classList.add(
      "ring-2",
      "ring-indigo-400",
      "ring-offset-2",
      "ring-offset-slate-900",
    );
    setTimeout(() => {
      següentBtn.classList.remove(
        "ring-2",
        "ring-indigo-400",
        "ring-offset-2",
        "ring-offset-slate-900",
      );
    }, 2000);
  }
}

// Afegim una variable a l'estat per als punts---------------------------------------------------------------------------------------
estat.punts = 0;

function mostrarExit() {
  reproduirSoExit();
  const medalla = document.getElementById("medalla-container");
  medalla.classList.remove("hidden");

  setTimeout(() => {
    medalla.classList.add("hidden");
    // CORRECCIÓ DEL NOM:
    carregarSegüentPregunta();
  }, 3000);
}

async function registrarPunts(punts) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "guardarPunts",
        nom: estat.userActiu.nom,
        punts: punts,
      }),
    });
    const dades = await res.json();
    if (dades.success) {
      estat.punts = dades.nousPunts;
      actualitzarDashboard();
    }
  } catch (e) {
    console.error("Error guardant punts", e);
  }
}

function actualitzarDashboard() {
  const elPunts = document.getElementById("dash-punts");
  const elRang = document.getElementById("dash-rang");
  const elBarra = document.getElementById("dash-barra");
  const elPercentText = document.getElementById("dash-percent-text");

  // Càlcul de punts: 10 per exercici completat
  const puntsTotals = estat.completats.length * 10;
  if (elPunts) elPunts.innerText = puntsTotals.toLocaleString();

  // Càlcul del percentatge global
  const totalPreguntes = estat.preguntes.length;
  const fetes = estat.completats.length;
  const percentatge =
    totalPreguntes > 0 ? Math.round((fetes / totalPreguntes) * 100) : 0;

  // Actualització de la barra
  if (elBarra) elBarra.style.width = percentatge + "%";
  if (elPercentText) elPercentText.innerText = percentatge + "%";

  // Sistema de Rangs Acadèmics amb colors
  if (elRang) {
    let nota = "-";
    let colorClass = "text-slate-400"; // Color per defecte

    if (percentatge >= 95) {
      nota = "A+";
      colorClass = "text-indigo-600"; // Blau intens/lila
    } else if (percentatge >= 80) {
      nota = "A";
      colorClass = "text-emerald-500"; // Verd èxit
    } else if (percentatge >= 65) {
      nota = "B";
      colorClass = "text-amber-500"; // Taronja/Or
    } else if (percentatge >= 50) {
      nota = "C";
      colorClass = "text-slate-600"; // Gris fosc
    } else if (percentatge > 0) {
      nota = "D";
      colorClass = "text-rose-400"; // Vermellós
    } else {
      nota = "Novell";
      colorClass = "text-slate-300";
    }

    // Apliquem la nota i el color
    elRang.innerText = nota;
    elRang.className = `text-3xl font-black transition-colors duration-500 ${colorClass}`;

    // Si és la nota màxima, afegim l'animació de bot de la medalla
    if (nota === "A+") {
      elRang.classList.add("animate-bounce");
    } else {
      elRang.classList.remove("animate-bounce");
    }
  }
}

// Funció de suport per a l'avatar
function actualitzarAvatarVisual() {
  const user = estat.userActiu;
  if (!user) return;

  const userIconContainer = document.getElementById("user-icon");
  if (userIconContainer) {
    // Si l'avatar falla o està buit, usem UI-Avatars amb el nom de l'usuari
    const avatarUrl =
      user.avatar && user.avatar.includes("http")
        ? user.avatar
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nom)}&background=6366f1&color=fff&bold=true`;

    userIconContainer.innerHTML = `
      <img src="${avatarUrl}" 
           class="w-full h-full object-cover rounded-full" 
           onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.nom)}&background=ef4444&color=fff'">`;
  }
}

//--- Render de Majors -----------------------------------------------------------

function renderMajors() {
  const container = document.getElementById("majors-container");
  if (!container) return;

  // 1. Agrupem els moviments per compte
  const movimentsPerCompte = {};

  estat.assentament.forEach((linia) => {
    if (!linia.codi) return;
    if (!movimentsPerCompte[linia.codi]) {
      movimentsPerCompte[linia.codi] = {
        nom: linia.nom,
        deure: [],
        haver: [],
      };
    }
    if (parseFloat(linia.deure) > 0)
      movimentsPerCompte[linia.codi].deure.push(parseFloat(linia.deure));
    if (parseFloat(linia.haver) > 0)
      movimentsPerCompte[linia.codi].haver.push(parseFloat(linia.haver));
  });

  // 2. Generem l'HTML per a cada "T"
  container.innerHTML = Object.keys(movimentsPerCompte)
    .map((codi) => {
      const dades = movimentsPerCompte[codi];
      const totalD = dades.deure.reduce((a, b) => a + b, 0);
      const totalH = dades.haver.reduce((a, b) => a + b, 0);
      const saldo = totalD - totalH;

      return `
            <div class="bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div class="bg-slate-800 text-white p-2 text-center text-[10px] font-black uppercase tracking-widest">
                    (${codi}) ${dades.nom}
                </div>
                <div class="grid grid-cols-2 min-h-[100px]">
                    <div class="border-r border-slate-200 p-2">
                        <div class="text-[9px] text-slate-400 font-bold mb-1">DEURE</div>
                        ${dades.deure.map((v) => `<div class="text-xs text-emerald-600 font-bold">${v.toFixed(2)}</div>`).join("")}
                    </div>
                    <div class="p-2 text-right">
                        <div class="text-[9px] text-slate-400 font-bold mb-1">HAVER</div>
                        ${dades.haver.map((v) => `<div class="text-xs text-sky-600 font-bold">${v.toFixed(2)}</div>`).join("")}
                    </div>
                </div>
                <div class="border-t border-slate-100 p-2 bg-slate-50 flex justify-between items-center">
                    <span class="text-[9px] font-black text-slate-400">SALDO</span>
                    <span class="text-xs font-black ${saldo >= 0 ? "text-emerald-700" : "text-rose-700"}">
                        ${Math.abs(saldo).toFixed(2)} € ${saldo >= 0 ? "(D)" : "(H)"}
                    </span>
                </div>
            </div>
        `;
    })
    .join("");
}

function carregarSegüentPregunta() {
  // 1. NETEJA VISUAL
  // Amaguem la medalla de l'èxit anterior
  const medalla = document.getElementById("medalla-container");
  if (medalla) medalla.classList.add("hidden");

  // Eliminem els blocs temporals de "Exercici Completat" (si n'hi ha)
  const missatgesAnteriors = document.querySelectorAll(".bg-emerald-50");
  missatgesAnteriors.forEach((m) => m.remove());

  // Reset dels botons (tornem a mostrar Validar i amaguem Següent)
  document.getElementById("btn-validar").classList.remove("hidden");
  document.getElementById("btn-seguent").classList.add("hidden");

  // 2. BUSCAR LA POSICIÓ ACTUAL
  const idActual = estat.preguntaActual.ID_Activitat || estat.preguntaActual.id;

  // Filtrem per tema (opcional: si vols que 'Següent' només vagi dins del mateix tema)
  // Si prefereixes que vagi per ordre absolut de l'Excel, usa estat.preguntes directament
  const indexTotal = estat.preguntes.findIndex(
    (p) => String(p.ID_Activitat || p.id) === String(idActual),
  );

  // 3. DECIDIR EL SEGÜENT PAS
  if (indexTotal !== -1 && indexTotal < estat.preguntes.length - 1) {
    const següent = estat.preguntes[indexTotal + 1];

    // Actualitzem l'estat del tema (per si la següent pregunta és d'un tema nou)
    estat.temaActiu = següent.Tema || següent.tema;
    estat.preguntaActual = següent;

    // Mostrem la pregunta (neteja la taula i posa el nou enunciat)
    mostrarPregunta();

    // Actualitzem el menú perquè la "rodona" de selecció es mogui
    generarMenuTemes();
  } else {
    alert("🎉 Felicitats! Has completat tots els exercicis de l'Olimpíada.");
    mostrarSeccio("dashboard");
  }
}

// Variable per controlar el filtre (la pots posar fora de la funció)
let filtreProgres = "tots";

function mostrarProgres() {
  const container = document.getElementById("llista-progres-temes");
  const filtreHeader = document.getElementById("filtre-header-container");
  if (!container) return;

  // 1. Inyectem els botons al HEADER
  if (filtreHeader) {
    filtreHeader.innerHTML = `
            <button onclick="canviarFiltreProgres('tots')" 
                class="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${filtreProgres === "tots" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}">
                Tots
            </button>
            <button onclick="canviarFiltreProgres('pendents')" 
                class="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${filtreProgres === "pendents" ? "bg-white text-rose-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}">
                Pendents
            </button>
        `;
  }

  document.getElementById("info-pregunta").innerText = "El Meu Rendiment";
  document.getElementById("progres-tema").innerText =
    "Estadístiques Detallades";

  const temes = [...new Set(estat.preguntes.map((p) => p.tema))];
  const completadesIDs = estat.completats.map(String);

  container.innerHTML = temes
    .map((tema) => {
      const totesPreguntesTema = estat.preguntes.filter((p) => p.tema === tema);
      const totalTema = totesPreguntesTema.length; // Total d'exercicis del tema

      const preguntesPerMostrar =
        filtreProgres === "pendents"
          ? totesPreguntesTema.filter(
              (p) => !completadesIDs.includes(String(p.id)),
            )
          : totesPreguntesTema;

      if (filtreProgres === "pendents" && preguntesPerMostrar.length === 0)
        return "";

      const fetesTema = totesPreguntesTema.filter((p) =>
        completadesIDs.includes(String(p.id)),
      ).length;

      const percentTema =
        totalTema > 0 ? Math.round((fetesTema / totalTema) * 100) : 0;

      // MILLORA: Condició robusta per detectar si el tema està realment acabat
      const esComplet = fetesTema === totalTema && totalTema > 0;

      return `
        <div class="bg-white rounded-[2rem] border ${esComplet ? "border-emerald-500 bg-emerald-50/20" : "border-slate-100"} shadow-sm hover:shadow-md transition-all duration-500 overflow-hidden">
            <details class="group" ${filtreProgres === "pendents" ? "open" : ""}>
                <summary class="p-8 cursor-pointer list-none outline-none">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <p class="flex items-center gap-2 text-[10px] font-black ${esComplet ? "text-emerald-600" : "text-slate-400"} uppercase tracking-widest mb-1">
                                ${tema}
                                ${esComplet ? '<span class="bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[8px]">FINALITZAT</span>' : ""}
                            </p>
                            <div class="flex items-center gap-3">
                                <h3 class="text-3xl font-black ${esComplet ? "text-emerald-700" : "text-slate-900"}">${percentTema}%</h3>
                                ${esComplet ? '<span class="text-2xl animate-bounce">🏆</span>' : ""}
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-2">
                            <span class="text-[10px] font-bold ${esComplet ? "text-emerald-700 bg-emerald-100" : "text-slate-500 bg-slate-50"} px-3 py-1 rounded-full border ${esComplet ? "border-emerald-200" : "border-slate-100"}">
                                ${fetesTema} / ${totalTema} Exercicis
                            </span>
                            <span class="text-[9px] font-black text-indigo-500 uppercase tracking-tighter group-open:hidden italic">veure detalls ↓</span>
                        </div>
                    </div>
                    <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full ${esComplet ? "bg-emerald-500" : "bg-indigo-500"} transition-all duration-1000" style="width: ${percentTema}%"></div>
                    </div>
                </summary>

                <div class="px-8 pb-8 pt-2 border-t border-slate-50 bg-slate-50/30">
                    <div class="space-y-2 mt-4">
                        ${preguntesPerMostrar
                          .map((p) => {
                            const esFeta = completadesIDs.includes(
                              String(p.id),
                            );
                            const indexReal =
                              totesPreguntesTema.findIndex(
                                (item) => item.id === p.id,
                              ) + 1;
                            const títolNetejat =
                              p.titol ||
                              (p.descripcio
                                ? p.descripcio.substring(0, 45) + "..."
                                : "Assentament " + p.id);

                            return `
                            <div class="flex items-center justify-between p-3 rounded-2xl border transition-all 
                                ${esFeta ? "bg-white border-emerald-100 shadow-sm" : "bg-white/50 border-slate-100 opacity-80"}">
                                <div class="flex items-center gap-3">
                                    <div class="w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-bold
                                        ${esFeta ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}">
                                        ${esFeta ? "✓" : indexReal}
                                    </div>
                                    <div class="flex flex-col">
                                        <p class="text-[11px] font-bold ${esFeta ? "text-slate-800" : "text-slate-500"}">${títolNetejat}</p>
                                        <p class="text-[9px] font-medium uppercase tracking-tighter ${esFeta ? "text-emerald-500" : "text-slate-400"}">
                                            ${esFeta ? "Completat" : "Pendent"}
                                        </p>
                                    </div>
                                </div>
                                ${
                                  !esFeta
                                    ? `
                                    <button onclick="seleccionarPreguntaDirecta('${p.id}')" 
                                        class="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">
                                        Resoldre
                                    </button>
                                `
                                    : `<span class="text-[9px] font-black text-emerald-500 pr-2 italic">✓ EXCEL·LENT</span>`
                                }
                            </div>`;
                          })
                          .join("")}
                    </div>
                </div>
            </details>
        </div>`;
    })
    .join("");
}

function canviarFiltreProgres(nouFiltre) {
  filtreProgres = nouFiltre;
  mostrarProgres();
}

function reproduirSoExit() {
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine"; // So suau
  oscillator.frequency.setValueAtTime(523.25, context.currentTime); // Nota Do (C5)
  oscillator.frequency.exponentialRampToValueAtTime(
    880,
    context.currentTime + 0.1,
  ); // Puja a La (A5)

  gain.gain.setValueAtTime(0.1, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + 0.5);
}
// ----- Mostrar Ranquing ---------------------
// 1. Variable global per guardar les dades un cop descarregades
let dadesRanquingCache = null;

async function refrescarDadesRanquing() {
  // 1. Esborrem la memòria cau
  dadesRanquingCache = null;
  // 2. Cridem a la funció de renderitzat (ella sola farà el fetch al veure que no hi ha cache)
  await mostrarRanquing("Tots");
}

async function mostrarRanquing(filtreGrup = "Tots") {
  const container = document.getElementById("contingut-ranquing");
  if (!container) return;

  // Si ja tenim dades, no posem el spinner de càrrega per evitar parpelleigs
  if (!dadesRanquingCache) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center p-10 space-y-4">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p class="font-bold text-slate-400 uppercase text-[10px] tracking-widest text-center">Organitzant classificació...</p>
      </div>`;
  }

  try {
    // 2. Només fem el fetch si no tenim les dades a la memòria
    if (!dadesRanquingCache) {
      const res = await fetch(`${API_URL}?action=obtenirRanquing`);
      dadesRanquingCache = await res.json();
    }

    // 3. Treballem amb una còpia per filtrar
    let companys = [...dadesRanquingCache];

    if (filtreGrup !== "Tots") {
      companys = companys.filter((c) => c.grup === filtreGrup);
    }

    // --- CONSTRUCCIÓ DE L'HTML (Mateixa lògica però més ràpida) ---
    const estilsBotons =
      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-sm border";

    // He tret la crida recursiva directa dels botons per un sistema més net
    const botonsHtml = `
  <div class="flex flex-col items-center mb-10">
    <div class="flex justify-center gap-2 mb-4">
      <button onclick="mostrarRanquing('Tots')" class="${estilsBotons} ${filtreGrup === "Tots" ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-100" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"}">Tots</button>
      <button onclick="mostrarRanquing('Grup A')" class="${estilsBotons} ${filtreGrup === "Grup A" ? "bg-amber-500 text-white border-amber-500 shadow-amber-100" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"}">Grup A 🍎</button>
      <button onclick="mostrarRanquing('Grup B')" class="${estilsBotons} ${filtreGrup === "Grup B" ? "bg-emerald-500 text-white border-emerald-500 shadow-emerald-100" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"}">Grup B 🍏</button>
    </div>
    
    <button onclick="refrescarDadesRanquing()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-300 border border-transparent hover:border-indigo-100">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      Sincronitzar dades
    </button>
  </div>
`;

    const llistaHtml =
      companys.length > 0
        ? companys
            .map((c, i) => {
              let medal =
                i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1;
              let bgClass =
                i === 0
                  ? "bg-amber-50 border-amber-200"
                  : i === 1
                    ? "bg-slate-50 border-slate-200"
                    : i === 2
                      ? "bg-orange-50 border-orange-200"
                      : "bg-white border-slate-100";

              return `
            <div class="flex items-center justify-between p-4 rounded-2xl border mb-3 transition-all hover:shadow-md ${bgClass}">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 flex items-center justify-center rounded-full font-black text-xs ${i < 3 ? "bg-white shadow-sm" : "bg-slate-100 text-slate-400"}">
                  ${medal}
                </div>
                <div>
                  <p class="font-black text-slate-700 uppercase text-xs tracking-tight">${c.nom}</p>
                  <p class="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">${c.grup}</p>
                </div>
              </div>
              <div class="text-right">
                <span class="text-xs font-black text-indigo-600 px-3 py-1 bg-white rounded-lg border shadow-sm">${c.punts} PTS</span>
              </div>
            </div>`;
            })
            .join("")
        : `<p class="text-center text-slate-400 py-10 italic">No hi ha dades.</p>`;

    container.innerHTML =
      botonsHtml +
      `<div class="max-w-xl mx-auto animate-in fade-in duration-500">${llistaHtml}</div>`;
  } catch (e) {
    console.error("Error al rànquing:", e);
    container.innerHTML = `<div class="p-6 bg-red-50 text-red-600 rounded-2xl text-center font-bold">Error de connexió</div>`;
  }
}

// 4. OPCIONAL: Funció per forçar actualització si volem dades fresques
// Funció per forçar la recàrrega de dades reals de Google Sheets
async function refrescarDadesRanquing() {
  dadesRanquingCache = null; // Buidem la memòria temporal
  await mostrarRanquing(); // Tornem a executar la funció original
}

// Actualitza el rànquing automàticament cada 5 minuts (300.000 ms)
setInterval(() => {
  console.log("Actualitzant rànquing en segon pla...");
  refrescarDadesRanquing();
}, 300000);

// ----- Mostrar Ranquing ---------------------

function generarInformePDF() {
  // 1. Filtrem les preguntes que realment estan completades al Sheets
  const exercicisResolts = estat.preguntes.filter((p) =>
    estat.completats.includes(String(p.id)),
  );

  if (exercicisResolts.length === 0) {
    alert("Encara no tens cap exercici registrat al núvol!");
    return;
  }

  const finestra = window.open("", "_blank");

  // (Estils CSS... pots mantenir els que ja tenies)
  const estils = `<style>
    body { font-family: 'Helvetica', sans-serif; color: #334155; padding: 40px; }
    .header { border-bottom: 4px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; }
    .assentament { margin-bottom: 40px; page-break-inside: avoid; }
    .enunciat { font-size: 13px; font-weight: bold; background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { border: 1px solid #e2e8f0; background: #f1f5f9; padding: 10px; text-align: left; }
    td { border: 1px solid #e2e8f0; padding: 10px; }
    .num { text-align: right; font-weight: bold; }
  </style>`;

  let contingut = `<html><head>${estils}</head><body>
    <div class="header">
      <h1>Llibre Diari Oficial</h1>
      <p>Alumne: ${estat.userActiu.nom} | Grup: ${estat.userActiu.grup}</p>
    </div>`;

  // 2. Generem les taules basant-nos en la SOLUCIÓ VALIDADA
  exercicisResolts.forEach((ex, index) => {
    contingut += `
      <div class="assentament">
        <div class="enunciat">Exercici ${ex.id}: ${ex.enunciat}</div>
        <table>
          <thead>
            <tr>
              <th width="15%">Codi PGC</th>
              <th width="45%">Compte</th>
              <th width="20%">Deure</th>
              <th width="20%">Haver</th>
            </tr>
          </thead>
          <tbody>
            ${ex.solucio
              .map(
                (l) => `
              <tr>
                <td class="num">${l.codi}</td>
                <td>${l.nom || "Compte oficial"}</td>
                <td class="num">${l.deure > 0 ? l.deure.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €" : "-"}</td>
                <td class="num">${l.haver > 0 ? l.haver.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €" : "-"}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  });

  contingut += `</body></html>`;
  finestra.document.write(contingut);
  finestra.document.close();
  setTimeout(() => {
    finestra.print();
  }, 500);
}

let calculadoraMode = "directe"; // o 'invers'

function toggleCalculadora() {
  const calc = document.getElementById("calc-iva");
  calc.classList.toggle("hidden");
}

function setCalcMode(mode) {
  calculadoraMode = mode;
  const btnD = document.getElementById("mode-directe");
  const btnI = document.getElementById("mode-invers");
  const labelInput = document.getElementById("label-input");
  const labelRes1 = document.getElementById("label-res-1");
  const labelRes2 = document.getElementById("label-res-2");

  if (mode === "directe") {
    btnD.className =
      "flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg bg-white shadow-sm text-indigo-600 transition-all";
    btnI.className =
      "flex-1 py-1.5 text-[9px] font-black uppercase text-slate-500 transition-all";
    labelInput.innerText = "Import Base";
    labelRes1.innerText = "IVA (21%)";
    labelRes2.innerText = "Total Factura";
  } else {
    btnI.className =
      "flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg bg-white shadow-sm text-indigo-600 transition-all";
    btnD.className =
      "flex-1 py-1.5 text-[9px] font-black uppercase text-slate-500 transition-all";
    labelInput.innerText = "Total Factura (IVA inclòs)";
    labelRes1.innerText = "Base Imposable";
    labelRes2.innerText = "Quota IVA (21%)";
  }
  executarCalculIva();
}

function executarCalculIva() {
  const inputElement = document.getElementById("calc-input");
  const valor = parseFloat(inputElement.value) || 0;

  const res1 = document.getElementById("res-val-1");
  const res2 = document.getElementById("res-val-2");

  if (calculadoraMode === "directe") {
    // Càlcul Directe: Base -> IVA i Total
    const quota = valor * ivaSeleccionat; // Utilitza la variable global corregida
    const total = valor + quota;

    res1.innerText = quota.toFixed(2) + "€";
    res2.innerText = total.toFixed(2) + "€";
  } else {
    // Càlcul Invers: Total -> Base i IVA
    const factor = 1 + ivaSeleccionat;
    const base = valor / factor;
    const quota = valor - base;

    res1.innerText = base.toFixed(2) + "€";
    res2.innerText = quota.toFixed(2) + "€";
  }
}

function copiarAlPortapapers(id) {
  const text = document.getElementById(id).innerText.replace("€", "");
  navigator.clipboard.writeText(text);

  // Feedback ràpid
  const valElement = document.getElementById(id);
  const colorOriginal = valElement.className;
  valElement.className = "font-black text-emerald-500 scale-110 transition-all";
  setTimeout(() => (valElement.className = colorOriginal), 500);
}

function setIvaPerc(valor, el) {
  ivaSeleccionat = valor; // Actualitzem la variable global (0.21, 0.10 o 0.04)

  // Reset de l'estil de tots els botons d'IVA
  document.querySelectorAll(".iva-btn").forEach((btn) => {
    btn.classList.remove("bg-indigo-600", "text-white");
    btn.classList.add("bg-slate-100", "text-slate-600");
  });

  // Activem el botó clicat
  el.classList.remove("bg-slate-100", "text-slate-600");
  el.classList.add("bg-indigo-600", "text-white");

  executarCalculIva(); // Recalculem automàticament
}
//--- Informes FINANCER -----------------------------------------------------------

// Estats Financers Informes //
function generarBalançITema() {
  const container = document.getElementById("seccio-consultes-financeres");
  const moviments = obtenirTotsElsMovimentsDelTema(); // Dades de estat.preguntes filtrades

  // Classifiquem per "codi de compte"
  const balanc = { actiu: {}, passiu: {}, p_i_g: {} };

  // ... lògica de classificació ...

  container.innerHTML = `
    <div class="space-y-4">
      <h2 class="text-lg font-bold">Balanç de Situació - Tema: ${estat.temaActiu}</h2>
      ${renderitzarGrupBalanç("ACTIU", balanc.actiu)}
      ${renderitzarGrupBalanç("PASSIU I PN", balanc.passiu)}
      <h2 class="text-lg font-bold mt-8">Pèrdues i Guanys</h2>
      ${renderitzarGrupBalanç("RESULTAT", balanc.p_i_g)}
    </div>
  `;
}

function obtenirMovimentsDetallatsTema() {
  const temaActual = String(estat.temaActiu || "").trim();
  const completatsStr = estat.completats.map((id) => String(id).trim());

  const activitats = estat.preguntes.filter((p) => {
    return (
      String(p.tema).trim() === temaActual &&
      completatsStr.includes(String(p.id).trim())
    );
  });

  let llistat = [];
  activitats.forEach((p) => {
    if (p.solucio && Array.isArray(p.solucio)) {
      p.solucio.forEach((linia) => {
        llistat.push({
          codi: String(linia.codi).trim(),
          deure: parseFloat(linia.deure || 0),
          haver: parseFloat(linia.haver || 0),
          concepte: p.descripcio || p.enunciat || "Assentament", // Aquí usem la teva columna Q
          id: p.id,
        });
      });
    }
  });
  return llistat;
}

//A. El "Motor" de dades (Processar moviments)
// 1. ESTRUCTURA DE PÈRDUES I GUANYS SEGONS EL PGC
function mostrarInformesFinancers() {
  const container = document.getElementById("seccio-informes");
  if (!container) return;

  const llistaTemes = [
    ...new Set(estat.preguntes.map((p) => p.Tema || p.tema)),
  ].filter(Boolean);

  const moviments = obtenirMovimentsDetallatsTema();
  const saldos = {};
  let r_ing = 0,
    r_des = 0;

  moviments.forEach((m) => {
    if (!saldos[m.codi])
      saldos[m.codi] = {
        nom: cercarNomCompte(m.codi),
        saldo: 0,
        deure: 0,
        haver: 0,
      };

    saldos[m.codi].deure += m.deure;
    saldos[m.codi].haver += m.haver;
    saldos[m.codi].saldo += m.deure - m.haver;

    if (String(m.codi).startsWith("7")) r_ing += m.haver - m.deure;
    if (String(m.codi).startsWith("6")) r_des += m.deure - m.haver;
  });

  const resExercici = r_ing - r_des;
  let totalActiuGlobal = 0;
  let totalPassiuGlobal = 0;

  // RENDERITZADOR DE BALANÇ (ACTIU / PASSIU)
  const renderTaulaPGC = (bloc, esPassiu = false) => {
    return bloc
      .map((seccio) => {
        let sumaSeccio = 0;
        const htmlSub = seccio.sub
          .map((s) => {
            let saldoSub = 0;
            let comptesHTML = "";

            if (s.esResultat) {
              saldoSub = resExercici;
              comptesHTML = `
            <div class="flex justify-between items-center pl-8 py-1 text-[10px] text-slate-400 italic">
              <span>(Càlcul P&G)</span>
              <span class="w-32 text-right">${formatSAP(resExercici)}</span>
            </div>`;
            } else {
              const codis = Object.keys(saldos).filter((c) => s.regex.test(c));
              const saldoNetGrup = codis.reduce(
                (acc, c) => acc + saldos[c].saldo,
                0,
              );
              saldoSub = esPassiu ? -saldoNetGrup : saldoNetGrup;

              comptesHTML = codis
                .map((c) => {
                  const saldoIndividual = esPassiu
                    ? -saldos[c].saldo
                    : saldos[c].saldo;
                  // CORRECCIÓ: Fem servir veureDetallCompte
                  return `
              <div onclick="veureDetallCompte('${c}')" class="flex justify-between items-center pl-8 py-1 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 group">
                <span class="text-[11px] text-slate-600 group-hover:text-indigo-700"><b>${c}</b> ${saldos[c].nom}</span>
                <span class="w-32 text-right font-mono text-[11px] text-slate-500">${formatSAP(saldoIndividual)}</span>
              </div>`;
                })
                .join("");
            }

            sumaSeccio += saldoSub;
            return `
          <div class="border-b border-slate-100 last:border-0">
            <div class="flex justify-between items-center px-4 py-2 bg-slate-50/30">
              <span class="text-[10px] font-bold text-slate-700 uppercase">${s.titol}</span>
              <span class="w-32 text-right font-mono text-[11px] font-bold">${formatSAP(saldoSub)}</span>
            </div>
            ${comptesHTML}
          </div>`;
          })
          .join("");

        if (esPassiu) totalPassiuGlobal += sumaSeccio;
        else totalActiuGlobal += sumaSeccio;

        return `
        <div class="mb-4 bg-white border-x border-slate-200">
          <div class="bg-slate-200/50 px-4 py-1.5 border-y border-slate-200 flex justify-between items-center uppercase font-black text-[10px] tracking-widest text-slate-900">
            <span>${seccio.titol}</span>
            <span class="w-32 text-right font-mono">${formatSAP(sumaSeccio)}</span>
          </div>
          ${htmlSub}
        </div>`;
      })
      .join("");
  };

  container.innerHTML = `
    <div class="p-8 max-w-7xl mx-auto font-sans bg-white shadow-2xl my-10 border border-slate-300">
      
      <div class="flex justify-between items-start mb-10 border-b-2 border-slate-900 pb-6">
        <div>
          <h1 class="text-2xl font-black text-slate-900 uppercase tracking-tighter">Estats Comptables Oficials</h1>
          <p class="text-xs text-slate-500 font-bold uppercase tracking-widest">Tema: ${estat.temaActiu} | Exercici 202X</p>
        </div>
        <div class="no-print bg-slate-100 p-3 rounded flex items-center gap-3">
          <select onchange="estat.temaActiu=this.value; mostrarInformesFinancers();" class="text-xs font-bold bg-transparent border-none">
            ${llistaTemes.map((t) => `<option value="${t}" ${t === estat.temaActiu ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-slate-300">
        <div class="border-r border-slate-300">
          <div class="bg-slate-900 text-white p-2 text-center text-xs font-bold uppercase tracking-widest">Actiu (Inversions)</div>
          ${renderTaulaPGC(ESTRUCTURA_PGC_FINAL.actiu)}
          <div class="bg-slate-900 text-white p-4 flex justify-between items-center mt-auto">
            <span class="text-xs font-black uppercase">TOTAL ACTIU</span>
            <span class="font-mono text-lg font-black">${formatSAP(totalActiuGlobal)}</span>
          </div>
        </div>

        <div class="flex flex-col">
          <div class="bg-slate-800 text-white p-2 text-center text-xs font-bold uppercase tracking-widest">Patrimoni Net i Passiu</div>
          ${renderTaulaPGC(ESTRUCTURA_PGC_FINAL.passiu, true)}
          <div class="bg-slate-800 text-white p-4 flex justify-between items-center mt-auto border-t border-slate-600">
            <span class="text-xs font-black uppercase">TOTAL PATRIMONI I PASSIU</span>
            <span class="font-mono text-lg font-black">${formatSAP(totalPassiuGlobal)}</span>
          </div>
        </div>
      </div>

      <div class="mt-12 border border-slate-300 bg-white">
        <div class="bg-indigo-900 text-white p-2 text-center text-xs font-bold uppercase tracking-widest italic">
          Compte de Pèrdues i Guanys (Estructura PGC)
        </div>
        
        <div class="p-0">
          ${(() => {
            let acumExplotacio = 0;
            let acumFinancer = 0;

            return ESTRUCTURA_PYG_PGC.map((e) => {
              if (e.esSubtotal) {
                let valor = 0;
                let classeFons =
                  "bg-slate-100 font-bold border-y border-slate-200";
                if (e.esSubtotal === "explotacio") valor = acumExplotacio;
                if (e.esSubtotal === "financer") valor = acumFinancer;
                if (e.esSubtotal === "ebt")
                  valor = acumExplotacio + acumFinancer;
                if (e.esSubtotal === "final") {
                  valor = resExercici;
                  classeFons = "bg-indigo-900 text-white font-black text-sm";
                }
                return `
                  <div class="flex justify-between px-4 py-3 ${classeFons} text-[10px] uppercase">
                    <span>${e.titol}</span>
                    <span class="font-mono">${formatSAP(valor)}</span>
                  </div>`;
              }

              const codisEpigraf = Object.keys(saldos).filter((c) =>
                e.regex.test(c),
              );
              let sumaEpigraf = 0;

              const htmlComptes = codisEpigraf
                .map((c) => {
                  const s = saldos[c];
                  const saldoNet = c.startsWith("7")
                    ? s.haver - s.deure
                    : s.deure - s.haver;
                  const impacte = c.startsWith("7") ? saldoNet : -saldoNet;
                  sumaEpigraf += impacte;

                  if (e.titol.match(/^[1-6]/)) acumExplotacio += impacte;
                  if (e.titol.match(/^[7-8]/)) acumFinancer += impacte;

                  // CORRECCIÓ: Fem servir veureDetallCompte
                  return `
                  <div onclick="veureDetallCompte('${c}')" class="flex justify-between pl-10 pr-4 py-1 text-[10px] text-slate-500 italic border-b border-slate-50 hover:bg-indigo-50 cursor-pointer group">
                    <span class="group-hover:text-indigo-700"><b>${c}</b> ${s.nom}</span>
                    <span class="font-mono">${formatSAP(saldoNet)}</span>
                  </div>`;
                })
                .join("");

              if (codisEpigraf.length === 0) return "";

              return `
                <div>
                  <div class="flex justify-between px-4 py-2 text-[10px] font-bold text-slate-700 bg-slate-50/50 border-b border-slate-100">
                    <span>${e.titol}</span>
                    <span class="font-mono">${formatSAP(sumaEpigraf)}</span>
                  </div>
                  ${htmlComptes}
                </div>`;
            }).join("");
          })()}
        </div>
      </div>
    </div>
    <div id="modal-drilldown" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4"></div>
  `;
}
// B. Generació del Balanç i P&G (Visió SAP)
// Aquesta funció agrupa els moviments i els presenta com un informe oficial.
function veureDetallCompte(codi) {
  const moviments = obtenirMovimentsDetallatsTema().filter(
    (m) => String(m.codi) === String(codi),
  );
  const modal = document.getElementById("modal-drilldown");
  if (!modal) return;

  // --- CONFIGURACIÓ DE SIGNES ---
  // Afegeix aquí els prefixos segons el comportament que vulguis:

  const regles = {
    // Sumen per l'HAVER (H-D): Ingressos, Deutes, Devolucions de compra
    positiusHaver: [
      "7",
      "1",
      "40",
      "41",
      "475",
      "477",
      "52",
      "17",
      "606",
      "608",
      "609",
    ],

    // Sumen pel DEURE (D-H): Actius, Despeses, Devolucions de venda
    positiusDeure: [
      "2",
      "3",
      "43",
      "472",
      "57",
      "600",
      "601",
      "602",
      "607",
      "62",
      "708",
      "709",
    ],
  };

  // Funció interna per decidir el signe
  const decidirSigne = (c) => {
    const codiStr = String(c);
    // 1. Prioritat: Si està a la llista d'Haver (com la 608 que és "excepció" del grup 6)
    if (regles.positiusHaver.some((p) => codiStr.startsWith(p))) return "H-D";
    // 2. Si està a la llista de Deure
    if (regles.positiusDeure.some((p) => codiStr.startsWith(p))) return "D-H";
    // 3. Per defecte (casos no definits), mirem el primer número
    return codiStr.startsWith("6") ||
      codiStr.startsWith("2") ||
      codiStr.startsWith("43")
      ? "D-H"
      : "H-D";
  };

  const modeSigne = decidirSigne(codi);
  let saldoAcu = 0;

  const files = moviments
    .map((m) => {
      // Apliquem la lògica segons el mode decidit
      const impacte =
        modeSigne === "H-D" ? m.haver - m.deure : m.deure - m.haver;

      // AJUST ESPECÍFIC P&G: Si és una despesa pura (600, 62...) i volem que resti al drill-down
      // Com que a la P&G vols veure la 600 com a "-2.600", forcem el signe negatiu aquí:
      let impacteVisual = impacte;
      if (
        codi.startsWith("6") &&
        !["606", "608", "609"].some((p) => codi.startsWith(p))
      ) {
        impacteVisual = impacte * -1;
      }

      saldoAcu += impacteVisual;

      return `
      <tr class="text-[11px] border-b border-slate-100 hover:bg-slate-50 transition">
        <td class="p-3 text-slate-400 font-mono italic">#${m.id}</td>
        <td class="p-3 text-slate-700 font-medium">${m.concepte || "Apunt"}</td>
        <td class="p-3 text-right font-mono text-emerald-600">${m.deure > 0 ? formatSAP(m.deure) : "-"}</td>
        <td class="p-3 text-right font-mono text-rose-600">${m.haver > 0 ? formatSAP(m.haver) : "-"}</td>
        <td class="p-3 text-right font-mono font-bold ${saldoAcu >= 0 ? "text-slate-900" : "text-rose-600"}">
          ${formatSAP(saldoAcu)}
        </td>
      </tr>`;
    })
    .join("");

  // Estructura visual del Modal (HTML)
  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-300">
      <div class="bg-slate-800 p-4 flex justify-between items-center text-white">
        <div>
          <h3 class="text-lg font-bold">${codi} - ${cercarNomCompte(codi)}</h3>
          <p class="text-[9px] text-slate-400 uppercase tracking-widest">
            Mode: ${codi.startsWith("6") ? "Impacte en P&G (Negatiu = Despesa)" : "Saldo Acumulat"}
          </p>
        </div>
        <button onclick="document.getElementById('modal-drilldown').classList.add('hidden')" class="w-8 h-8 rounded-full bg-slate-700 hover:bg-rose-600 transition">✕</button>
      </div>
      <div class="max-h-[50vh] overflow-y-auto">
        <table class="w-full text-left">
          <thead class="sticky top-0 bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b">
            <tr>
              <th class="p-3">Ref</th>
              <th class="p-3">Concepte</th>
              <th class="p-3 text-right text-emerald-700">Deure</th>
              <th class="p-3 text-right text-rose-700">Haver</th>
              <th class="p-3 text-right bg-slate-100/50">Saldo</th>
            </tr>
          </thead>
          <tbody>${files}</tbody>
        </table>
      </div>
      <div class="p-4 bg-slate-100 border-t flex justify-between items-center">
        <span class="text-[10px] text-slate-500 italic">El signe reflecteix el comportament en l'informe financer.</span>
        <div class="text-right">
          <div class="text-[10px] font-bold text-slate-400 uppercase">Saldo Final</div>
          <div class="text-xl font-black ${saldoAcu >= 0 ? "text-slate-900" : "text-rose-600"}">${formatSAP(saldoAcu)}</div>
        </div>
      </div>
    </div>`;
  modal.classList.remove("hidden");
}
window.obrirDrillDown = function (codi) {
  const moviments = obtenirMovimentsDetallatsTema();
  const movsCompte = moviments.filter((m) => m.codi === codi);
  const nom = cercarNomCompte(codi);
  const modal = document.getElementById("modal-audit");

  if (!modal) return;

  let files = movsCompte
    .map(
      (m) => `
    <tr class="border-b border-slate-100 text-[11px] hover:bg-indigo-50/30">
      <td class="p-3 text-slate-400 font-mono italic">#${m.id}</td>
      <td class="p-3 font-medium text-slate-700">${m.concepte}</td>
      <td class="p-3 text-right font-mono text-indigo-600 bg-indigo-50/20">${m.deure > 0 ? formatSAP(m.deure) : "-"}</td>
      <td class="p-3 text-right font-mono text-rose-600 bg-rose-50/20">${m.haver > 0 ? formatSAP(m.haver) : "-"}</td>
    </tr>
  `,
    )
    .join("");

  modal.innerHTML = `
    <div class="bg-white rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-300 animate-in zoom-in duration-150">
      <div class="bg-slate-900 p-5 text-white flex justify-between items-center">
        <div>
          <h3 class="text-lg font-black uppercase tracking-tighter italic">Auditoria Major: ${codi}</h3>
          <p class="text-[10px] text-slate-400 font-bold uppercase">${nom}</p>
        </div>
        <button onclick="document.getElementById('modal-audit').classList.add('hidden')" class="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-xl">&times;</button>
      </div>
      <div class="max-h-[60vh] overflow-y-auto">
        <table class="w-full text-left border-collapse">
          <thead class="bg-slate-100 sticky top-0 border-b border-slate-300">
            <tr class="text-[10px] font-black uppercase text-slate-500">
              <th class="p-3">Ref</th>
              <th class="p-3">Concepte (Columna Q)</th>
              <th class="p-3 text-right">Deure (+)</th>
              <th class="p-3 text-right">Haver (-)</th>
            </tr>
          </thead>
          <tbody>${files}</tbody>
        </table>
      </div>
      <div class="p-5 bg-slate-900 text-white flex justify-between items-center">
        <span class="text-[10px] font-bold uppercase opacity-60 italic underline">Final Audit Statement</span>
        <div class="text-right">
          <span class="text-[10px] font-black uppercase block opacity-60">Saldo Net del Compte</span>
          <span class="text-2xl font-mono font-black">${formatSAP(movsCompte.reduce((acc, m) => acc + (m.deure - m.haver), 0))}</span>
        </div>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");
};

function seleccionarTemaDesDeInformes(nouTema) {
  if (!nouTema) return;
  estat.temaActiu = nouTema;
  // Refresquem la vista immediatament
  mostrarInformesFinancers();
}

function cercarNomCompte(codi) {
  if (!estat.pgc) return "Compte " + codi;
  const compte = estat.pgc.find(
    (c) => String(c.Codi || c.codi).trim() === String(codi).trim(),
  );
  return compte ? compte.Nom || compte.nom : "Compte " + codi;
}

//--- Informes FINANCER -----------------------------------------------------------

//3. Implementació del Codi (Estructura Resumit)
function renderitzarSeccioPGC(titol, filtre, saldos) {
  // Filtrem quins comptes de "saldos" pertanyen a aquest epígraf
  const comptesSeccio = Object.keys(saldos).filter((codi) => filtre.test(codi));
  if (comptesSeccio.length === 0) return "";

  let sumaTotal = 0;
  let htmlComptes = comptesSeccio
    .map((codi) => {
      const s = saldos[codi];
      const saldo = s.deure - s.haver;
      sumaTotal += saldo;
      return `
      <div onclick="veureDetallCompte('${codi}')" class="flex justify-between pl-8 py-1 hover:bg-indigo-50 cursor-pointer text-[10px] border-l-2 border-slate-100 ml-4">
        <span class="text-slate-600">${codi} - ${s.nom}</span>
        <span class="font-mono font-bold">${Math.abs(saldo).toFixed(2)}€</span>
      </div>`;
    })
    .join("");

  return `
    <div class="mb-4">
      <div class="flex justify-between bg-slate-100 p-2 rounded-lg font-black text-[11px] text-slate-700 uppercase tracking-tighter">
        <span>${titol}</span>
        <span>${Math.abs(sumaTotal).toFixed(2)}€</span>
      </div>
      <div class="mt-1">${htmlComptes}</div>
    </div>
  `;
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  // Simplement afegim o treiem la classe que amaga l'aside
  sidebar.classList.toggle("-translate-x-full");
}

// Gestió de la tecla Intro per navegar com un professional
document.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    const activeEl = document.activeElement;

    // Si estem dins d'un input de la taula de diari
    if (
      activeEl.classList.contains("select-compte") ||
      activeEl.classList.contains("input-deure") ||
      activeEl.classList.contains("input-haver")
    ) {
      e.preventDefault(); // Evitem que l'Intro faci coses rares
      const fila = activeEl.closest("tr");

      // 1. Si estem al CODI
      if (activeEl.classList.contains("select-compte")) {
        // Anem al DEURE
        fila.querySelector(".input-deure").focus();
      }

      // 2. Si estem al DEURE
      else if (activeEl.classList.contains("input-deure")) {
        if (activeEl.value === "" || parseFloat(activeEl.value) === 0) {
          // Si està buit, anem al HAVER de la mateixa fila
          fila.querySelector(".input-haver").focus();
        } else {
          // Si té dades, anem a una NOVA FILA (Codi)
          accionsTeclatNovaFila();
        }
      }

      // 3. Si estem al HAVER
      else if (activeEl.classList.contains("input-haver")) {
        // Anem a una NOVA FILA (Codi)
        accionsTeclatNovaFila();
      }
    }
  }
});

function accionsTeclatNovaFila() {
  afegirFila(); // Cridem la teva funció existent
  // Esperem un mil·lisegon que el DOM es refresqui i anem a l'última fila creada
  setTimeout(() => {
    const files = document.querySelectorAll("#diari-body tr");
    const ultimaFila = files[files.length - 1];
    if (ultimaFila) ultimaFila.querySelector(".select-compte").focus();
  }, 10);
}

function logout() {
  // Esborrem les dades de sessió guardades al navegador
  localStorage.removeItem("olimpic_user");
  // Recarreguem la pàgina per tornar al formulari de login
  location.reload();
}
