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
  "https://script.google.com/macros/s/AKfycby8O_jIylWFg7TUHDUMCkT5VLoctt4X7R94qXB0Sti6Ddrs0vVPBBDVAholVuYepXG7/exec"; // <--- ENGANXA LA URL AQUÍ
let modoActual = "login";

// Aquest objecte contindrà tots els epígrafs dels teus PDFs
// ESTRUCTURA PGC SEGONS ELS TEUS PDFS
const ESTRUCTURA_PGC_FINAL = {
  actiu: [
    {
      titol: "A) ACTIU NO CORRENT",
      sub: [
        { titol: "I. Immobilitzat intangible", regex: /^(20|280|290)/ },
        { titol: "II. Immobilitzat material", regex: /^(21|23|281|291)/ },
        { titol: "III. Inversions immobiliàries", regex: /^(22|282|292)/ },
        {
          titol: "VI. Inversions financeres a llarg termini",
          regex: /^(24|25)/,
        },
      ],
    },
    {
      titol: "B) ACTIU CORRENT",
      sub: [
        { titol: "I. Existències", regex: /^(3|407)/ },
        {
          titol: "II. Deutors comercials i altres comptes a cobrar",
          regex: /^(43|44|470|471|472|473)/,
        },
        {
          titol: "IV. Inversions financeres a curt termini",
          regex: /^(53|54|551|5525|554|59)/,
        },
        {
          titol: "VI. Efectiu i altres actius líquids equivalents",
          regex: /^(57)/,
        },
      ],
    },
  ],
  passiu: [
    {
      titol: "A) PATRIMONI NET",
      sub: [
        { titol: "I. Capital Social", regex: /^(10)/ },
        { titol: "VII. Resultat de l'exercici", esResultat: true }, // Aquí s'integra P&G
      ],
    },
    {
      titol: "B) PASSIU NO CORRENT",
      sub: [
        { titol: "I. Provisions a llarg termini", regex: /^(14)/ },
        {
          titol: "III. Deutes a llarg termini",
          regex: /^(17|15)/,
        },
      ],
    },
    {
      titol: "C) PASSIU CORRENT",
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

//Filtrar temas pendent / generar temas
function generarMenuTemes() {
  const menu = document.getElementById("menu-temes");
  if (!menu) return;

  if (!estat.preguntes || estat.preguntes.length === 0) {
    console.error("ERROR: estat.preguntes està buit!");
    return;
  }

  const filtreCheck = document.getElementById("filtre-pendents");
  const nomesPendents = filtreCheck && filtreCheck.checked === true;

  // 1. Obtenim la llista de temes únics
  let llistaTemesOriginals = [
    ...new Set(estat.preguntes.map((p) => p.Tema || p.tema)),
  ].filter(Boolean);

  // 2. Apliquem el filtre de pendents si cal
  if (nomesPendents) {
    llistaTemesOriginals = llistaTemesOriginals.filter((nomTema) => {
      const preguntesDelTema = estat.preguntes.filter(
        (p) => (p.Tema || p.tema) === nomTema,
      );
      const total = preguntesDelTema.length;
      const fets = preguntesDelTema.filter((p) => {
        const id = String(p.ID_Activitat || p.id);
        return estat.completats.map(String).includes(id);
      }).length;
      return fets < total;
    });
  }

  // 3. AGRUPACIÓ PER CARPETES
  const estructurats = {};
  llistaTemesOriginals.forEach((temaFull) => {
    const parts = temaFull.includes(":")
      ? temaFull.split(":")
      : ["GENERAL", temaFull];
    const carpeta = parts[0].trim();
    const subtema = parts[1].trim();

    if (!estructurats[carpeta]) estructurats[carpeta] = [];
    estructurats[carpeta].push({ original: temaFull, net: subtema });
  });

  // 4. GENERACIÓ DEL HTML (Doble Acordió)
  menu.innerHTML = Object.keys(estructurats)
    .map((nomCarpeta) => {
      const subtemes = estructurats[nomCarpeta];

      // Verifiquem si la carpeta conté el tema actiu per deixar-la oberta
      const teTemaActiu = subtemes.some((s) => s.original === estat.temaActiu);

      const htmlSubtemes = subtemes
        .map((item) => {
          const nomTema = item.original;
          const preguntesDelTema = estat.preguntes.filter(
            (p) => (p.Tema || p.tema) === nomTema,
          );
          const totalActivitats = preguntesDelTema.length;
          const numCompletades = preguntesDelTema.filter((p) => {
            const id = String(p.ID_Activitat || p.id);
            return estat.completats.map(String).includes(id);
          }).length;

          const estaAcabat = numCompletades === totalActivitats;
          let colorClasseTema = "text-indigo-300";
          if (estaAcabat) colorClasseTema = "text-emerald-500";
          else if (numCompletades > 0) colorClasseTema = "text-amber-500";

          const esTemaActiu = estat.temaActiu === nomTema;

          return `
      <li class="mb-1 ml-2">
        <details class="group/sub" ${esTemaActiu ? "open" : ""}>
          <summary class="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-800/40 transition ${colorClasseTema} font-bold text-[10px] uppercase tracking-wide list-none border border-transparent hover:border-slate-700">
            <span class="flex items-center gap-2">
              <span class="group-open/sub:rotate-90 transition-transform text-[7px] opacity-50">▶</span>
              ${item.net}
              <span class="text-[8px] opacity-60 font-black">(${numCompletades}/${totalActivitats})</span>
            </span>
          </summary>
          <ul class="mt-1 space-y-0.5 border-l border-slate-800 ml-4 py-1">
            ${preguntesDelTema
              .map((p, index) => {
                const idPregunta = String(p.ID_Activitat || p.id);
                const feta = estat.completats.map(String).includes(idPregunta);
                const esActiva =
                  estat.preguntaActual &&
                  String(
                    estat.preguntaActual.ID_Activitat ||
                      estat.preguntaActual.id,
                  ) === idPregunta;
                return `
                <li>
                  <button onclick="seleccionarPreguntaDirecta('${idPregunta}')" 
                    class="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-all ${esActiva ? "bg-indigo-500/10 border border-indigo-500/20" : "hover:bg-slate-800/40"}">
                    <div class="w-4 h-4 shrink-0 flex items-center justify-center rounded text-[8px] font-bold border ${esActiva ? "bg-indigo-600 text-white" : feta ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-600"}">
                      ${feta ? "✓" : index + 1}
                    </div>
                    <span class="text-[10px] font-bold truncate ${esActiva ? "text-indigo-200" : feta ? "text-slate-500" : "text-slate-400 group-hover:text-white"}">
                      ${p.Descripcio || p.descripcio || `Act. ${index + 1}`}
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

      // Retornem la CARPETA principal com a <details>
      return `
      <div class="mb-2 px-2">
        <details class="group/folder" ${teTemaActiu ? "open" : ""}>
          <summary class="flex items-center justify-between p-3 bg-slate-800/60 hover:bg-slate-800 rounded-xl cursor-pointer transition-all list-none border border-slate-700/50">
            <div class="flex items-center gap-3">
              <span class="text-indigo-400 group-open/folder:hidden">📂</span>
              <span class="text-indigo-300 hidden group-open/folder:block">📂</span>
              <span class="text-[10px] font-black text-slate-200 uppercase tracking-widest">${nomCarpeta}</span>
            </div>
            <span class="text-[8px] text-slate-500 group-open/folder:rotate-180 transition-transform">▼</span>
          </summary>
          <ul class="mt-2 space-y-1">
            ${htmlSubtemes}
          </ul>
        </details>
      </div>
    `;
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
  let dl = document.getElementById("pgc-list");
  if (!dl) {
    dl = document.createElement("datalist");
    dl.id = "pgc-list";
    document.body.appendChild(dl);
  }

  // Concatenem CODI + NOM dins del value perquè Safari ho mostri tot
  dl.innerHTML = estat.pgc
    .map((c) => `<option value="${c.codi} - ${c.nom}"></option>`)
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

  // 1. SEMPRE ACTUALITZAR L'ENUNCIAT I EL TEMA
  const enunciatEl = document.getElementById("txt-enunciat");
  const temaEl = document.getElementById("info-pregunta");

  if (enunciatEl) {
    enunciatEl.innerText = p.Enunciat || p.Descripcio || p.enunciat || "";
  }
  if (temaEl) {
    temaEl.innerText = p.Tema || p.tema || "";
  }

  const idActual = String(p.ID_Activitat || p.id).trim();
  const jaFeta = estat.completats.map(String).includes(idActual);

  if (jaFeta) {
    // --- MODE: JA VALIDADA ---

    // 2. Preparem dades de la solució
    let solData = [];
    try {
      const rawSol = p.Solucio || p.solucio || "[]";
      solData = typeof rawSol === "string" ? JSON.parse(rawSol) : rawSol;
    } catch (e) {
      console.error("Error parsejant solucio:", e);
    }

    const dadesPerTaula = prepararDadesSolucio(solData);

    // 3. Pintem la vista fixa (Això omple el 'seccio-resolucio')
    generarVisualitzacioCorrecta(
      dadesPerTaula,
      p.Referencia || p.referencia || `REF-${idActual}`,
      p.Explicacio || p.explicacio || "Assentament correcte.",
    );

    // 4. Gestionem botons (S'han de buscar DESPRÉS de generar la vista si estan dins)
    // Nota: Com que generarVisualitzacioCorrecta pot substituir el contingut,
    // ens assegurem de trobar els botons de la nova estructura.
    const btnValidar = document.getElementById("btn-validar");
    const btnSeguent = document.getElementById("btn-seguent");
    const btnSaltar = document.getElementById("btn-saltar");

    if (btnValidar) btnValidar.classList.add("hidden");
    if (btnSaltar) btnSaltar.classList.add("hidden");
    if (btnSeguent) {
      btnSeguent.classList.remove("hidden");
      btnSeguent.innerText = "Següent Exercici ➡️";
    }
  } else {
    // --- MODE: PER RESOLDRE (NOVA) ---

    // 2. Restaurem tota l'estructura de la taula i botons
    restaurarEstructuraTaulaInputs();

    // 3. Ara que hem restaurat el HTML, els botons tornen a existir
    const btnValidar = document.getElementById("btn-validar");
    const btnSeguent = document.getElementById("btn-seguent");
    const btnSaltar = document.getElementById("btn-saltar");

    if (btnValidar) btnValidar.classList.remove("hidden");
    if (btnSaltar) btnSaltar.classList.remove("hidden"); // Mostrem Saltar
    if (btnSeguent) btnSeguent.classList.add("hidden"); // Amaguem Següent (verd)

    // 4. Inicialitzem l'exercici buit
    estat.assentament = [];
    afegirFila();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function restaurarEstructuraTaulaInputs() {
  const contenidor = document.getElementById("seccio-resolucio");
  if (!contenidor) return;

  contenidor.innerHTML = `
    <div class="overflow-x-auto">
      <table id="taula-assentament" class="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr class="text-[10px] uppercase tracking-widest text-slate-400">
            <th class="px-4 py-2 font-black">Codi PGC</th>
            <th class="px-4 py-2 font-black">Compte i Descripció</th>
            <th class="px-4 py-2 font-black text-right">Deure</th>
            <th class="px-4 py-2 font-black text-right">Haver</th>
            <th class="px-4 py-2 text-center text-slate-300 italic font-medium tracking-tight">Acció</th>
          </tr>
        </thead>
        <tbody id="diari-body">
          </tbody>
      </table>
    </div>

    <div id="pe-taula-inputs" class="mt-4 flex justify-between items-center px-4">
      <button onclick="afegirFila()" class="group text-indigo-600 font-bold text-xs hover:text-indigo-800 transition-all uppercase tracking-widest flex items-center gap-2">
        <span class="bg-indigo-100 group-hover:bg-indigo-600 group-hover:text-white w-6 h-6 flex items-center justify-center rounded-full transition-colors font-bold">+</span> 
        Afegir línia
      </button>
      
      <div class="flex gap-8 text-right bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <p class="text-[9px] font-black text-slate-400 uppercase mb-1">Total Deure</p>
          <div id="total-deure" class="text-3xl font-black text-emerald-700">0,00 €</div>
        </div>
        <div>
          <p class="text-[9px] font-black text-slate-400 uppercase mb-1">Total Haver</p>
          <div id="total-haver" class="text-3xl font-black text-sky-700">0,00 €</div>
        </div>
      </div>
    </div>
  `;
}

function prepararDadesSolucio(solucioArray) {
  if (!Array.isArray(solucioArray)) return [];

  return solucioArray.map((linia) => {
    // Busquem el nom del compte al nostre PGC carregat
    const compteInfo = estat.pgc.find(
      (c) => String(c.codi) === String(linia.codi || linia.c),
    );
    return {
      codi: linia.codi || linia.c,
      nom: compteInfo ? compteInfo.nom : "Compte desconegut",
      deure: parseFloat(linia.deure || linia.d || 0),
      haver: parseFloat(linia.haver || linia.h || 0),
    };
  });
}
//--- Mostra apunt correcta -----------------------------------------------------------------------------------------------

function generarVisualitzacioCorrecta(
  dadesApunt,
  referencia = "S/REF",
  explicacio = "",
) {
  const contenidor = document.getElementById("seccio-resolucio");
  if (!contenidor) return;

  // Calculem el total una vegada per no repetir codi
  const total = dadesApunt.reduce((sum, l) => sum + (l.deure || 0), 0);

  contenidor.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-emerald-100 overflow-hidden mb-6 animate-fade-in">
      <div class="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="flex flex-col">
            <span class="font-black text-emerald-800 uppercase tracking-tighter text-xs leading-none">Assentament Validat</span>
            <span class="text-[9px] text-emerald-600 font-bold uppercase mt-1 tracking-widest">${referencia}</span>
          </div>
        </div>
        <span class="text-[10px] font-black text-emerald-600/40 uppercase tracking-widest">Llibre Diari</span>
      </div>

      <div class="p-0 overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/50 text-[9px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <th class="px-6 py-3 font-black">Codi</th>
              <th class="px-6 py-3 font-black">Compte</th>
              <th class="px-6 py-3 font-black text-right">Deure</th>
              <th class="px-6 py-3 font-black text-right">Haver</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            ${dadesApunt
              .map(
                (linia) => `
              <tr class="hover:bg-slate-50/30 transition-colors">
                <td class="px-6 py-4 font-mono text-xs font-bold text-indigo-600">${linia.codi}</td>
                <td class="px-6 py-4 text-xs font-bold text-slate-700 uppercase">${linia.nom}</td>
                <td class="px-6 py-4 text-xs text-right font-black ${linia.deure > 0 ? "text-slate-900" : "text-slate-200"}">
                  ${linia.deure > 0 ? formatarMoneda(linia.deure) : "—"}
                </td>
                <td class="px-6 py-4 text-xs text-right font-black ${linia.haver > 0 ? "text-slate-900" : "text-slate-200"}">
                  ${linia.haver > 0 ? formatarMoneda(linia.haver) : "—"}
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
          <tfoot>
            <tr class="bg-emerald-50/20 border-t-2 border-emerald-100/50">
               <td colspan="2" class="px-6 py-4 text-[10px] font-black text-emerald-800 uppercase text-right">Totals Quadrat</td>
               <td class="px-6 py-4 text-sm font-black text-emerald-700 text-right">${formatarMoneda(total)}</td>
               <td class="px-6 py-4 text-sm font-black text-emerald-700 text-right">${formatarMoneda(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="bg-slate-50/50 p-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div class="flex-1">
          <h4 class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 leading-none font-bold">Memòria d'operació</h4>
          <p class="text-xs text-slate-600 leading-relaxed italic font-medium">
            "${explicacio || "Assentament registrat correctament en el llibre diari segons el PGC."}"
          </p>
        </div>
        
        <button onclick="carregarSegüentPregunta()" class="w-full md:w-auto bg-emerald-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 active:scale-95 transition-all">
          Següent Exercici ➡️
        </button>
      </div>
    </div>

    <div class="mt-12 space-y-8 pt-8 border-t border-slate-100">
      <div class="flex items-center gap-3 mb-4">
          <div class="w-2 h-2 rounded-full bg-indigo-500"></div>
          <h3 class="text-[10px] font-black text-slate-800 uppercase tracking-widest">Saldos de Major Actualitzats</h3>
      </div>
    </div>
  `;

  // Executem la funció dels majors perquè es pintin automàticament
  if (typeof actualitzarMajors === "function") {
    actualitzarMajors();
  }
}

function validarExercici() {
  const resultats = comprovarRespostes(); // La teva lògica actual de validació

  if (resultats.percentatgeExit === 100) {
    // Si tot és correcte, substituïm la zona d'inputs per la vista formal
    generarVisualitzacioCorrecta(resultats.dadesAssentament);

    // Opcional: Llançar una petita animació de confeti o feedback positiu
    mostrarFeedbackExit();
  } else {
    // Mantenim la taula d'inputs i marquem els errors com fins ara
    marcarErrorsInterficie(resultats.errors);
  }
}

function restaurarEstructuraTaulaInputs() {
  const contenidor = document.getElementById("seccio-resolucio");
  if (!contenidor) return;

  contenidor.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table id="taula-assentament" class="w-full text-left min-w-[700px] border-collapse">
          <thead class="bg-slate-900 text-white uppercase text-[10px] font-black tracking-widest">
            <tr>
              <th class="p-4 w-32">Codi PGC</th>
              <th class="p-4">Compte i Descripció</th>
              <th class="p-4 text-right w-40">Deure</th>
              <th class="p-4 text-right w-40">Haver</th>
              <th class="p-4 w-20 text-center">Acció</th>
            </tr>
          </thead>
          <tbody id="diari-body" class="divide-y divide-slate-100 font-mono text-sm italic"></tbody>
          <tfoot class="bg-slate-50/80 font-black">
            <tr class="border-t-2 border-slate-200">
              <td colspan="2" class="p-4 text-right uppercase text-[10px] text-slate-400">Totals</td>
              <td id="total-deure" class="p-4 text-right text-emerald-600 text-lg">0.00 €</td>
              <td id="total-haver" class="p-4 text-right text-sky-600 text-lg">0.00 €</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="p-4 sm:p-6 bg-slate-100/50 border-t border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <button onclick="afegirFila()" class="w-full sm:w-auto text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:text-indigo-800 transition-colors">
          + Afegir línia d'apunt
        </button>

        <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button id="btn-validar" onclick="validarAssentament()" class="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">
            Validar
          </button>

          <button id="btn-saltar" onclick="carregarSegüentPregunta()" class="w-full sm:w-auto bg-slate-200 text-slate-600 px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-300 transition-all">
            Saltar Exercici ⏭️
          </button>
          
          <button id="btn-seguent" onclick="carregarSegüentPregunta()" class="hidden w-full sm:w-auto bg-emerald-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 active:scale-95 transition-all">
            Següent Exercici ➡️
          </button>
        </div>
      </div>
    </div>

    <div class="mt-12 space-y-12 pt-8 border-t border-slate-100">
      <div class="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
            <h3 class="text-[10px] font-black text-slate-800 uppercase tracking-widest">Saldos de Major</h3>
          </div>
        </div>
        <div id="majors-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <p class="text-[10px] text-slate-400 italic text-center col-span-full py-4">Fes l'assentament per veure els moviments.</p>
        </div>
      </div>
    </div>
  `;
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

  // --- NOU: NETEJA PER A COMPATIBILITAT AMB SAFARI/IPHONE ---
  // Si l'usuari selecciona del datalist, el valor pot ser "600 - Compres..."
  // Ens quedem només amb la part del codi (abans del guionet)
  if (camp === "codi" && valor.includes(" - ")) {
    valor = valor.split(" - ")[0].trim();
  }

  // 1. Actualitzem la dada a la memòria amb el valor ja netejat
  estat.assentament[index][camp] = valor;

  // 2. Busquem la fila a la pantalla per fer canvis visuals directes
  const fila = document.querySelector(`tr[data-index="${index}"]`);
  if (!fila) return;

  // 3. Si canvia el CODI, busquem el nom i l'actualitzem a la pantalla
  if (camp === "codi") {
    // Busquem al PGC usant el codi netejat
    const compteTrobat = estat.pgc.find(
      (c) => String(c.codi) === String(valor),
    );

    const nomNet = compteTrobat ? compteTrobat.nom : "Compte no trobat";
    estat.assentament[index].nom = nomNet;

    // Actualitzem el text de la descripció a la cel·la corresponent
    const cel·laNom = fila.querySelector(".nom-compte");
    if (cel·laNom) cel·laNom.innerText = nomNet;

    // OPCIONAL: Netejar l'input del codi perquè només quedi el número (ex: "600")
    // Això evita que l'input es vegi massa ple després de seleccionar
    const inputCodi = fila.querySelector(".select-compte");
    if (inputCodi) inputCodi.value = valor;
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
            <td class="p-2 w-40"> <div class="flex items-center bg-indigo-50 rounded px-2 border border-indigo-100">
                    <input type="text" list="pgc-list" value="${linia.codi}" 
                        placeholder="Codi"
                        onchange="updateLinia(${idx}, 'codi', this.value)"
                        class="select-compte w-full p-2 outline-none font-black text-xl text-indigo-700 bg-transparent focus:ring-0">
                    <span class="text-indigo-300">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" />
                        </svg>
                    </span>
                </div>
            </td>
            <td class="p-2 text-slate-500 text-sm font-bold nom-compte uppercase tracking-tight">${linia.nom}</td>
            
            <td class="p-2">
                <div class="flex flex-col">
                    <div class="flex items-center bg-emerald-50 rounded px-2 border border-emerald-100">
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
                    <div class="flex items-center bg-sky-50 rounded px-2 border border-sky-100">
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

  if (elTotalDeure) {
    elTotalDeure.innerText = formatarMoneda(totalDeure);
    elTotalDeure.className = "text-3xl font-black text-emerald-700";
  }
  if (elTotalHaver) {
    elTotalHaver.innerText = formatarMoneda(totalHaver);
    elTotalHaver.className = "text-3xl font-black text-sky-700";
  }

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

  const tD = dadesUsuari.reduce((a, l) => a + l.deure, 0);
  const tH = dadesUsuari.reduce((a, l) => a + l.haver, 0);

  if (Math.abs(tD - tH) > 0.01 || dadesUsuari.length === 0) {
    alert("⚠️ L'assentament no quadra o està buit.");
    return;
  }

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

  // IMPORTANT: Revisa si al teu objecte és 'solucio' o 'Solucio'
  const solucioEsperada =
    estat.preguntaActual.solucio || estat.preguntaActual.Solucio;

  const stringUsuari = normalitzar(dadesUsuari);
  const stringSolucio = normalitzar(solucioEsperada);

  // --- AFEGEIX AIXÒ AQUÍ PER DEPURAR ---
  console.log("DEBUG - Usuari:", stringUsuari);
  console.log("DEBUG - Solució:", stringSolucio);

  if (stringUsuari === stringSolucio) {
    // --- TOT CORRECTE ---
    estat.assentament = dadesUsuari;
    const idActual = String(
      estat.preguntaActual.id || estat.preguntaActual.ID,
    ).trim();

    if (!estat.historialPerExportar.some((h) => h.id === idActual)) {
      estat.historialPerExportar.push({
        id: idActual,
        enunciat:
          estat.preguntaActual.enunciat || estat.preguntaActual.Enunciat,
        linies: JSON.parse(JSON.stringify(dadesUsuari)),
      });
    }

    if (!estat.completats.includes(idActual)) {
      estat.completats.push(idActual);

      // Preparem les dades
      const dadesEnviament = {
        action: "registrarActivitat",
        nom: estat.userActiu.nom,
        idActivitat: idActual,
        tema: estat.temaActiu,
        punts: 10,
      };

      // Intentem l'enviament de forma més compatible
      fetch(API_URL, {
        method: "POST",
        body: JSON.stringify(dadesEnviament),
      })
        .then((res) => console.log("Sincronització amb èxit"))
        .catch((err) => console.error("Error en enviar dades:", err));

      // Actualitzem la UI immediatament (sense esperar al servidor)
      estat.punts = (parseInt(estat.punts) || 0) + 10;
      actualitzarDashboard();
      generarMenuTemes();
    }

    // Mostrem l'èxit i refresquem la pantalla
    if (typeof mostrarExit === "function") mostrarExit();
    mostrarPregunta();
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

function actualitzarTotalsEnTempsReal() {
  let totalDeure = 0;
  let totalHaver = 0;

  // Sumem tots els inputs de deure i haver
  document.querySelectorAll(".input-deure").forEach((input) => {
    totalDeure += parseFloat(input.value) || 0;
  });

  document.querySelectorAll(".input-haver").forEach((input) => {
    totalHaver += parseFloat(input.value) || 0;
  });

  // Actualitzem els textos de la interfície (els elements del peu de taula)
  const elTotalDeure = document.getElementById("total-deure");
  const elTotalHaver = document.getElementById("total-haver");
  const elDiferencia = document.getElementById("diferencia");

  if (elTotalDeure) elTotalDeure.innerText = totalDeure.toFixed(2);
  if (elTotalHaver) elTotalHaver.innerText = totalHaver.toFixed(2);

  if (elDiferencia) {
    const dif = Math.abs(totalDeure - totalHaver);
    elDiferencia.innerText = dif.toFixed(2);
    // Canviem color si no quadra
    elDiferencia.className = dif === 0 ? "text-emerald-600" : "text-rose-600";
  }
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
  // 1. NETEJA VISUAL SEGURA
  const medalla = document.getElementById("medalla-container");
  if (medalla) medalla.classList.add("hidden");

  // Eliminem missatges temporals d'èxit
  document.querySelectorAll(".bg-emerald-50").forEach((m) => m.remove());

  // 2. BUSCAR LA POSICIÓ ACTUAL (mantenint la lògica seqüencial)
  if (!estat.preguntaActual) return;
  const idActual = String(
    estat.preguntaActual.ID_Activitat || estat.preguntaActual.id,
  ).trim();

  const indexTotal = estat.preguntes.findIndex(
    (p) => String(p.ID_Activitat || p.id).trim() === idActual,
  );

  // 3. DECIDIR EL SEGÜENT PAS
  if (indexTotal !== -1 && indexTotal < estat.preguntes.length - 1) {
    const següent = estat.preguntes[indexTotal + 1];

    // Actualitzem l'estat
    estat.temaActiu = següent.Tema || següent.tema;
    estat.preguntaActual = següent;

    // Primer generem el menú per marcar la nova activitat com a seleccionada
    if (typeof generarMenuTemes === "function") generarMenuTemes();

    // 4. MOSTRAR LA PREGUNTA
    // Aquesta funció ja s'encarrega de restaurar la taula o posar la vista validada
    mostrarPregunta();

    // 5. GESTIÓ SEGURA DE BOTONS (Sense que peticons si no existeixen)
    // Fem servir l'interrogant ?. per evitar l'error de "classList of null"
    const jaFeta = estat.completats
      .map(String)
      .includes(String(següent.ID_Activitat || següent.id).trim());

    const btnVal = document.getElementById("btn-validar");
    const btnSaltar = document.getElementById("btn-saltar");
    const btnSeg = document.getElementById("btn-seguent");

    if (jaFeta) {
      btnVal?.classList.add("hidden");
      btnSaltar?.classList.add("hidden");
      btnSeg?.classList.remove("hidden");
    } else {
      btnVal?.classList.remove("hidden");
      btnSaltar?.classList.remove("hidden");
      btnSeg?.classList.add("hidden");
    }

    console.log(
      "Navegant a l'activitat següent:",
      següent.ID_Activitat || següent.id,
    );
  } else {
    alert("🎉 Felicitats! Has completat tots els exercicis de l'Olimpíada.");
    if (typeof mostrarSeccio === "function") mostrarSeccio("dashboard");
  }

  // Tornem a dalt de tot de la pàgina
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Variable per controlar el filtre (la pots posar fora de la funció)
let filtreProgres = "tots";

function mostrarProgres() {
  const container = document.getElementById("llista-progres-temes");
  const filtreHeader = document.getElementById("filtre-header-container");
  if (!container) return;

  // 1. Inyectem els botons de filtre al HEADER
  if (filtreHeader) {
    filtreHeader.innerHTML = `
        <div class="flex gap-2">
            <button onclick="canviarFiltreProgres('tots')" 
                class="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${filtreProgres === "tots" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}">
                Tots
            </button>
            <button onclick="canviarFiltreProgres('pendents')" 
                class="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${filtreProgres === "pendents" ? "bg-white text-rose-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}">
                Pendents
            </button>
        </div>
    `;
  }

  // Títols de la secció
  document.getElementById("info-pregunta").innerText = "El Meu Rendiment";
  document.getElementById("progres-tema").innerText =
    "Estadístiques Detallades";

  // Obtenim llista de temes i IDs completats
  const temes = [...new Set(estat.preguntes.map((p) => p.tema))];
  const completadesIDs = estat.completats.map(String);

  container.innerHTML = temes
    .map((tema) => {
      const totesPreguntesTema = estat.preguntes.filter((p) => p.tema === tema);
      const totalTema = totesPreguntesTema.length;
      const fetesTema = totesPreguntesTema.filter((p) =>
        completadesIDs.includes(String(p.id)),
      ).length;
      const percentTema =
        totalTema > 0 ? Math.round((fetesTema / totalTema) * 100) : 0;
      const esComplet = fetesTema === totalTema && totalTema > 0;

      // Filtre de visualització
      if (filtreProgres === "pendents" && fetesTema === totalTema) return "";

      const preguntesPerMostrar =
        filtreProgres === "pendents"
          ? totesPreguntesTema.filter(
              (p) => !completadesIDs.includes(String(p.id)),
            )
          : totesPreguntesTema;

      return `
        <div class="bg-white rounded-[2rem] border ${esComplet ? "border-emerald-500 bg-emerald-50/20" : "border-slate-100"} shadow-sm hover:shadow-md transition-all duration-500 overflow-hidden mb-4">
            <div class="p-8">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex-1">
                        <p class="flex items-center gap-2 text-[10px] font-black ${esComplet ? "text-emerald-600" : "text-slate-400"} uppercase tracking-widest mb-1">
                            ${tema}
                            ${esComplet ? '<span class="bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[8px]">FINALITZAT</span>' : ""}
                        </p>
                        <div class="flex items-center gap-3">
                            <h3 class="text-3xl font-black ${esComplet ? "text-emerald-700" : "text-slate-900"}">${percentTema}%</h3>
                            ${esComplet ? '<span class="text-2xl animate-bounce">🏆</span>' : ""}
                        </div>
                    </div>
                    
                    <div class="flex gap-2">
                        ${
                          fetesTema > 0
                            ? `
                          <button onclick="generarInformePDF('${tema}')" 
                              class="flex items-center gap-2 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-slate-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all shadow-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                              </svg>
                              PDF
                          </button>
                        `
                            : ""
                        }
                    </div>
                </div>

                <details class="group">
                    <summary class="list-none outline-none">
                        <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                            <div class="h-full ${esComplet ? "bg-emerald-500" : "bg-indigo-500"} transition-all duration-1000" style="width: ${percentTema}%"></div>
                        </div>
                        <div class="flex justify-between items-center text-[10px]">
                             <span class="font-bold text-slate-500">${fetesTema} / ${totalTema} Exercicis</span>
                             <span class="font-black text-indigo-500 uppercase cursor-pointer group-open:hidden tracking-tighter italic">Veure llista ↓</span>
                        </div>
                    </summary>

                    <div class="space-y-2 mt-4 pt-4 border-t border-slate-50">
                        ${preguntesPerMostrar
                          .map((p) => {
                            const esFeta = completadesIDs.includes(
                              String(p.id),
                            );

                            // Busquem l'enunciat real del Google Sheet per ID
                            const dadesOrig = estat.preguntes.find(
                              (orig) => String(orig.id) === String(p.id),
                            );
                            const textLlista = dadesOrig
                              ? dadesOrig.titol ||
                                (dadesOrig.enunciat
                                  ? dadesOrig.enunciat.substring(0, 60) + "..."
                                  : "Assentament " + p.id)
                              : "Assentament " + p.id;

                            return `
                            <div class="flex items-center justify-between p-3 rounded-2xl border transition-all 
                                ${esFeta ? "bg-white border-emerald-100 shadow-sm" : "bg-white/50 border-slate-50 opacity-80"}">
                                <div class="flex items-center gap-3">
                                    <div class="w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-bold
                                        ${esFeta ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}">
                                        ${esFeta ? "✓" : p.id}
                                    </div>
                                    <div class="flex flex-col">
                                        <p class="text-[11px] font-bold ${esFeta ? "text-slate-800" : "text-slate-500"} leading-tight">${textLlista}</p>
                                        <p class="text-[8px] uppercase font-black text-slate-400 tracking-tighter">ID: ${p.id}</p>
                                    </div>
                                </div>
                                ${
                                  !esFeta
                                    ? `
                                    <button onclick="seleccionarPreguntaDirecta('${p.id}')" 
                                        class="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-600 hover:text-white transition-all">
                                        Anar
                                    </button>
                                `
                                    : ""
                                }
                            </div>`;
                          })
                          .join("")}
                    </div>
                </details>
            </div>
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

  const NOM_A_EXCLOURE = "xavier";

  if (!dadesRanquingCache) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center p-10 space-y-4">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p class="font-bold text-slate-400 uppercase text-[10px] tracking-widest text-center">Organitzant classificació...</p>
      </div>`;
  }

  try {
    if (!dadesRanquingCache) {
      const res = await fetch(`${API_URL}?action=obtenirRanquing`);
      dadesRanquingCache = await res.json();
    }

    let companys = dadesRanquingCache.filter((c) => {
      const nomFila = String(c.nom || "")
        .toLowerCase()
        .trim();
      if (nomFila === NOM_A_EXCLOURE) return false;
      if (filtreGrup !== "Tots") return c.grup === filtreGrup;
      return true;
    });

    const puntsUnics = [
      ...new Set(companys.map((c) => parseInt(c.punts || 0))),
    ].sort((a, b) => b - a);
    const puntsOr = puntsUnics[0] || -1;
    const puntsPlata = puntsUnics[1] || -1;
    const puntsBronze = puntsUnics[2] || -1;

    const estilsBotons =
      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-sm border";
    const botonsHtml = `
      <div class="flex flex-col items-center mb-10">
        <div class="flex justify-center gap-2 mb-4">
          <button onclick="mostrarRanquing('Tots')" class="${estilsBotons} ${filtreGrup === "Tots" ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-100" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"}">Tots</button>
          <button onclick="mostrarRanquing('Grup A')" class="${estilsBotons} ${filtreGrup === "Grup A" ? "bg-amber-500 text-white border-amber-500 shadow-amber-100" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"}">Grup A 🍎</button>
          <button onclick="mostrarRanquing('Grup B')" class="${estilsBotons} ${filtreGrup === "Grup B" ? "bg-emerald-500 text-white border-emerald-500 shadow-emerald-100" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"}">Grup B 🍏</button>
        </div>
        <button onclick="refrescarDadesRanquing()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-300 border border-transparent hover:border-indigo-100">
          Sincronitzar dades
        </button>
      </div>`;

    const llistaHtml =
      companys.length > 0
        ? companys
            .map((c, i) => {
              const p = parseInt(c.punts || 0);
              let medal = i + 1;
              let bgClass = "bg-white border-slate-100";
              let medalClass = "bg-slate-100 text-slate-400 w-10 h-10 text-xs";
              let nomColor = "text-slate-800";

              if (p > 0) {
                if (p === puntsOr) {
                  medal = "🥇";
                  bgClass = "bg-amber-100 border-amber-400 shadow-inner";
                  medalClass = "bg-white shadow-md w-14 h-14 text-2xl";
                  nomColor = "text-amber-900";
                } else if (p === puntsPlata) {
                  medal = "🥈";
                  bgClass = "bg-slate-200 border-slate-400";
                  medalClass = "bg-white shadow-md w-12 h-12 text-xl";
                  nomColor = "text-slate-900";
                } else if (p === puntsBronze) {
                  medal = "🥉";
                  bgClass = "bg-orange-100 border-orange-300";
                  medalClass = "bg-white shadow-md w-12 h-12 text-xl";
                  nomColor = "text-orange-900";
                }
              }

              return `
            <div class="flex items-center justify-between p-5 rounded-3xl border-2 mb-4 transition-all hover:scale-[1.02] hover:shadow-lg ${bgClass}">
              <div class="flex items-center gap-5">
                <div class="flex items-center justify-center rounded-full font-black ${medalClass}">
                  ${medal}
                </div>
                <div>
                  <p class="font-black ${nomColor} uppercase text-sm tracking-tight">${c.nom}</p>
                  <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">${c.grup}</p>
                </div>
              </div>
              <div class="text-right">
                <span class="text-sm font-black text-indigo-700 px-4 py-2 bg-white rounded-xl border-2 shadow-sm">
                  ${p} <span class="text-[10px] ml-0.5">PTS</span>
                </span>
              </div>
            </div>`;
            })
            .join("")
        : `<p class="text-center text-slate-400 py-10 italic">No hi ha dades disponibles.</p>`;

    // --- RENDERITZAT FINAL AMB LLORER DAURAT ---
    container.innerHTML =
      botonsHtml +
      `
      <div class="max-w-xl mx-auto">
        <div class="text-center mb-10">
          <div class="flex items-center justify-center gap-4 mb-2">
            <img src="./img/llaurer_daurat.png" class="h-12 w-auto object-contain" alt="Llorer">
            
            <h2 class="text-3xl font-black text-slate-800 uppercase tracking-tighter">Hall of Fame</h2>
            
            <img src="./img/llaurer_daurat.png" class="h-12 w-auto object-contain scale-x-[-1]" alt="Llorer">
          </div>
          <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.4em] ml-1">Olimpíada Comptable 2026</p>
        </div>
        <div class="animate-in fade-in slide-in-from-bottom-4 duration-700">
          ${llistaHtml}
        </div>
      </div>`;
  } catch (e) {
    console.error("Error al rànquing:", e);
    container.innerHTML = `<div class="p-6 bg-red-50 text-red-600 rounded-2xl text-center font-bold">Error de connexió al rànquing</div>`;
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

function generarInformePDF(temaFiltrar = null) {
  // 1. Filtrem segons si s'ha demanat un tema concret o tot
  let exercicisResolts = estat.preguntes.filter((p) =>
    estat.completats.includes(String(p.id)),
  );

  if (temaFiltrar) {
    exercicisResolts = exercicisResolts.filter((p) => p.tema === temaFiltrar);
  }

  if (exercicisResolts.length === 0) {
    alert("No hi ha exercicis finalitzats per mostrar en aquest apartat.");
    return;
  }

  const finestra = window.open("", "_blank");

  // CSS Millorat (Punt 3: Espais més compactes)
  const estils = `<style>
    body { font-family: 'Segoe UI', Helvetica, sans-serif; color: #1e293b; padding: 30px; line-height: 1.4; }
    .header { border-bottom: 3px solid #6366f1; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
    .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1px; }
    .header p { margin: 0; font-size: 12px; color: #64748b; font-weight: bold; }
    .assentament { margin-bottom: 25px; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .enunciat { font-size: 12px; font-weight: bold; background: #f8fafc; padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th { background: #f1f5f9; padding: 8px 10px; text-align: left; text-transform: uppercase; font-size: 9px; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
    .num { text-align: right; font-family: 'Courier New', monospace; font-weight: bold; }
    .codi-td { color: #6366f1; font-weight: bold; }
  </style>`;

  let titolDoc = temaFiltrar ? `Diari: ${temaFiltrar}` : "Llibre Diari Complet";

  let contingut = `<html><head><title>${titolDoc}</title>${estils}</head><body>
    <div class="header">
      <div>
        <h1>${titolDoc}</h1>
        <p>Olimpíada Comptable 2026</p>
      </div>
      <div style="text-align: right">
        <p>Alumne: ${estat.userActiu.nom}</p>
        <p>Grup: ${estat.userActiu.grup}</p>
      </div>
    </div>`;

  exercicisResolts.forEach((ex) => {
    contingut += `
      <div class="assentament">
        <div class="enunciat">Tema: ${ex.tema} | Exercici ${ex.id}: ${ex.enunciat}</div>
        <table>
          <thead>
            <tr>
              <th width="10%">Codi</th>
              <th width="50%">Descripció del Compte (PGC)</th>
              <th width="20%" style="text-align: right">Deure</th>
              <th width="20%" style="text-align: right">Haver</th>
            </tr>
          </thead>
          <tbody>
            ${ex.solucio
              .map((l) => {
                // PUNT 2: Busquem el nom real al PGC carregat del Sheets
                const compteReal = estat.pgc.find(
                  (p) => String(p.codi) === String(l.codi),
                );
                const nomAMostrar = compteReal
                  ? compteReal.nom
                  : "Compte no trobat al PGC";

                return `
                <tr>
                  <td class="codi-td">${l.codi}</td>
                  <td style="font-weight: 500;">${nomAMostrar}</td>
                  <td class="num">${l.deure > 0 ? l.deure.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €" : "-"}</td>
                  <td class="num">${l.haver > 0 ? l.haver.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €" : "-"}</td>
                </tr>`;
              })
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

function actualitzarSelectorTemesPDF() {
  const select = document.getElementById("select-tema-pdf");
  if (!select) return;

  // 1. Obtenim quins exercicis estan completats (IDs)
  // 2. Busquem a quins temes pertanyen aquests exercicis
  const temesAmbFeina = estat.preguntes
    .filter((p) => estat.completats.includes(String(p.id)))
    .map((p) => p.tema);

  // 3. Treiem duplicats per tenir una llista de temes únics
  const temesUnics = [...new Set(temesAmbFeina)];

  if (temesUnics.length === 0) {
    select.innerHTML = `<option value="">Sense exercicis fets</option>`;
    return;
  }

  // 4. Omplim el select
  select.innerHTML = temesUnics
    .map((t) => `<option value="${t}">${t}</option>`)
    .join("");
}

// Funció pont per al botó
function imprimirTemaSeleccionat() {
  const tema = document.getElementById("select-tema-pdf").value;
  if (!tema) return alert("Selecciona un tema de la llista.");
  generarInformePDF(tema);
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

  if (!estat.temaActiu) {
    container.innerHTML = `<div class="p-20 text-center bg-white border-2 border-dashed border-slate-200 rounded-3xl my-10 max-w-4xl mx-auto">
      <h2 class="text-xl font-black text-slate-400 uppercase tracking-widest">Generador d'Informes</h2>
      <p class="text-slate-500 mb-8">Selecciona una unitat didàctica per carregar els estats comptables</p>
      <select onchange="estat.temaActiu=this.value; mostrarInformesFinancers();" class="p-3 bg-slate-900 text-white rounded-lg font-bold">
        <option value="">Triar Tema...</option>
        ${llistaTemes.map((t) => `<option value="${t}">${t}</option>`).join("")}
      </select>
    </div>`;
    return;
  }

  const moviments = obtenirMovimentsDetallatsTema();
  const saldos = {};
  moviments.forEach((m) => {
    if (!saldos[m.codi])
      saldos[m.codi] = { nom: cercarNomCompte(m.codi), deure: 0, haver: 0 };
    saldos[m.codi].deure += m.deure;
    saldos[m.codi].haver += m.haver;
  });

  let r_pyg = 0;
  Object.keys(saldos).forEach((c) => {
    if (c.startsWith("6") || c.startsWith("7"))
      r_pyg += saldos[c].haver - saldos[c].deure;
  });
  const resExercici = r_pyg;

  let totalActiuGlobal = 0,
    totalPassiuGlobal = 0;

  const renderTaulaPGC = (bloc, esPassiu = false) => {
    return bloc
      .map((seccio) => {
        let sumaSeccio = 0;
        const htmlSub = seccio.sub
          .map((s) => {
            let saldoSub = 0,
              comptesHTML = "";
            if (s.esResultat) {
              saldoSub = resExercici;
              comptesHTML = `<div class="flex justify-between items-center pl-8 py-1 text-[10px] text-slate-400 italic"><span>(Càlcul P&G)</span><span class="w-32 text-right ${saldoSub < 0 ? "text-blue-600" : ""}">${formatSAP(resExercici)}</span></div>`;
            } else {
              const codis = Object.keys(saldos).filter((c) => s.regex.test(c));
              saldoSub = codis.reduce(
                (acc, c) =>
                  acc +
                  (esPassiu
                    ? saldos[c].haver - saldos[c].deure
                    : saldos[c].deure - saldos[c].haver),
                0,
              );
              comptesHTML = codis
                .map((c) => {
                  const sInd = esPassiu
                    ? saldos[c].haver - saldos[c].deure
                    : saldos[c].deure - saldos[c].haver;
                  return `<div onclick="veureDetallCompte('${c}')" class="flex justify-between items-center pl-8 py-1 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 group">
                <span class="text-[11px] text-slate-600 group-hover:text-indigo-700"><b>${c}</b> ${saldos[c].nom}</span>
                <span class="w-32 text-right font-mono text-[11px] ${sInd < 0 ? "text-blue-600" : "text-slate-500"}">${formatSAP(sInd)}</span>
              </div>`;
                })
                .join("");
            }
            sumaSeccio += saldoSub;
            return `<div class="border-b border-slate-100 last:border-0"><div class="flex justify-between items-center px-4 py-2 bg-slate-50/30"><span class="text-[10px] font-bold text-slate-700 uppercase">${s.titol}</span><span class="w-32 text-right font-mono text-[11px] font-bold ${saldoSub < 0 ? "text-blue-600" : ""}">${formatSAP(saldoSub)}</span></div>${comptesHTML}</div>`;
          })
          .join("");
        if (esPassiu) totalPassiuGlobal += sumaSeccio;
        else totalActiuGlobal += sumaSeccio;
        return `<div class="mb-4 bg-white border-x border-slate-200"><div class="bg-slate-200/50 px-4 py-1.5 border-y border-slate-200 flex justify-between items-center uppercase font-black text-[10px] tracking-widest text-slate-900"><span>${seccio.titol}</span><span class="w-32 text-right font-mono ${sumaSeccio < 0 ? "text-blue-600" : ""}">${formatSAP(sumaSeccio)}</span></div>${htmlSub}</div>`;
      })
      .join("");
  };

  container.innerHTML = `
    <div class="p-8 max-w-7xl mx-auto font-sans bg-white shadow-2xl my-10 border border-slate-300">
      <div class="flex justify-between items-start mb-10 border-b-2 border-slate-900 pb-6">
        <div><h1 class="text-2xl font-black text-slate-900 uppercase tracking-tighter">Estats Comptables Oficials</h1><p class="text-xs text-slate-500 font-bold uppercase">Tema: ${estat.temaActiu}</p></div>
        <div class="no-print bg-slate-100 p-3 rounded flex items-center gap-3">
          <select onchange="estat.temaActiu=this.value; mostrarInformesFinancers();" class="text-xs font-bold bg-transparent border-none">
            <option value="">Canviar Tema...</option>
            ${llistaTemes.map((t) => `<option value="${t}" ${t === estat.temaActiu ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-slate-300">
        <div class="border-r border-slate-300">
          <div class="bg-slate-900 text-white p-2 text-center text-xs font-bold uppercase tracking-widest">Actiu</div>
          ${renderTaulaPGC(ESTRUCTURA_PGC_FINAL.actiu, false)}
          <div class="bg-slate-900 text-white p-4 flex justify-between items-center">
            <span class="text-xs font-black uppercase">TOTAL ACTIU</span><span class="font-mono text-lg font-black">${formatSAP(totalActiuGlobal)}</span>
          </div>
        </div>
        <div class="flex flex-col">
          <div class="bg-slate-800 text-white p-2 text-center text-xs font-bold uppercase tracking-widest">Patrimoni Net i Passiu</div>
          ${renderTaulaPGC(ESTRUCTURA_PGC_FINAL.passiu, true)}
          <div class="bg-slate-800 text-white p-4 flex justify-between items-center border-t border-slate-600">
            <span class="text-xs font-black uppercase">TOTAL P. NET I PASSIU</span><span class="font-mono text-lg font-black">${formatSAP(totalPassiuGlobal)}</span>
          </div>
        </div>
      </div>

      <div class="mt-12 border border-slate-300 bg-white">
        <div class="bg-indigo-900 text-white p-2 text-center text-xs font-bold uppercase tracking-widest italic">Compte de Pèrdues i Guanys (Estructura PGC)</div>
        <div class="p-0">
          ${(() => {
            let acumExplo = 0,
              acumFin = 0;
            return ESTRUCTURA_PYG_PGC.map((e, idx) => {
              if (e.esSubtotal) {
                let v = 0,
                  cl = "bg-slate-100 font-bold border-y border-slate-200";
                if (e.esSubtotal === "explotacio") v = acumExplo;
                if (e.esSubtotal === "financer") v = acumFin;
                if (e.esSubtotal === "ebt") v = acumExplo + acumFin;
                if (e.esSubtotal === "final") {
                  v = resExercici;
                  cl = "bg-indigo-900 text-white font-black text-sm";
                }
                return `<div class="flex justify-between px-4 py-3 ${cl} text-[10px] uppercase"><span>${e.titol}</span><span class="font-mono ${v < 0 ? (e.esSubtotal === "final" ? "text-white" : "text-blue-600") : ""}">${formatSAP(v)}</span></div>`;
              }
              const codis = Object.keys(saldos).filter((c) => e.regex.test(c));
              let sumaEpi = 0;
              const html = codis
                .map((c) => {
                  const s = saldos[c],
                    n = s.haver - s.deure;
                  sumaEpi += n;
                  if (idx <= 5) acumExplo += n;
                  else if (idx <= 8) acumFin += n;
                  return `<div onclick="veureDetallCompte('${c}')" class="flex justify-between pl-10 pr-4 py-1 text-[10px] text-slate-500 italic border-b border-slate-50 hover:bg-indigo-50 cursor-pointer group">
                  <span class="group-hover:text-indigo-700"><b>${c}</b> ${s.nom}</span><span class="font-mono ${n < 0 ? "text-blue-600" : ""}">${formatSAP(n)}</span>
                </div>`;
                })
                .join("");
              return codis.length
                ? `<div><div class="flex justify-between px-4 py-2 text-[10px] font-bold text-slate-700 bg-slate-50/50 border-b border-slate-100"><span>${e.titol}</span><span class="font-mono ${sumaEpi < 0 ? "text-blue-600" : ""}">${formatSAP(sumaEpi)}</span></div>${html}</div>`
                : "";
            }).join("");
          })()}
        </div>
      </div>
    </div>
    <div id="modal-drilldown" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4"></div>`;
}

function obtenirSigneCompte(codi) {
  const c = String(codi);
  // Passiu (1, 40, 41, 475, 52...) i P&G (6, 7) funcionen amb Haver - Deure
  if (
    c.startsWith("1") ||
    c.startsWith("40") ||
    c.startsWith("41") ||
    c.startsWith("475") ||
    c.startsWith("476") ||
    c.startsWith("477") ||
    c.startsWith("52") ||
    c.startsWith("17") ||
    c.startsWith("6") ||
    c.startsWith("7")
  ) {
    return "H-D";
  }
  // Actiu (2, 3, 43, 57...) funciona amb Deure - Haver
  return "D-H";
}

function veureDetallCompte(codi) {
  const moviments = obtenirMovimentsDetallatsTema().filter(
    (m) => String(m.codi) === String(codi),
  );

  const modal = document.getElementById("modal-drilldown");
  if (!modal) return;

  const modeSigne = obtenirSigneCompte(codi);
  let saldoAcu = 0;
  const nomCompte = cercarNomCompte(codi);

  const files = moviments
    .map((m) => {
      const impacte =
        modeSigne === "H-D" ? m.haver - m.deure : m.deure - m.haver;
      saldoAcu += impacte;

      return `
      <tr class="text-[11px] border-b border-slate-100 hover:bg-slate-50 transition">
        <td class="p-3 text-slate-400 font-mono italic">#${m.id}</td>
        <td class="p-3 text-slate-700 font-medium">${m.concepte || "Apunt"}</td>
        <td class="p-3 text-right font-mono text-emerald-600">${m.deure > 0 ? formatSAP(m.deure) : "-"}</td>
        <td class="p-3 text-right font-mono text-blue-600">${m.haver > 0 ? formatSAP(m.haver) : "-"}</td>
        <td class="p-3 text-right font-mono font-black ${saldoAcu < 0 ? "text-blue-600" : "text-slate-900"}">
          ${formatSAP(saldoAcu)}
        </td>
      </tr>`;
    })
    .join("");

  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-300 animate-in zoom-in duration-200">
      <div class="bg-slate-900 p-5 text-white flex justify-between items-center">
        <div>
          <h3 class="text-lg font-black uppercase tracking-tighter italic">Llibre Major: ${codi}</h3>
          <p class="text-[10px] text-slate-400 font-bold uppercase">${nomCompte}</p>
        </div>
        <button onclick="document.getElementById('modal-drilldown').classList.add('hidden')" 
                class="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-blue-600 transition text-xl">
          &times;
        </button>
      </div>
      <div class="max-h-[60vh] overflow-y-auto">
        <table class="w-full text-left border-collapse">
          <thead class="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
            <tr class="text-[10px] font-black uppercase text-slate-500">
              <th class="p-3 w-16">Ref</th>
              <th class="p-3">Concepte</th>
              <th class="p-3 text-right text-emerald-700">Deure (+)</th>
              <th class="p-3 text-right text-blue-700">Haver (-)</th>
              <th class="p-3 text-right bg-slate-100/50">Saldo Acum.</th>
            </tr>
          </thead>
          <tbody>${files}</tbody>
        </table>
      </div>
      <div class="p-5 bg-slate-50 border-t flex justify-between items-center">
        <span class="text-[9px] text-slate-400 uppercase font-bold">Criteri: ${modeSigne}</span>
        <div class="text-right">
          <span class="text-[10px] font-black uppercase block text-slate-400">Saldo Final</span>
          <span class="text-2xl font-mono font-black ${saldoAcu < 0 ? "text-blue-600" : "text-slate-900"}">${formatSAP(saldoAcu)}</span>
        </div>
      </div>
    </div>`;
  modal.classList.remove("hidden");
}

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

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar-main");
  const main = document.getElementById("main-content");
  const btnToggle = document.getElementById("btn-toggle-main");

  if (!sidebar || !main) return;

  // Comprovem si la barra està visible (sense la classe translate-x)
  const isVisible = !sidebar.classList.contains("-translate-x-full");

  if (isVisible) {
    // ACCIÓ: AMAGAR (Desplaçar a l'esquerra i treure marge)
    sidebar.classList.add("-translate-x-full");
    main.classList.remove("ml-64");
    // Opcional: mostrar el botó de menú més clarament
    btnToggle.classList.add("opacity-100");
  } else {
    // ACCIÓ: MOSTRAR (Tornar a posició 0 i afegir marge)
    sidebar.classList.remove("-translate-x-full");
    main.classList.add("ml-64");
  }
}

// Opcional: Si vols que en mòbils comenci tancada
window.addEventListener("load", () => {
  if (window.innerWidth < 1024) {
    toggleSidebar();
  }
});

// Gestió de la tecla Intro amb protecció contra errors de lectura (null)
document.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    const activeEl = document.activeElement;
    if (!activeEl || !activeEl.classList) return;

    const esInputDiari =
      activeEl.classList.contains("select-compte") ||
      activeEl.classList.contains("input-deure") ||
      activeEl.classList.contains("input-haver");

    if (esInputDiari) {
      e.preventDefault();

      // Guardem la dada i actualitzem totals sense que petis el programa
      activeEl.dispatchEvent(new Event("change", { bubbles: true }));

      // EXECUTEM LA FUNCIÓ DE TOTALS NOMÉS SI EXISTEIX
      if (typeof actualitzarTotalsEnTempsReal === "function") {
        actualitzarTotalsEnTempsReal();
      }

      const fila = activeEl.closest("tr");
      if (!fila) return;

      if (activeEl.classList.contains("select-compte")) {
        const seguent = fila.querySelector(".input-deure");
        if (seguent) seguent.focus();
      } else if (activeEl.classList.contains("input-deure")) {
        const valorDeure = parseFloat(activeEl.value) || 0;
        if (valorDeure === 0) {
          const seguent = fila.querySelector(".input-haver");
          if (seguent) seguent.focus();
        } else {
          executarNovaFila();
        }
      } else if (activeEl.classList.contains("input-haver")) {
        executarNovaFila();
      }
    }
  }
});

function executarNovaFila() {
  if (typeof afegirFila === "function") {
    afegirFila();
    setTimeout(() => {
      const files = document.querySelectorAll("#taula-assentament tbody tr");
      if (files.length > 0) {
        const ultimaFila = files[files.length - 1];
        const inputCodi = ultimaFila.querySelector(".select-compte");
        if (inputCodi) inputCodi.focus();
      }
    }, 50);
  }
}

function logout() {
  // Esborrem les dades de sessió guardades al navegador
  localStorage.removeItem("olimpic_user");
  // Recarreguem la pàgina per tornar al formulari de login
  location.reload();
}
