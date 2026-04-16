const API_BASE = "http://127.0.0.1:8000/api";
const token = localStorage.getItem("token");

const topbarUsuarioNombre = document.getElementById("topbarUsuarioNombre");
const topbarUsuarioRol = document.getElementById("topbarUsuarioRol");

const kpiTotalProductos = document.getElementById("kpiTotalProductos");
const kpiStockBajo = document.getElementById("kpiStockBajo");
const kpiVentasHoy = document.getElementById("kpiVentasHoy");
const kpiIngresosHoy = document.getElementById("kpiIngresosHoy");
const cardShortcutProductos = document.getElementById("cardShortcutProductos");
const cardShortcutStock = document.getElementById("cardShortcutStock");
const cardShortcutVentas = document.getElementById("cardShortcutVentas");
const cardShortcutIngresos = document.getElementById("cardShortcutIngresos");

const buscarProducto = document.getElementById("buscarDashboardProducto");
const filtroCategoria = document.getElementById("filtroDashboardCategoria");
const estadoTabla = document.getElementById("estadoDashboardTabla");
const tablaBody = document.querySelector(".tabla-productos tbody");

let productos = [];
let ventas = [];

if (!token) {
    window.location.href = "login.html";
}

function getHeaders() {
    return {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
    };
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function money(value) {
    return `$${Number(value || 0).toFixed(2)}`;
}

function setTableStatus(message) {
    if (!estadoTabla) return;
    estadoTabla.textContent = message;
    estadoTabla.style.display = "block";
}

function hideTableStatus() {
    if (!estadoTabla) return;
    estadoTabla.style.display = "none";
}

async function requestJson(path) {
    const response = await fetch(`${API_BASE}${path}`, {
        method: "GET",
        headers: getHeaders(),
    });

    if (response.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "login.html";
        throw new Error("Sesión expirada");
    }

    if (!response.ok) {
        throw new Error(`Error ${response.status} en ${path}`);
    }

    return response.json();
}

function llenarFiltros() {
    const categoriasMap = new Map();

    productos.forEach((item) => {
        if (item?.categoria?.id_categoria) {
            categoriasMap.set(String(item.categoria.id_categoria), item.categoria.nombre || "Sin categoría");
        }
    });

    const opcionesCategorias = ['<option value="">Todas las Categorías</option>'];
    Array.from(categoriasMap.entries())
        .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "es"))
        .forEach(([id, nombre]) => {
            opcionesCategorias.push(`<option value="${escapeHtml(id)}">${escapeHtml(nombre)}</option>`);
        });

    filtroCategoria.innerHTML = opcionesCategorias.join("");
}

function getProductosFiltrados() {
    const texto = String(buscarProducto?.value || "").trim().toLowerCase();
    const categoria = String(filtroCategoria?.value || "");

    return productos.filter((item) => {
        const coincideTexto = !texto
            || String(item?.nombre || "").toLowerCase().includes(texto)
            || String(item?.codigo || "").toLowerCase().includes(texto);

        const coincideCategoria = !categoria || String(item?.id_categoria || "") === categoria;

        return coincideTexto && coincideCategoria;
    });
}

function renderTabla() {
    if (!tablaBody) return;

    const lista = getProductosFiltrados();

    if (!lista.length) {
        tablaBody.innerHTML = "";
        setTableStatus("No hay productos para mostrar con esos filtros.");
        return;
    }

    hideTableStatus();

    tablaBody.innerHTML = lista.map((item) => {
        const stock = Number(item?.stock || 0);
        const categoria = item?.categoria?.nombre || "Sin categoría";
        const claseStock = stock < 5 ? "stock-bajo" : "";

        return `
            <tr>
                <td>${escapeHtml(item?.codigo || "-")}</td>
                <td>${escapeHtml(item?.nombre || "Producto")}</td>
                <td><span class="categoria">${escapeHtml(categoria)}</span></td>
                <td>${escapeHtml(money(item?.precio || 0))}</td>
                <td class="${claseStock}">${escapeHtml(stock)}</td>
                <td class="acciones">
                    <a class="btn-ver-dashboard" href="productos.html" title="Ver en productos">Ver</a>
                </td>
            </tr>
        `;
    }).join("");
}

function actualizarKpis() {
    const totalProductos = productos.length;
    const totalStockBajo = productos.filter((item) => Number(item?.stock || 0) < 5).length;

    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    const claveHoy = `${yyyy}-${mm}-${dd}`;

    const ventasHoyMap = new Map();

    ventas.forEach((item) => {
        const idVenta = Number(item?.id_venta || 0);
        if (!idVenta) return;

        const fecha = String(item?.fecha || "").slice(0, 10);
        if (fecha !== claveHoy) return;

        if (!ventasHoyMap.has(idVenta)) {
            ventasHoyMap.set(idVenta, Number(item?.total || 0));
        }
    });

    const totalVentasHoy = ventasHoyMap.size;
    const ingresosHoy = Array.from(ventasHoyMap.values()).reduce((acc, v) => acc + Number(v || 0), 0);

    kpiTotalProductos.textContent = String(totalProductos);
    kpiStockBajo.textContent = String(totalStockBajo);
    kpiVentasHoy.textContent = String(totalVentasHoy);
    kpiIngresosHoy.textContent = money(ingresosHoy);
}

function drawGoogleCharts() {
    if (!window.google || !window.google.visualization) return;

    const topProductos = new Map();
    ventas.forEach((item) => {
        const nombre = String(item?.producto || "Producto");
        const cantidad = Number(item?.cantidad || 0);
        topProductos.set(nombre, Number(topProductos.get(nombre) || 0) + cantidad);
    });

    const topOrdenados = Array.from(topProductos.entries())
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 6);

    const ventasData = new google.visualization.DataTable();
    ventasData.addColumn("string", "Producto");
    ventasData.addColumn("number", "Cantidad Vendida");

    if (topOrdenados.length) {
        ventasData.addRows(topOrdenados.map(([nombre, cantidad]) => [nombre, Number(cantidad)]));
    } else {
        ventasData.addRows([["Sin datos", 0]]);
    }

    const ventasChart = new google.visualization.ColumnChart(document.getElementById("ventasChart"));
    ventasChart.draw(ventasData, {
        legend: "none",
        colors: ["#4f7dd6"],
        hAxis: { textStyle: { color: "#334155" } },
        vAxis: { minValue: 0, textStyle: { color: "#334155" } },
        chartArea: { left: 50, right: 20, top: 20, bottom: 60 },
    });

    const porCategoria = new Map();
    productos.forEach((item) => {
        const categoria = String(item?.categoria?.nombre || "Sin categoría");
        const stock = Number(item?.stock || 0);
        porCategoria.set(categoria, Number(porCategoria.get(categoria) || 0) + stock);
    });

    const categoriasRows = Array.from(porCategoria.entries()).sort((a, b) => Number(b[1]) - Number(a[1]));

    const inventarioData = new google.visualization.DataTable();
    inventarioData.addColumn("string", "Categoría");
    inventarioData.addColumn("number", "Stock");

    if (categoriasRows.length) {
        inventarioData.addRows(categoriasRows.map(([nombre, stock]) => [nombre, Number(stock)]));
    } else {
        inventarioData.addRows([["Sin datos", 0]]);
    }

    const inventarioChart = new google.visualization.PieChart(document.getElementById("inventarioChart"));
    inventarioChart.draw(inventarioData, {
        legend: { position: "bottom" },
        chartArea: { left: 20, right: 20, top: 20, bottom: 30 },
        pieSliceTextStyle: { color: "#0f172a" },
    });
}

async function cargarUsuarioSesion() {
    try {
        const user = await requestJson("/me");
        if (topbarUsuarioNombre) {
            topbarUsuarioNombre.textContent = user?.nombre || "Usuario";
        }
        if (topbarUsuarioRol) {
            topbarUsuarioRol.textContent = "Administrador";
        }
    } catch {
        if (topbarUsuarioNombre) {
            topbarUsuarioNombre.textContent = "Sin sesión";
        }
    }
}

function setupEventos() {
    buscarProducto?.addEventListener("input", renderTabla);
    filtroCategoria?.addEventListener("change", renderTabla);

    cardShortcutProductos?.addEventListener("click", () => {
        window.location.href = "productos.html";
    });

    cardShortcutStock?.addEventListener("click", () => {
        window.location.href = "productos.html";
    });

    cardShortcutVentas?.addEventListener("click", () => {
        window.location.href = "ventas.html";
    });

    cardShortcutIngresos?.addEventListener("click", () => {
        window.location.href = "ventas.html";
    });

    window.addEventListener("resize", () => {
        drawGoogleCharts();
    });
}

async function initDashboard() {
    setTableStatus("Cargando dashboard...");

    try {
        await cargarUsuarioSesion();

        const [productosRes, ventasRes] = await Promise.all([
            requestJson("/productos"),
            requestJson("/ventas"),
        ]);

        productos = Array.isArray(productosRes) ? productosRes : [];
        ventas = Array.isArray(ventasRes) ? ventasRes : [];

        llenarFiltros();
        renderTabla();
        actualizarKpis();

        if (window.google && window.google.charts) {
            google.charts.load("current", { packages: ["corechart"] });
            google.charts.setOnLoadCallback(drawGoogleCharts);
        }
    } catch (error) {
        console.error(error);
        setTableStatus("No se pudo cargar la informacion del dashboard.");
    }
}

setupEventos();
void initDashboard();
