const API_URL =
  "https://script.google.com/macros/s/AKfycbyZHqaveREP173zfWsckKd6IwrfmpYuD62ch8o9LN0X7OVUdrtnmukLINJNOM41-B5dQQ/exec";

let estat = {
  usuaris: [],
  pgc: [],
  preguntes: [],
  userActiu: null,
  preguntaActual: null,
  temaActiu: null,
  assentament: [],
};

// 1. Càrrega inicial
window.onload = async () => {
  console.log("Iniciant càrrega de dades...");
  const sessioGuardada = localStorage.getItem("olimpic_user");

  // Intentem carregar les dades de l'API
  await carregarDadesInicials();

  if (sessioGuardada && estat.usuaris.length > 0) {
    const userObj = JSON.parse(sessioGuardada);
    // Validem que l'usuari guardat encara existeix a la llista actual
    const userExisteix = estat.usuaris.find((u) => u.nom === userObj.nom);
    if (userExisteix) {
      estat.userActiu = userExisteix;
      document.getElementById("modal-login").classList.add("hidden");
      iniciarApp();
    }
  }
};

async function carregarDadesInicials() {
  try {
    const res = await fetch(`${API_URL}?action=getDades`);
    if (!res.ok) throw new Error("Error en la resposta de la xarxa");

    const data = await res.json();
    console.log("Dades rebudes de l'API:", data);

    estat.usuaris = data.usuaris || [];
    estat.pgc = data.pgc || [];
    estat.preguntes = data.preguntes || [];

    const select = document.getElementById("select-usuari");

    if (estat.usuaris.length === 0) {
      select.innerHTML = '<option value="">No s\'han trobat usuaris</option>';
      return;
    }

    // Omplir el select de login
    select.innerHTML = '<option value="">Selecciona el teu grup...</option>';
    estat.usuaris.forEach((u) => {
      let opt = document.createElement("option");
      opt.value = u.nom;
      opt.innerText = u.nom;
      select.appendChild(opt);
    });

    // Inicialitzar altres elements globals
    generarDatalist();
    poblarMenú();
  } catch (e) {
    console.error("❌ Error en carregar dades:", e);
    document.getElementById("select-usuari").innerHTML =
      '<option value="">Error de connexió</option>';
  }
}

// 2. Login i Sessió
function login() {
  const nom = document.getElementById("select-usuari").value;
  const pass = document.getElementById("input-pass").value;

  if (!nom) return alert("Si us plau, selecciona un usuari.");

  const user = estat.usuaris.find((u) => u.nom === nom && u.pass == pass);

  if (user) {
    estat.userActiu = user;
    localStorage.setItem("olimpic_user", JSON.stringify(user));
    document.getElementById("modal-login").classList.add("hidden");
    iniciarApp();
  } else {
    alert("Contrasenya incorrecta");
  }
}

function iniciarApp() {
  document.getElementById("user-nom").innerText = estat.userActiu.nom;
  if (estat.userActiu.avatar) {
    document.getElementById("user-icon").innerHTML =
      `<img src="${estat.userActiu.avatar}" class="w-full h-full object-cover">`;
  }
  mostrarSeccio("dashboard");
}

// 3. Menú i Navegació
function poblarMenú() {
  const menu = document.getElementById("menu-temes");
  if (!menu) return;

  const temes = [...new Set(estat.preguntes.map((p) => p.tema))];

  if (temes.length === 0) {
    menu.innerHTML =
      '<p class="text-[10px] p-4 text-slate-500 italic">Sense temes carregats</p>';
    return;
  }

  menu.innerHTML = temes
    .map(
      (t) => `
        <button onclick="carregarTema('${t}')" class="w-full text-left p-3 text-xs bg-slate-800/50 hover:bg-indigo-600 rounded transition text-slate-300 font-semibold mb-2">
          ${t}
        </button>
    `,
    )
    .join("");
}

function mostrarSeccio(id) {
  const seccions = ["dashboard", "exercici", "progres"];
  seccions.forEach((s) => {
    const el = document.getElementById("seccio-" + s);
    if (el) el.classList.add("hidden");
  });

  const target = document.getElementById("seccio-" + id);
  if (target) {
    target.classList.remove("hidden");
    if (id === "progres") renderProgres();
  }
}

// 4. Lògica d'Exercicis (Taula, Majors, Balanç)
function carregarTema(nomTema) {
  const preguntesDelTema = estat.preguntes.filter((p) => p.tema === nomTema);
  if (preguntesDelTema.length > 0) {
    estat.temaActiu = nomTema;
    estat.preguntaActual = preguntesDelTema[0];
    estat.assentament = [
      { id: Date.now(), codi: "", nom: "", deure: 0, haver: 0 },
    ];

    document.getElementById("txt-enunciat").innerText =
      estat.preguntaActual.enunciat;
    document.getElementById("progres-tema").innerText = nomTema;
    document.getElementById("info-pregunta").innerText =
      `Pregunta 1 de ${preguntesDelTema.length}`;

    mostrarSeccio("exercici");
    renderTaula();
  }
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
        <tr class="hover:bg-slate-50 transition duration-200">
            <td class="p-2"><input type="text" list="pgc-list" value="${linia.codi}" onchange="updateLinia(${idx}, 'codi', this.value)" class="w-full p-2 outline-none font-bold text-indigo-600 bg-transparent border-b border-transparent focus:border-indigo-300"></td>
            <td class="p-2 text-slate-500 text-xs truncate max-w-[200px]">${linia.nom || "Cerca compte..."}</td>
            <td class="p-2"><input type="number" value="${linia.deure || ""}" placeholder="0.00" onchange="updateLinia(${idx}, 'deure', this.value)" class="w-full text-right p-2 outline-none focus:bg-emerald-50 text-emerald-700 font-bold bg-transparent"></td>
            <td class="p-2"><input type="number" value="${linia.haver || ""}" placeholder="0.00" onchange="updateLinia(${idx}, 'haver', this.value)" class="w-full text-right p-2 outline-none focus:bg-sky-50 text-sky-700 font-bold bg-transparent"></td>
            <td class="p-2 text-center"><button onclick="eliminarLinia(${idx})" class="text-slate-300 hover:text-rose-500">✕</button></td>
        </tr>`;
    })
    .join("");

  document.getElementById("total-deure").innerText =
    totalDeure.toFixed(2) + " €";
  document.getElementById("total-haver").innerText =
    totalHaver.toFixed(2) + " €";

  renderMajors();
  renderBalanc();
}

function updateLinia(idx, camp, valor) {
  if (camp === "codi") {
    const compte = estat.pgc.find((c) => c.codi == valor);
    estat.assentament[idx].codi = valor;
    estat.assentament[idx].nom = compte ? compte.nom : "Compte no trobat";
  } else {
    estat.assentament[idx][camp] = parseFloat(valor) || 0;
  }
  renderTaula();
}

function afegirFila() {
  estat.assentament.push({
    id: Date.now(),
    codi: "",
    nom: "",
    deure: 0,
    haver: 0,
  });
  renderTaula();
}

function eliminarLinia(idx) {
  estat.assentament.splice(idx, 1);
  renderTaula();
}

// 5. Visualitzacions Comptables
function renderMajors() {
  const container = document.getElementById("majors-container");
  if (!container) return;
  const moviments = {};
  estat.assentament.forEach((l) => {
    if (l.codi) {
      if (!moviments[l.codi]) moviments[l.codi] = { nom: l.nom, d: [], h: [] };
      if (l.deure > 0) moviments[l.codi].d.push(l.deure);
      if (l.haver > 0) moviments[l.codi].h.push(l.haver);
    }
  });
  container.innerHTML = Object.keys(moviments)
    .map(
      (codi) => `
        <div class="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
            <div class="bg-slate-50 border-b p-1 text-[9px] font-bold text-center truncate">${moviments[codi].nom}</div>
            <div class="grid grid-cols-2 text-[10px] font-mono p-1">
                <div class="border-r text-emerald-600">${moviments[codi].d.join("<br>") || "-"}</div>
                <div class="text-sky-600">${moviments[codi].h.join("<br>") || "-"}</div>
            </div>
        </div>
    `,
    )
    .join("");
}

function renderBalanc() {
  const container = document.getElementById("balanc-container");
  if (!container) return;
  let actiu = 0,
    passiu = 0;
  estat.assentament.forEach((l) => {
    if (["1", "2", "3", "4", "5"].includes(l.codi.charAt(0))) {
      actiu += l.deure;
      passiu += l.haver;
    }
  });
  container.innerHTML = `
        <div class="grid grid-cols-2 gap-2 text-center">
            <div class="bg-emerald-50 p-2 rounded">
                <div class="text-[9px] uppercase">Actiu</div>
                <div class="text-sm font-bold text-emerald-700">${actiu.toFixed(2)}€</div>
            </div>
            <div class="bg-sky-50 p-2 rounded">
                <div class="text-[9px] uppercase">Passiu</div>
                <div class="text-sm font-bold text-sky-700">${passiu.toFixed(2)}€</div>
            </div>
        </div>
    `;
}

// 6. Altres
function generarDatalist() {
  const dl = document.getElementById("pgc-list");
  if (dl)
    dl.innerHTML = estat.pgc
      .map((c) => `<option value="${c.codi}">${c.nom}</option>`)
      .join("");
}

function frescarDades() {
  location.reload();
}
