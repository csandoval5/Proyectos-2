/**
 * SISTEMA DE INVENTARIO TALLER DE MOTOS - FULL VERSION
 * Solución de errores: ReferenceError Appwrite, SyntaxError Redecalración
 */

// === 1. CONFIGURACIÓN E INICIALIZACIÓN ÚNICA ===
const { Client, Account, Databases, Teams, Storage, ID, Query } = window.Appwrite;

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('69f8b97e0005a97657e6');

const account = new Account(client);
const databases = new Databases(client);
const teams = new Teams(client);
const storage = new Storage(client);

// IDs de Appwrite
const DATABASE_ID = '69f8bb61001e9d5f2120';
const COLLECTION_ID = '69f8bb77002570be791f'; // Inventario
const VENTAS_ID = '69f8bb8c001f56a5c92e';     // Ventas/Historial

// Variables de Estado
let currentRole = 'empleado';
let inventoryData = [];
let salesData = [];

// === 2. GESTIÓN DE SESIÓN Y UI ===
async function checkSession() {
    try {
        const session = await account.get();
        if (session) {
            try {
                const userTeams = await teams.list();
                currentRole = userTeams.teams.some(t => t.name.toLowerCase() === 'admin') ? 'admin' : 'empleado';
            } catch (e) {
                currentRole = 'empleado'; // Fallback por bloqueo de cookies
            }
            showApp();
            loadInventory();
            loadSales();
        }
    } catch (error) {
        showLogin();
    }
}

function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appWrapper').style.display = 'flex';
    document.getElementById('userNameDisplay').innerText = "Usuario: " + currentRole.toUpperCase();
}

function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appWrapper').style.display = 'none';
}

async function login(email, password) {
    try {
        await account.createEmailPasswordSession(email, password);
        checkSession();
    } catch (error) {
        alert("Error: Credenciales inválidas o SDK bloqueado.");
    }
}

async function logout() {
    await account.deleteSession('current');
    location.reload();
}

// === 3. LÓGICA DE INVENTARIO (CRUD) ===
async function loadInventory() {
    try {
        const response = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [Query.orderDesc("$createdAt")]);
        inventoryData = response.documents;
        renderInventory(inventoryData);
        updateDashboard();
    } catch (error) {
        console.error("Error cargando inventario:", error);
    }
}

function renderInventory(items) {
    const container = document.getElementById('inventoryTableBody');
    container.innerHTML = '';

    items.forEach(item => {
        const lowStock = item.cantidad <= item.stockMin;
        const row = `
            <tr class="border-b border-slate-700 hover:bg-slate-800/50">
                <td class="p-3">${item.codigo}</td>
                <td class="p-3 font-medium">${item.nombre}</td>
                <td class="p-3">$${parseFloat(item.precio).toLocaleString()}</td>
                <td class="p-3">
                    <span class="px-2 py-1 rounded ${lowStock ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}">
                        ${item.cantidad}
                    </span>
                </td>
                <td class="p-3 text-slate-400">${item.categoria || 'N/A'}</td>
                <td class="p-3 text-center">
                    <button onclick="openEditModal('${item.$id}')" class="text-blue-400 hover:text-blue-200 mr-2">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${currentRole === 'admin' ? `
                    <button onclick="deleteProduct('${item.$id}')" class="text-red-400 hover:text-red-200">
                        <i class="fas fa-trash"></i>
                    </button>` : ''}
                </td>
            </tr>`;
        container.innerHTML += row;
    });
}

async function saveProduct(event) {
    event.preventDefault();
    const data = {
        codigo: document.getElementById('prodCodigo').value,
        nombre: document.getElementById('prodNombre').value,
        precio: parseFloat(document.getElementById('prodPrecio').value),
        cantidad: parseInt(document.getElementById('prodCantidad').value),
        stockMin: parseInt(document.getElementById('prodMin').value),
        categoria: document.getElementById('prodCategoria').value
    };

    try {
        await databases.createDocument(DATABASE_ID, COLLECTION_ID, ID.unique(), data);
        closeModal('productModal');
        loadInventory();
    } catch (error) {
        alert("Error al guardar: " + error.message);
    }
}

// === 4. SISTEMA DE VENTAS Y CAJA ===
async function registrarVenta(event) {
    event.preventDefault();
    const prodId = document.getElementById('ventaProdId').value;
    const cantVenta = parseInt(document.getElementById('ventaCantidad').value);
    
    const producto = inventoryData.find(p => p.$id === prodId);
    
    if (!producto || producto.cantidad < cantVenta) {
        alert("Stock insuficiente");
        return;
    }

    try {
        // 1. Crear registro de venta
        await databases.createDocument(DATABASE_ID, VENTAS_ID, ID.unique(), {
            productoNombre: producto.nombre,
            cantidad: cantVenta,
            total: producto.precio * cantVenta,
            fecha: new Date().toISOString()
        });

        // 2. Actualizar Stock
        await databases.updateDocument(DATABASE_ID, COLLECTION_ID, prodId, {
            cantidad: producto.cantidad - cantVenta
        });

        alert("Venta realizada con éxito");
        loadInventory();
        loadSales();
    } catch (error) {
        console.error(error);
    }
}

// === 5. DASHBOARD Y ANALÍTICA ===
function updateDashboard() {
    const totalProd = inventoryData.length;
    const inversion = inventoryData.reduce((acc, curr) => acc + (curr.precio * curr.cantidad), 0);
    const alertas = inventoryData.filter(p => p.cantidad <= p.stockMin).length;

    document.getElementById('statTotal').innerText = totalProd;
    document.getElementById('statInversion').innerText = "$" + inversion.toLocaleString();
    document.getElementById('statAlertas').innerText = alertas;
}

// === 6. UTILIDADES Y MODALES ===
function filterTable() {
    const busqueda = document.getElementById('searchInput').value.toLowerCase();
    const filtrados = inventoryData.filter(p => 
        p.nombre.toLowerCase().includes(busqueda) || 
        p.codigo.toLowerCase().includes(busqueda)
    );
    renderInventory(filtrados);
}

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.getElementById(id).classList.add('flex');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.getElementById(id).classList.remove('flex');
}

// === 7. FUNCIONES FALTANTES ===
async function openEditModal(id) {
    const item = inventoryData.find(p => p.$id === id);
    if (item) {
        // Populate edit modal fields (assuming editModal exists)
        document.getElementById('editProdCodigo').value = item.codigo || '';
        document.getElementById('editProdNombre').value = item.nombre || '';
        document.getElementById('editProdPrecio').value = item.precio || 0;
        document.getElementById('editProdCantidad').value = item.cantidad || 0;
        document.getElementById('editProdMin').value = item.stockMin || 0;
        document.getElementById('editProdCategoria').value = item.categoria || '';
        document.getElementById('editProdId').value = id;
        openModal('editModal');
    }
}

async function deleteProduct(id) {
    if (confirm('¿Eliminar producto?')) {
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, id);
            loadInventory();
        } catch (error) {
            alert('Error al eliminar: ' + error.message);
        }
    }
}

function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show selected
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}

async function loadSales() {
    try {
        const response = await databases.listDocuments(DATABASE_ID, VENTAS_ID, [Query.orderDesc('fecha')]);
        salesData = response.documents;
        renderSales(salesData);
    } catch (error) {
        console.error('Error cargando ventas:', error);
    }
}

function renderSales(items) {
    const container = document.getElementById('salesTableBody');
    if (!container) return;
    container.innerHTML = '';
    items.forEach(sale => {
        const row = `
            <tr class="border-b border-slate-700 hover:bg-slate-800/50">
                <td class="p-3">${sale.productoNombre}</td>
                <td class="p-3 text-center">${sale.cantidad}</td>
                <td class="p-3 font-medium">$${sale.total.toLocaleString()}</td>
                <td class="p-3 text-slate-400">${new Date(sale.fecha).toLocaleDateString()}</td>
            </tr>`;
        container.innerHTML += row;
    });
}

function exportExcel() {
    const data = inventoryData.map(item => ({
        Código: item.codigo,
        Nombre: item.nombre,
        Precio: item.precio,
        Stock: item.cantidad,
        'Stock Mín': item.stockMin,
        Categoría: item.categoria
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    XLSX.writeFile(wb, 'inventario_' + new Date().toISOString().slice(0,10) + '.xlsx');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        login(email, password);
    });
    
    // Product form
    document.getElementById('productForm')?.addEventListener('submit', saveProduct);
    
    // Venta form
    document.getElementById('ventaForm')?.addEventListener('submit', registrarVenta);
    
    // Search & filter
    document.getElementById('searchInput')?.addEventListener('input', filterTable);
    
    // Logout
    document.getElementById('btnLogout')?.addEventListener('click', logout);
    
    // Export
    document.getElementById('btnExportExcel')?.addEventListener('click', exportExcel);
    
    // Update role class for admin-only
    if (currentRole === 'admin') {
        document.querySelector('.sidebar-profile').classList.add('admin');
    }
    
    // Populate venta select
    updateVentaSelect();
});

function updateVentaSelect() {
    const select = document.getElementById('ventaProdId');
    if (select) {
        select.innerHTML = '<option value="">Seleccione producto</option>' + 
            inventoryData.map(p => `<option value="${p.$id}">${p.codigo} - ${p.nombre} (Stock: ${p.cantidad})</option>`).join('');
    }
}

// Update select after inventory load
const originalLoadInventory = loadInventory;
loadInventory = async function() {
    await originalLoadInventory();
    updateVentaSelect();
    updateDashboard();
};

// Inicialización
window.onload = checkSession;
