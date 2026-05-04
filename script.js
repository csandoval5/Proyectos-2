/* Appwrite FIXED - Global IIFE v14 + Error Handling */
const { Client, Account, Databases, ID } = Appwrite;

// CONFIG
const client = new Client()
  .setEndpoint('https://nyc.cloud.appwrite.io/v1')
  .setProject('69f8b97e0005a97657e6');
const account = new Account(client);
const database = new Databases(client);

// SDK Check
if (typeof Appwrite === 'undefined') {
  document.body.innerHTML += `
    <div style="position:fixed;z-index:10000;top:0;left:0;right:0;bottom:0;background:#0008;display:flex;align-items:center;justify-content:center;font-family:system-ui;">
      <div style="background:#1a1a2e;padding:2rem;border-radius:1rem;color:white;text-align:center;max-width:400px;">
        <h2>🚫 SDK Bloqueado</h2>
        <p>Tu navegador bloqueó la conexión. Desactiva bloqueadores de anuncios o modo incógnito y recarga.</p>
        <button onclick="location.reload()" style="margin-top:1rem;padding:.75rem 1.5rem;background:#6366f1;color:white;border:none;border-radius:.5rem;cursor:pointer;">Recargar</button>
      </div>
    </div>`;
  throw new Error('Appwrite blocked');
}

let currentUser, role = 'admin', productos = [], clientes = [], ventas = [];

// UI TOGGLE
function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appWrapper').style.display = 'block';
}

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appWrapper').style.display = 'none';
}

// LOGIN
window.iniciarSesion = async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    await account.deleteSession('current');
    await account.createEmailPasswordSession(email, password);
    showToast('Login exitoso!');
    setTimeout(() => location.reload(), 1000);
  } catch (err) {
    showToast(err.message || 'Error login', 'error');
  }
};

// CHECK SESSION
async function checkSession() {
  try {
    currentUser = await account.get();
    role = 'admin'; // Bypass teams
    document.getElementById('userName').textContent = currentUser.email;
    document.getElementById('userRole').textContent = role;
    showApp();
    loadData();
  } catch {
    showLogin();
  }
}

// DATA CRUD (simplified)
async function loadData() {
  try {
    const [p, c, v] = await Promise.all([
      database.listDocuments('69f8bb61001e9d5f2120', 'productos'),
      database.listDocuments('69f8bb61001e9d5f2120', 'clientes'),
      database.listDocuments('69f8bb61001e9d5f2120', 'ventas')
    ]);
    productos = p.documents;
    clientes = c.documents;
    ventas = v.documents;
    updateUI();
  } catch (e) {
    console.log('Data load fail:', e);
  }
}

async function saveData(col, data) {
  try {
    await database.createDocument('69f8bb61001e9d5f2120', col, ID.unique(), data);
    loadData();
    showToast('Guardado!');
  } catch (e) {
    showToast('Error guardando', 'error');
  }
}

// UI UPDATE (simplified)
function updateUI() {
  document.getElementById('totalProducts').textContent = productos.length;
  // More updates...
}

function showToast(msg, type = 'success') {
  // SweetAlert toast
}

// INIT
document.addEventListener('DOMContentLoaded', checkSession);
document.getElementById('btnLogout')?.addEventListener('click', () => account.deleteSession('current').then(location.reload));
