const API_URL =
  "https://script.google.com/macros/s/AKfycbxTzDAVPVbAJoqjMrJT2qRW--xB-ExcHCvM2zqNlC6lDS53N3Lcbt0r6iuEOzKx3Uba/exec"; // <--- ENGANXA LA URL AQUÍ

let modoActual = "login";

// Canviar entre pestanyes de Login i Registre
function canviarTab(modo) {
  modoActual = modo;
  const btn = document.getElementById("btn-principal");
  const tLogin = document.getElementById("tab-login");
  const tRegistre = document.getElementById("tab-registre");

  if (modo === "login") {
    btn.innerText = "Entrar a l'Olimpíada";
    tLogin.classList.replace("text-slate-400", "text-indigo-600");
    tRegistre.classList.replace("text-indigo-600", "text-slate-400");
  } else {
    btn.innerText = "Crear compte nou";
    tRegistre.classList.replace("text-slate-400", "text-indigo-600");
    tLogin.classList.replace("text-indigo-600", "text-slate-400");
  }
}

// Funció principal d'enviament
async function executarAccio() {
  const nom = document.getElementById("nom-input").value.trim();
  const pass = document.getElementById("pass-input").value.trim();

  if (!nom || !pass) return alert("Si us plau, omple tots els camps");

  const btn = document.getElementById("btn-principal");
  btn.disabled = true;
  btn.innerText = "Connectant...";

  try {
    const resposta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: modoActual, nom: nom, pass: pass }),
    });

    const dades = await resposta.json();

    if (dades.success) {
      if (modoActual === "registre") {
        alert("✨ Usuari creat amb èxit! Ja pots iniciar sessió.");
        canviarTab("login");
      } else {
        // --- LOGIN CORRECTE ---

        // 1. Guardem les dades de l'usuari (nom, avatar, punts)
        const usuariLogin = dades.usuari;

        // 2. Carreguem l'historial d'activitats que ve del full "Progres"
        // Si no en té cap encara, assignem un array buit []
        estat.completats = usuariLogin.completats || [];

        // 3. Persistència: Guardem al navegador perquè no calgui fer login cada cop que refresquem
        localStorage.setItem("olimpic_user", JSON.stringify(usuariLogin));

        // 4. Arrancat de l'interfície
        iniciarApp(usuariLogin);
      }
    } else {
      alert("⚠️ " + dades.message);
    }
  } catch (error) {
    alert("Error de connexió. Revisa la URL de l'API.");
    console.error(error);
  } finally {
    btn.disabled = false;
    if (
      document.getElementById("modal-login").classList.contains("hidden") ===
      false
    ) {
      btn.innerText =
        modoActual === "login" ? "Entrar a l'Olimpíada" : "Registrar-me";
    }
  }
}

function iniciarApp(user) {
  estat.userActiu = user;
  // Carreguem els punts que venen de la base de dades a l'estat global
  estat.punts = user.punts || 0;
  // Carreguem els exercicis completats
  estat.completats = user.completats || [];

  document.getElementById("modal-login").classList.add("hidden");
  document.getElementById("user-nom").innerText = user.nom;

  const avatarUrl =
    user.avatar && user.avatar.trim() !== ""
      ? user.avatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nom)}&background=6366f1&color=fff&bold=true`;

  document.getElementById("user-icon").innerHTML =
    `<img src="${avatarUrl}" class="w-full h-full object-cover rounded-full" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.nom)}&background=ef4444&color=fff'">`;

  // Carreguem les dades del Sheet i després actualitzem pantalles
  carregarDadesContables().then(() => {
    actualitzarDashboard();
    mostrarSeccio("dashboard");
  });
}

// Afegim l'objecte d'estat per controlar l'app--------------------------------------------------------------------------------------------------------
let estat = {
  userActiu: null,
  pgc: [],
  preguntes: [],
  temaActiu: null,
  preguntaActual: null,
  assentament: [], // Aquí guardarem el que l'usuari va escrivint
  completats: [],
  punts: 0,
};

// Modifiquem la funció iniciarApp que ja tenies
async function iniciarApp(user) {
  // 1. Assignem l'usuari i el seu progrés guardat a l'estat global
  estat.userActiu = user;
  estat.punts = parseInt(user.punts) || 0;
  estat.completats = user.completats || [];

  // 2. Amaguem el login i posem el nom
  document.getElementById("modal-login").classList.add("hidden");
  document.getElementById("user-nom").innerText = user.nom;

  // 3. Fallback per l'avatar (si no n'hi ha, generem un amb inicials)
  const avatarUrl =
    user.avatar && user.avatar.trim() !== ""
      ? user.avatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nom)}&background=6366f1&color=fff&bold=true`;

  document.getElementById("user-icon").innerHTML =
    `<img src="${avatarUrl}" class="w-full h-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.nom)}&background=ef4444&color=fff'">`;

  // 4. ESPEREM a que es carreguin totes les preguntes del Google Sheet
  await carregarDadesContables();

  // 5. ARA SÍ: Un cop tenim les preguntes, calculem el rendiment real
  actualitzarDashboard();

  // 6. Mostrem la secció final
  mostrarSeccio("dashboard");
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

// Navegació entre Dashboard i Exercici
function mostrarSeccio(id) {
  const seccions = ["seccio-dashboard", "seccio-exercici", "seccio-progres"];

  // Netegem els filtres del header per defecte
  const filtreHeader = document.getElementById("filtre-header-container");
  if (filtreHeader) filtreHeader.innerHTML = "";

  seccions.forEach((s) => {
    const el = document.getElementById(s);
    if (el) {
      el.classList.toggle("hidden", s !== `seccio-${id}`);
    }
  });

  // Si la secció és 'progres', executem la funció per pintar les dades
  if (id === "progres") {
    mostrarProgres();
  }
}

function generarMenuTemes() {
  const menu = document.getElementById("menu-temes");
  if (!menu) return;

  const temes = [...new Set(estat.preguntes.map((p) => p.tema))];

  menu.innerHTML = temes
    .map((tema) => {
      const preguntesDelTema = estat.preguntes.filter((p) => p.tema === tema);

      // DETERMINEM SI AQUEST TEMA HA D'ESTAR OBERT
      // S'obrirà si el tema coincideix amb el de la pregunta que l'usuari està fent ara
      const esTemaActiu =
        estat.preguntaActual && estat.preguntaActual.tema === tema;

      return `
      <li class="mb-2">
        <details class="group" ${esTemaActiu ? "open" : ""}>
          <summary class="flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-800/50 transition text-indigo-400 font-black text-[9px] uppercase tracking-widest list-none">
            <span class="flex items-center gap-2">
              <span class="group-open:rotate-90 transition-transform text-[8px]">▶</span>
              ${tema}
            </span>
          </summary>
          
          <ul class="mt-1 space-y-0.5 border-l border-slate-800 ml-4">
            ${preguntesDelTema
              .map((p, index) => {
                const feta = estat.completats
                  .map(String)
                  .includes(String(p.id));
                const esActiva =
                  estat.preguntaActual &&
                  String(estat.preguntaActual.id) === String(p.id);

                return `
                <li class="relative">
                  <button onclick="seleccionarPreguntaDirecta('${p.id}')" 
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group
                    ${esActiva ? "bg-indigo-500/20 border border-indigo-500/30" : "border border-transparent hover:bg-slate-800/40"}">
                    
                    <div class="w-5 h-5 shrink-0 flex items-center justify-center rounded-md text-[9px] font-bold border
                      ${
                        esActiva
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]"
                          : feta
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "bg-slate-800 border-slate-700 text-slate-500"
                      }">
                      ${feta ? "✓" : index + 1}
                    </div>

                    <span class="text-[11px] font-bold truncate 
                      ${esActiva ? "text-indigo-200" : feta ? "text-slate-500" : "text-slate-300 group-hover:text-white"}">
                      ${p.titol || p.descripcio.substring(0, 25) + "..."}
                    </span>
                  </button>
                </li>`;
              })
              .join("")}
          </ul>
        </details>
      </li>
    `;
    })
    .join("");
}

// AQUESTA FUNCIÓ ÉS LA QUE FA QUE EL MENÚ FUNCIONI EN CLICAR--------------------------------------------------------------
function seleccionarPreguntaDirecta(id) {
  // 1. Busquem la pregunta assegurant que comparem text amb text
  const pregunta = estat.preguntes.find((p) => String(p.id) === String(id));

  if (pregunta) {
    // 2. Actualitzem l'estat amb la pregunta activa
    estat.temaActiu = pregunta.tema;
    estat.preguntaActual = pregunta;

    // 3. ACTUALITZEM EL MENÚ LATERAL (Perquè es pinti el fons lila a l'exercici seleccionat)
    generarMenuTemes();

    // 4. Forcem que la interfície s'actualitzi
    mostrarSeccio("exercici");
    mostrarPregunta();

    // Opcional: fem scroll a dalt perquè l'usuari vegi el nou enunciat
    window.scrollTo(0, 0);
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

  // Busquem els botons per ID
  const btnValidar = document.getElementById("btn-validar");
  const btnSeguent = document.getElementById("btn-seguent");

  // Si no es troben els botons a l'HTML, la funció s'atura sense donar error de consola
  if (!btnValidar || !btnSeguent) return;

  const jaFeta = estat.completats.includes(p.id);

  if (jaFeta) {
    // Si ja està feta, el botó de validar s'amaga i el de següent és verd
    btnValidar.classList.add("hidden");
    btnSeguent.innerText = "Següent Exercici ➡️";
    btnSeguent.className =
      "bg-emerald-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg shadow-emerald-100";
  } else {
    // Si no està feta, es pot validar o saltar (botó gris)
    btnValidar.classList.remove("hidden");
    btnSeguent.innerText = "Saltar Exercici ⏭️";
    btnSeguent.className =
      "bg-slate-200 text-slate-500 px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-300 transition border border-slate-300";
  }

  // Actualitzem l'enunciat i info
  document.getElementById("txt-enunciat").innerText = p.enunciat;
  document.getElementById("info-pregunta").innerText = p.tema;

  // Reset de la taula
  estat.assentament = [];
  afegirFila();
  renderTaula();
}

// Funcionalitat de les respostes  ---
// Afegeix una fila buida a l'objecte d'estat i actualitza la taula
function afegirFila() {
  estat.assentament.push({ codi: "", nom: "", deure: 0, haver: 0 });
  renderTaula();
}

// Funció per esborrar una línia específica
function eliminarLinia(index) {
  estat.assentament.splice(index, 1);
  renderTaula();
}

// Quan l'usuari canvia una dada a la taula
function updateLinia(index, camp, valor) {
  let linia = estat.assentament[index];
  linia[camp] = valor;

  // Si l'usuari ha escrit el codi, busquem el nom al PGC automàticament
  if (camp === "codi") {
    const compteTrobat = estat.pgc.find((c) => c.codi === valor);
    linia.nom = compteTrobat ? compteTrobat.nom : "Compte no trobat";
  }

  renderTaula();
}

// Dibuixa la taula a l'HTML basant-se en l'objecte 'estat.assentament'
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
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
            <td class="p-2">
                <input type="text" list="pgc-list" value="${linia.codi}" 
                    onchange="updateLinia(${idx}, 'codi', this.value)"
                    class="w-full p-2 outline-none font-bold text-indigo-600 bg-transparent focus:border-b focus:border-indigo-300">
            </td>
            <td class="p-2 text-slate-500 text-xs">${linia.nom}</td>
            <td class="p-2">
                <input type="number" value="${linia.deure || ""}" placeholder="0.00"
                    onchange="updateLinia(${idx}, 'deure', this.value)" 
                    class="w-full text-right p-2 outline-none text-emerald-700 font-bold bg-transparent">
            </td>
            <td class="p-2">
                <input type="number" value="${linia.haver || ""}" placeholder="0.00"
                    onchange="updateLinia(${idx}, 'haver', this.value)" 
                    class="w-full text-right p-2 outline-none text-sky-700 font-bold bg-transparent">
            </td>
            <td class="p-2 text-center">
                <button onclick="eliminarLinia(${idx})" class="text-slate-300 hover:text-rose-500 transition">✕</button>
            </td>
        </tr>`;
    })
    .join("");

  // Actualitzem els totals a la part inferior
  document.getElementById("total-deure").innerText =
    totalDeure.toFixed(2) + " €";
  document.getElementById("total-haver").innerText =
    totalHaver.toFixed(2) + " €";
  renderMajors();
}
// Lògica de validació ---------------------------------------------------------------------------------------------------------------
async function validarAssentament() {
  const solucioEsperada = estat.preguntaActual.solucio;
  const assentamentUsuari = estat.assentament.filter(
    (line) => line.codi !== "",
  );

  const totalD = assentamentUsuari.reduce(
    (acc, l) => acc + parseFloat(l.deure || 0),
    0,
  );
  const totalH = assentamentUsuari.reduce(
    (acc, l) => acc + parseFloat(l.haver || 0),
    0,
  );

  if (Math.abs(totalD - totalH) > 0.01 || totalD === 0) {
    alert("⚠️ L'assentament no quadra o està buit.");
    return;
  }

  const simplificar = (arr) =>
    arr
      .map(
        (l) =>
          `${l.codi}|${parseFloat(l.deure).toFixed(2)}|${parseFloat(l.haver).toFixed(2)}`,
      )
      .sort();

  const userKeys = simplificar(assentamentUsuari);
  const solKeys = simplificar(solucioEsperada);
  const esCorrecte = JSON.stringify(userKeys) === JSON.stringify(solKeys);

  if (esCorrecte) {
    const idActual = String(estat.preguntaActual.id);

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
            tema: estat.preguntaActual.tema,
            punts: 10,
          }),
        });

        estat.punts = (parseInt(estat.punts) || 0) + 10;
        actualitzarDashboard();
      } catch (e) {
        console.error("Error en el registre remot:", e);
      }

      // 1. Actualitzem el menú lateral (el que ja feies)
      generarMenuTemes();

      // 2. NOVA MILLORA: Si la secció de progrés està visible, la refresquem al moment
      const seccioProgres = document.getElementById("seccio-progres");
      if (seccioProgres && !seccioProgres.classList.contains("hidden")) {
        mostrarProgres();
      }
    }

    mostrarExit();
    document.getElementById("btn-validar").classList.add("hidden");
    document.getElementById("btn-seguent").classList.remove("hidden");
  } else {
    alert(
      "❌ Hi ha algun error en els comptes o els imports. Revisa l'enunciat!",
    );
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
  // 1. ELIMINAR OBSTACLES: Si la medalla d'èxit està a la pantalla, la tanquem
  // per començar el nou exercici amb la pantalla neta.
  const medalla = document.getElementById("medalla-container");
  if (medalla) medalla.classList.add("hidden");

  // 2. BUSCAR ON SOM: Busquem la posició de l'exercici actual a la llista total (1 al 13)
  const indexTotal = estat.preguntes.findIndex(
    (p) => String(p.id) === String(estat.preguntaActual.id),
  );

  // 3. DECIDIR EL SEGÜENT PAS:
  if (indexTotal !== -1 && indexTotal < estat.preguntes.length - 1) {
    // Si NO és l'últim exercici, agafem el següent de la llista
    const següent = estat.preguntes[indexTotal + 1];

    // Fem servir la funció de càrrega que ja tens, que actualitza l'enunciat i buida la taula
    seleccionarPreguntaDirecta(següent.id);
  } else {
    // Si era l'últim (el 13), avisem i tornem al Dashboard
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

function logout() {
  // Esborrem les dades de sessió guardades al navegador
  localStorage.removeItem("olimpic_user");
  // Recarreguem la pàgina per tornar al formulari de login
  location.reload();
}
