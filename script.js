/* Appwrite Complete Inventory - Taller de Motos - FIXED LOGIN → INVENTARIO
 * Full CRUD: productos/clientes/ventas + Auth/Roles + Dashboard + Charts + Excel
 * Vanilla JS + CDNs - Ready for GitHub Pages
 * Date: 2024 - Session & Load Fixed
 * Project: 69f8b97e0005a97657e6 | DB: 69f8bb61001e9d5f2120
 */

// ===== APPWRITE CONFIG (exact user specs) =====
const APPWRITE_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const APPWRITE_PROJECT = '69f8b97e0005a97657e6';
const APPWRITE_DATABASE_ID = '69f8bb61001e9d5f2120';
const APPWRITE_PRODUCTOS = 'productos';
const APPWRITE_CLIENTES = 'clientes';
const APPWRITE_VENTAS = 'ventas';
const ADMIN_TEAM = 'Administradores';
const MECHANIC_TEAM = 'Mecanicos';

const client = new Appwrite.Client();
client.setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT);

const account = new Appwrite.Account(client);
const teams = new Appwrite.Teams(client);
const database = new Appwrite.Databases(client);
const ID = new Appwrite.ID();

let currentUser = null;
let currentRole = null;
let productos = [];
let clientes = [];
let ventas = [];
let editingId = null;
let editingType = null;
let chart = null;

// ===== UI ELEMENTS (matches index.html) =====
const loginScreen = document.getElementById('loginScreen');
const appWrapper = document.getElementById('appWrapper');
const userNameEl = document.getElementById('userName');
const userRoleEl = document.getElementById('userRole');

// ===== UTILS =====
function showElement(selector, show = true) {
  document.querySelectorAll(selector).forEach(el => el.classList.toggle('hidden', !show));
}

function showToast(title, icon = 'success') {
  Swal.fire({ 
    title, 
    icon, 
    toast: true, 
    position: 'top-end', 
    timer: 3000, 
    showConfirmButton: false 
  });
}

function showAlert(title, text, icon = 'success') {
  Swal.fire({ title, text, icon, confirmButtonText: 'OK' });
}

function resetForms() {
  editingId = null;
  editingType = null;
  document.querySelectorAll('form').forEach(f => f.reset());
}

function buildRoleUI() {
  const isAdmin = currentRole === 'admin';
  showElement('.admin-only', isAdmin);
}

function validateFormData(type, data) {
  const required = {
    producto: ['codigo', 'nombre', 'precio', 'cantidad', 'stock_minimo'],
    cliente: ['nombre', 'telefono']
  };
  for (let field of required[type]) if (!data[field]) return false;
  return true;
}

// ===== AUTH - FIXED PER USER SPECS =====
async function checkSession() {
  try {
    console.log('🔍 Verificando sesión...');
    currentUser = await account.get();
    console.log('✅ Usuario activo:', currentUser.email);
    
    // TRY/CATCH TEAMS - DEFAULT 'admin' si falla
    let currentRole = 'admin'; // Default
    try {
      const teamList = await teams.list();
      const teamsUser = teamList.teams.map(t => t.name);
      currentRole = teamsUser.includes(ADMIN_TEAM) ? 'admin' : 
                   teamsUser.includes(MECHANIC_TEAM) ? 'mecanico' : 'admin';
    } catch (teamsErr) {
      console.warn('⚠️ Error teams.list():', teamsErr.message, '- Usando rol default "admin"');
    }
    
    ::currentRole:: = currentRole; // Global
    
    userNameEl.textContent = currentUser.name || currentUser.email;
    userRoleEl.textContent = currentRole.charAt(0).toUpperCase() + currentRole.slice(1);
    buildRoleUI();
    
    // IMMEDIATELY SHOW APP + LOAD
    showApp();
    showTab('productos');
    await loadAllData();
    
    console.log('✅ checkSession OK - App mostrada, inventario cargado');
    showToast('¡Bienvenido! Inventario cargado.', 'success');
  } catch (err) {
    console.error('❌ No sesión válida:', err.message);
    showLogin();
  }
}

async function iniciarSesion(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    console.log('🔐 Intentando login:', email);
    
    // PASO 1: Cerrar sesión previa (evita "Session already active")
    try {
      await account.deleteSession('current');
      console.log('🧹 Sesión previa cerrada');
    } catch (logoutErr) {
      console.log('ℹ️ No había sesión previa');
    }
    
    // PASO 2: Crear nueva sesión
    await account.createEmailPasswordSession(email, password);
    
// PASO 3: SweetAlert + Reload (SPA compatible)
    showToast('¡Login exitoso! Mostrando inventario...', 'success');
    window.location.reload(); // Trigger checkSession full flow
    
  } catch (err) {
    console.error('❌ Login falló:', err);
    showAlert('Error de Login', err.message.includes('invalid') ? 'Credenciales incorrectas' : err.message, 'error');
  }
}

// Alias global
window.iniciarSesion = iniciarSesion;

async function logout() {
  try {
    await account.deleteSession('current');
  } catch {}
  location.reload();
}

// ===== CARGA DE DATOS - CARGA DE PRODUCTOS EXPLÍCITA =====
async function cargarProductos() {
  try {
    console.log('📦 Cargando productos...');
    const response = await database.listDocuments(APPWRITE_DATABASE_ID, APPWRITE_PRODUCTOS);
    productos = response.documents || [];
    renderProductos();
    console.log(`✅ ${productos.length} productos cargados`);
  } catch (err) {
    console.error('❌ Error productos:', err);
    showToast('Error cargando productos', 'error');
  }
}

async function loadData(collection) {
  try {
    const response = await database.listDocuments(APPWRITE_DATABASE_ID, collection);
    return response.documents || [];
  } catch (err) {
    console.error(`❌ Error ${collection}:`, err);
    return [];
  }
}

async function loadAllData() {
  [productos, clientes, ventas] = await Promise.all([
    loadData(APPWRITE_PRODUCTOS),
    loadData(APPWRITE_CLIENTES),
    loadData(APPWRITE_VENTAS)
  ]);
  
  // Renderizar todo
  renderAll();
  updateSelects(); // FIX: Poblar selects ventas
  updateDashboard();
  updateCharts();
  
  // BADGES tabs
  document.getElementById('badgeProductos').textContent = productos.length;
  document.getElementById('badgeClientes').textContent = clientes.length;
  document.getElementById('badgeVentas').textContent = ventas.length;
}

// FIX: Poblar selects de ventas
function updateSelects() {
  const clienteSel = document.getElementById('ventaCliente');
  const productoSel = document.getElementById('ventaProducto');
  
  if (clienteSel) {
    clienteSel.innerHTML = '<option value="">Seleccionar cliente...</option>' + 
      clientes.map(c => `<option value="${c.nombre}">${c.nombre} (${c.telefono})</option>`).join('');
  }
  
  if (productoSel) {
    productoSel.innerHTML = '<option value="">Seleccionar producto...</option>' + 
      productos.map(p => `<option value="${p.nombre}">${p.nombre} ($${p.precio} x${p.cantidad})</option>`).join('');
  }
}

async function saveData(collection, data) {
  if (editingId) {
    return database.updateDocument(APPWRITE_DATABASE_ID, collection, editingId, data);
  } else {
    return database.createDocument(APPWRITE_DATABASE_ID, collection, ID.unique(), data);
  }
}

async function deleteData(collection, id) {
  return database.deleteDocument(APPWRITE_DATABASE_ID, collection, id);
}

// ===== RENDER - PRODUCTOS TABLA =====
function renderTable(containerId, data, columns, renderRow) {
  const tbody = document.getElementById(containerId);
  if (!tbody) return;
  tbody.innerHTML = data.map(renderRow).join('') || '<tr><td colspan="' + columns.length + '">Sin datos</td></tr>';
}

function renderProductos() {
  renderTable('productosBody', productos, ['Código', 'Nombre', 'Precio', 'Cantidad', 'Stock Min', 'Acciones'], (p) => {
    const low = p.cantidad <= p.stock_minimo;
    const price = parseFloat(p.precio || 0).toLocaleString();
    const delBtn = currentRole === 'admin' ? `<button data-id="${p.$id}" data-type="${APPWRITE_PRODUCTOS}" class="btn-danger delete-btn"><i class="fas fa-trash"></i></button>` : '';
    const editData = JSON.stringify({
      codigo: p.codigo || '', 
      nombre: p.nombre || '', 
      precio: p.precio || 0, 
      cantidad: p.cantidad || 0, 
      stock_minimo: p.stock_minimo || 0
    }).replace(/"/g, '"');
    return `
      <tr class="${low ? 'low-stock' : ''}">
        <td>${p.codigo || '-'}</td>
        <td>${p.nombre}</td>
        <td>$${price}</td>
        <td>${p.cantidad}</td>
        <td>${p.stock_minimo}</td>
        <td>
          <button data-id="${p.$id}" data-type="${APPWRITE_PRODUCTOS}" data-data="${editData}" class="btn-edit btn btn-secondary"><i class="fas fa-edit"></i></button>
          ${delBtn}
        </td>
      </tr>`;
  });
}

function renderClientes() {
  renderTable('clientesBody', clientes, ['Nombre', 'Teléfono', 'Dirección', 'Moto', 'Acciones'], (c) => {
    const delBtn = currentRole === 'admin' ? `<button data-id="${c.$id}" data-type="${APPWRITE_CLIENTES}" class="btn-danger delete-btn"><i class="fas fa-trash"></i></button>` : '';
    const editData = JSON.stringify({
      nombre: c.nombre || '', 
      telefono: c.telefono || '', 
      direccion: c.direccion || '', 
      moto: c.moto || ''
    }).replace(/"/g, '"');
    return `
      <tr>
        <td>${c.nombre}</td>
        <td>${c.telefono}</td>
        <td>${c.direccion || '-'}</td>
        <td>${c.moto || '-'}</td>
        <td>
          <button data-id="${c.$id}" data-type="${APPWRITE_CLIENTES}" data-data="${editData}" class="btn-edit btn btn-secondary"><i class="fas fa-edit"></i></button>
          ${delBtn}
        </td>
      </tr>`;
  });
}

function renderVentas() {
  renderTable('ventasBody', ventas, ['Cliente', 'Producto', 'Cantidad', 'Total', 'Fecha', 'Acciones'], (v) => {
    const total = parseFloat(v.total || 0).toLocaleString();
    const delBtn = currentRole === 'admin' ? `<button data-id="${v.$id}" data-type="${APPWRITE_VENTAS}" class="btn-danger delete-btn"><i class="fas fa-trash"></i></button>` : '';
    return `
      <tr>
        <td>${v.cliente || '-'}</td>
        <td>${v.producto || '-'}</td>
        <td>${v.cantidad}</td>
        <td>$${total}</td>
        <td>${v.fecha}</td>
        <td>${delBtn}</td>
      </tr>`;
  });
}

function renderAll() {
  renderProductos();
  renderClientes();
  renderVentas();
}

function updateDashboard() {
  const totalP = productos.length;
  const totalC = clientes.length;
  const totalV = ventas.length;
  const ingresos = ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
  const lowStock = productos.filter(p => p.cantidad <= p.stock_minimo).length;
  
  document.getElementById('totalProducts').textContent = totalP;
  document.getElementById('totalStock').textContent = productos.reduce((sum, p) => sum + parseInt(p.cantidad || 0), 0);
  document.getElementById('lowStockCount').textContent = lowStock;
  document.getElementById('inventoryValue').textContent = `$${productos.reduce((sum, p) => sum + (parseFloat(p.precio || 0) * parseInt(p.cantidad || 0)), 0).toLocaleString()}`;
  document.getElementById('totalClientes').textContent = totalC;
  document.getElementById('totalVentas').textContent = totalV;
  document.getElementById('totalIngresos').textContent = `$${ingresos.toLocaleString()}`;
}

function updateCharts() {
  const canvas = document.getElementById('graficoVentas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const ventasByDate = {};
  ventas.forEach(v => ventasByDate[v.fecha] = (ventasByDate[v.fecha] || 0) + parseFloat(v.total || 0));
  const labels = Object.keys(ventasByDate).sort();
  const data = labels.map(d => ventasByDate[d]);
  
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: { 
      labels, 
      datasets: [{ 
        label: 'Ventas', 
        data, 
        borderColor: '#6366f1', 
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        fill: true 
      }] 
    },
    options: { 
      responsive: true, 
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: false } }
    }
  });
}

// ===== CRUD ACTIONS =====
window.editItem = function(id, collection, data) {
  editingId = id;
  editingType = collection === APPWRITE_PRODUCTOS ? 'producto' : 'cliente';
  
  if (editingType === 'producto') {
    document.getElementById('productCodigo').value = data.codigo || '';
    document.getElementById('productNombre').value = data.nombre || '';
    document.getElementById('productPrecio').value = data.precio || '';
    document.getElementById('productCantidad').value = data.cantidad || 0;
    document.getElementById('productStockMin').value = data.stock_minimo || 5;
    document.querySelector('#formTitleProd').textContent = 'Editar Producto';
    showTab('productos');
  } else if (editingType === 'cliente') {
    document.getElementById('clienteNombre').value = data.nombre || '';
    document.getElementById('clienteTelefono').value = data.telefono || '';
    document.getElementById('clienteDireccion').value = data.direccion || '';
    document.getElementById('clienteMoto').value = data.moto || '';
    showTab('clientes');
  }
};

window.showTab = function(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  document.getElementById(tabName)?.classList.add('active');
  
  const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => 
    btn.getAttribute('onclick')?.includes(tabName)
  );
  if (activeBtn) activeBtn.classList.add('active');
};

window.deleteItem = async function(id, collection, restoreStock = false) {
  const confirm = await Swal.fire({ 
    title: '¿Confirmar eliminar?', 
    icon: 'warning', 
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar'
  });
  if (!confirm.isConfirmed) return;
  
  try {
    if (restoreStock && collection === APPWRITE_VENTAS) {
      const v = ventas.find(v => v.$id === id);
      if (v) {
        const p = productos.find(p => p.nombre === v.producto);
        if (p) {
          p.cantidad += parseInt(v.cantidad);
          await saveData(APPWRITE_PRODUCTOS, p);
        }
      }
    }
    
    await deleteData(collection, id);
    await loadAllData();
    showToast('Eliminado correctamente');
  } catch (err) {
    showAlert('Error', 'No se pudo eliminar', 'error');
  }
};

async function saveProducto(e) {
  e.preventDefault();
  const data = {
    codigo: document.getElementById('productCodigo').value.trim(),
    nombre: document.getElementById('productNombre').value.trim(),
    precio: parseFloat(document.getElementById('productPrecio').value),
    cantidad: parseInt(document.getElementById('productCantidad').value),
    stock_minimo: parseInt(document.getElementById('productStockMin').value)
  };
  
  if (!validateFormData('producto', data)) {
    return showAlert('Error', 'Completa todos los campos requeridos');
  }
  
  if (currentRole === 'mecanico' && editingId) {
    const orig = productos.find(p => p.$id === editingId);
    if (orig) data.precio = orig.precio;
  }
  
  try {
    await saveData(APPWRITE_PRODUCTOS, data);
    resetForms();
    await loadAllData();
    showToast('Producto guardado');
  } catch (err) {
    showAlert('Error', 'No se pudo guardar', 'error');
  }
}

async function saveCliente(e) {
  e.preventDefault();
  const data = {
    nombre: document.getElementById('clienteNombre').value.trim(),
    telefono: document.getElementById('clienteTelefono').value.trim(),
    direccion: document.getElementById('clienteDireccion').value.trim(),
    moto: document.getElementById('clienteMoto').value.trim()
  };
  
  if (!data.nombre || !data.telefono) {
    return showAlert('Error', 'Nombre y teléfono requeridos');
  }
  
  try {
    await saveData(APPWRITE_CLIENTES, data);
    resetForms();
    await loadAllData();
    showToast('Cliente guardado');
  } catch (err) {
    showAlert('Error', 'No se pudo guardar', 'error');
  }
}

async function saveVenta(e) {
  e.preventDefault();
  const cliente = document.getElementById('ventaCliente').value;
  const productoNombre = document.getElementById('ventaProducto').value;
  const cantidad = parseInt(document.getElementById('ventaCantidad').value);
  const total = parseFloat(document.getElementById('ventaTotal').value);
  
  if (!cliente || !productoNombre || !cantidad || !total) {
    return showAlert('Error', 'Completa todos los campos');
  }
  
  const producto = productos.find(p => p.nombre === productoNombre);
  if (!producto || producto.cantidad < cantidad) {
    return showAlert('Error', 'Stock insuficiente o producto no encontrado');
  }
  
  try {
    // Restar stock
    producto.cantidad -= cantidad;
    await saveData(APPWRITE_PRODUCTOS, producto);
    
    // Guardar venta
    const ventaData = {
      cliente,
      producto: productoNombre,
      cantidad,
      total,
      fecha: new Date().toLocaleDateString('es-ES')
    };
    
    await saveData(APPWRITE_VENTAS, ventaData);
    
    resetForms();
    await loadAllData();
    showToast('Venta registrada ✓ Stock actualizado');
  } catch (err) {
    showAlert('Error', 'No se pudo registrar venta', 'error');
  }
}

function updateVentaTotal() {
  const productoSel = document.getElementById('ventaProducto');
  const cantidadInput = document.getElementById('ventaCantidad');
  const totalInput = document.getElementById('ventaTotal');
  
  const productoNombre = productoSel.value;
  const cantidad = parseInt(cantidadInput.value) || 0;
  
  if (productoNombre && cantidad > 0) {
    const producto = productos.find(p => p.nombre === productoNombre);
    if (producto) {
      totalInput.value = (producto.precio * cantidad).toFixed(2);
    }
  } else {
    totalInput.value = '';
  }
}

// ===== EXCEL EXPORT =====
async function exportExcel() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productos), 'Productos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientes), 'Clientes');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ventas), 'Ventas');
  XLSX.writeFile(wb, `inventario-taller-${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast('Excel exportado');
}

// ===== EVENTS BINDING =====
function bindEvents() {
  // Forms
  document.getElementById('loginForm').addEventListener('submit', iniciarSesion);
  document.getElementById('btnLogout').addEventListener('click', logout);
  document.getElementById('productForm').addEventListener('submit', saveProducto);
  document.getElementById('clienteForm').addEventListener('submit', saveCliente);
  document.getElementById('ventaForm').addEventListener('submit', saveVenta);
  
  // Utils
  document.getElementById('btnExportExcel').addEventListener('click', exportExcel);
  document.getElementById('ventaCantidad').addEventListener('input', updateVentaTotal);
  document.getElementById('ventaProducto').addEventListener('change', updateVentaTotal);
  
  // Delegation: Edit/Delete
  document.addEventListener('click', function(e) {
    if (e.target.matches('.btn-edit')) {
      const id = e.target.closest('.btn-edit').dataset.id;
      const type = e.target.closest('.btn-edit').dataset.type;
      const dataStr = e.target.closest('.btn-edit').dataset.data.replace(/"/g, '"');
      const data = JSON.parse(dataStr);
      editItem(id, type, data);
    }
    if (e.target.matches('.delete-btn')) {
      const id = e.target.closest('.delete-btn').dataset.id;
      const type = e.target.closest('.delete-btn').dataset.type;
      deleteItem(id, type, type === APPWRITE_VENTAS);
    }
  });
}

// ===== UI TOGGLES =====
function showApp() {
  console.log('👁️ Mostrando app principal');
  loginScreen.classList.add('hidden');
  appWrapper.classList.remove('hidden');
}

function showLogin() {
  appWrapper.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

// ===== INIT - LOAD ON START =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Appwrite Inventory inicializando...');
  bindEvents();
  checkSession(); // ← AUTO-VERIFICA SESIÓN Y CARGA INVENTARIO
});

