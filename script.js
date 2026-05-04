// window.Appwrite - Inicialización única sin duplicados
const { Client, Account, Databases, Teams, ID } = window.Appwrite;

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('69f8b97e0005a97657e6');

const account = new Account(client);
const database = new Databases(client);
const teams = new Teams(client);
const ID = new ID(client);

let currentUser = null;
let currentRole = 'admin';
let productos = [];
let clientes = [];
let ventas = [];
let editingId = null;

// ===== UI FUNCTIONS =====
function showElement(selector, show = true) {
  document.querySelectorAll(selector).forEach(el => el.classList.toggle('hidden', !show));
}

function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appWrapper').classList.remove('hidden');
}

function showLogin() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('appWrapper').classList.add('hidden');
}

// ===== AUTH =====
async function checkSession() {
  try {
    currentUser = await account.get();
    currentRole = 'admin';
    document.getElementById('userName').textContent = currentUser.name || currentUser.email;
    document.getElementById('userRole').textContent = currentRole;
    showApp();
    await loadAllData();
    showToast('¡Bienvenido!');
  } catch {
    showLogin();
  }
}

window.iniciarSesion = async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    await account.createEmailPasswordSession(email, password);
    location.reload();
  } catch (err) {
    Swal.fire('Error', err.message, 'error');
  }
};

document.getElementById('btnLogout')?.addEventListener('click', () => {
  account.deleteSession('current').then(location.reload);
});

// ===== DATA =====
async function loadAllData() {
  try {
    const response = await Promise.all([
      database.listDocuments('69f8bb61001e9d5f2120', 'productos'),
      database.listDocuments('69f8bb61001e9d5f2120', 'clientes'),
      database.listDocuments('69f8bb61001e9d5f2120', 'ventas')
    ]);
    [productos, clientes, ventas] = response.map(r => r.documents);
    renderAll();
    updateDashboard();
  } catch (err) {
    console.error('Load error:', err);
  }
}

// ===== UI RENDER =====
function renderAll() {
  // Tables, badges, etc.
}

function updateDashboard() {
  document.getElementById('totalProducts').textContent = productos.length;
  // More...
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', checkSession);
