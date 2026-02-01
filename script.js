const API_URL =
  "https://script.google.com/macros/s/AKfycbzsNBrtJJGtkP5ATD45WBTAC2chVOw9p9JIdzUvGkVVpBcK9p31vjkHZkSgr4il_ZZ6/exec"; // <--- ENGANXA LA URL AQUÍ

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
        // Login correcte
        localStorage.setItem("olimpic_user", JSON.stringify(dades.usuari));
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
    canviarTab(modoActual);
  }
}

function iniciarApp(user) {
  document.getElementById("modal-login").classList.add("hidden");
  // Aquí actualitzem el perfil a la barra lateral
  document.getElementById("user-nom").innerText = user.nom;
  document.getElementById("user-icon").innerHTML =
    `<img src="${user.avatar}" class="w-full h-full object-cover">`;
  console.log("Sessió iniciada per:", user.nom);
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
  estat.userActiu = user;
  document.getElementById("modal-login").classList.add("hidden");
  document.getElementById("user-nom").innerText = user.nom;
  document.getElementById("user-icon").innerHTML =
    `<img src="${user.avatar}" class="w-full h-full object-cover">`;

  await carregarDadesContables();
  mostrarSeccio("dashboard");
}

async function carregarDadesContables() {
  try {
    const res = await fetch(API_URL); // El doGet del script
    const dades = await res.json();
    estat.pgc = dades.pgc;
    estat.preguntes = dades.preguntes;

    generarMenuTemes();
    generarDatalistPGC();
  } catch (e) {
    console.error("Error carregant PGC/Preguntes", e);
  }
}

// Navegació entre Dashboard i Exercici
function mostrarSeccio(id) {
  const seccions = ["seccio-dashboard", "seccio-exercici"];
  seccions.forEach((s) => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle("hidden", s !== `seccio-${id}`);
  });
}

function generarMenuTemes() {
  const menu = document.getElementById("menu-temes");
  const temes = [...new Set(estat.preguntes.map((p) => p.tema))];

  menu.innerHTML = temes
    .map((tema) => {
      const preguntesDelTema = estat.preguntes.filter((p) => p.tema === tema);

      // Generem la llista d'activitats per a aquest tema
      const llistaActivitats = preguntesDelTema
        .map((p, index) => {
          const feta = estat.completats.includes(p.id);
          return `
        <li class="ml-4 mt-1">
          <button onclick="seleccionarPreguntaDirecta('${p.id}')" 
            class="w-full text-left px-3 py-1 rounded-lg text-[11px] font-bold transition ${feta ? "text-emerald-400 bg-emerald-400/10" : "text-slate-500 hover:bg-slate-800"}">
            ${feta ? "✅" : "⭕"} Exercici ${index + 1}
          </button>
        </li>
      `;
        })
        .join("");

      return `
      <li class="mb-4">
        <div class="px-4 py-2 text-xs font-black text-indigo-400 uppercase tracking-widest bg-slate-800/30 rounded-t-xl">
          📁 ${tema}
        </div>
        <ul class="bg-slate-800/10 pb-2 rounded-b-xl">
          ${llistaActivitats}
        </ul>
      </li>
    `;
    })
    .join("");
}

// Nova funció per carregar una pregunta específica des del menú
function seleccionarPreguntaDirecta(id) {
  const pregunta = estat.preguntes.find((p) => p.id == id);
  if (pregunta) {
    estat.temaActiu = pregunta.tema;
    estat.preguntaActual = pregunta;
    mostrarSeccio("exercici");
    mostrarPregunta();
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

  // 1. Comprovar si el Deure i l'Haver quadren entre ells
  const totalD = assentamentUsuari.reduce(
    (acc, l) => acc + parseFloat(l.deure || 0),
    0,
  );
  const totalH = assentamentUsuari.reduce(
    (acc, l) => acc + parseFloat(l.haver || 0),
    0,
  );

  if (totalD !== totalH || totalD === 0) {
    alert("⚠️ L'assentament no quadra o està buit.");
    return;
  }

  // 2. Comprovar contra la solució del Google Sheet
  const simplificar = (arr) =>
    arr
      .map((l) => `${l.codi}|${parseFloat(l.deure)}|${parseFloat(l.haver)}`)
      .sort();

  const userKeys = simplificar(assentamentUsuari);
  const solKeys = simplificar(solucioEsperada);

  const esCorrecte = JSON.stringify(userKeys) === JSON.stringify(solKeys);

  if (esCorrecte) {
    // Si l'exercici no s'havia completat abans, registrem els punts
    if (!estat.completats.includes(estat.preguntaActual.id)) {
      estat.completats.push(estat.preguntaActual.id);

      // Fem servir await perquè registrarPunts és una funció asíncrona (fetch)
      await registrarPunts(10);

      // Refresquem el menú lateral per mostrar el check ✅
      generarMenuTemes();
    }

    // Feedback visual: Mostrem la medalla
    mostrarExit();

    // Gestió de botons: Amaguem "Validar" i mostrem "Següent"
    document.getElementById("btn-validar").classList.add("hidden");
    document.getElementById("btn-seguent").classList.remove("hidden");
  } else {
    alert(
      "❌ Hi ha algun error en els comptes o els imports. Revisa l'enunciat!",
    );
  }
}

// Afegim una variable a l'estat per als punts---------------------------------------------------------------------------------------
estat.punts = 0;

function mostrarExit() {
  const medalla = document.getElementById("medalla-container");
  medalla.classList.remove("hidden");

  // Enviem 10 punts al servidor
  registrarPunts(10);

  setTimeout(() => {
    medalla.classList.add("hidden");
    // Opcional: carregar següent pregunta del tema
    següentPregunta();
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
  // Busquem l'element de puntuació al Dashboard
  const elPunts = document.querySelector(
    "#seccio-dashboard .text-3xl.font-black.text-slate-800",
  );
  if (elPunts) elPunts.innerText = estat.punts;

  // També podem actualitzar el rang basant-nos en els punts
  const elRang = document.querySelector("#seccio-dashboard .text-indigo-600");
  if (elRang) {
    if (estat.punts > 100) elRang.innerText = "A+";
    else if (estat.punts > 50) elRang.innerText = "B";
    else elRang.innerText = "C";
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
  document.getElementById("medalla-container").classList.add("hidden");

  const preguntesTema = estat.preguntes.filter(
    (p) => p.tema === estat.temaActiu,
  );
  const indexActual = preguntesTema.findIndex(
    (p) => p.id === estat.preguntaActual.id,
  );

  if (indexActual < preguntesTema.length - 1) {
    estat.preguntaActual = preguntesTema[indexActual + 1];
    mostrarPregunta();
  } else {
    alert("🎉 Has completat tots els exercicis d'aquest tema!");
    mostrarSeccio("dashboard");
  }
}

function logout() {
  // Esborrem les dades de sessió guardades al navegador
  localStorage.removeItem("olimpic_user");
  // Recarreguem la pàgina per tornar al formulari de login
  location.reload();
}
