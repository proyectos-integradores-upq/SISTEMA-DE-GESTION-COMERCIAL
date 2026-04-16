const API_BASE = "http://127.0.0.1:8000/api";
const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "login.html";
}

const topbarUsuarioNombre = document.getElementById("topbarUsuarioNombre");
const topbarUsuarioRol = document.getElementById("topbarUsuarioRol");

const filtroDesde = document.getElementById("filtroDesdeReporte");
const filtroHasta = document.getElementById("filtroHastaReporte");
const filtroMes = document.getElementById("filtroMesReporte");
const filtroCategoria = document.getElementById("filtroCategoriaReporte");
const btnGenerar = document.getElementById("btnGenerarReporte");

const kpiTotalVentas = document.getElementById("kpiTotalVentas");
const kpiIngresosTotales = document.getElementById("kpiIngresosTotales");
const kpiProductoDestacado = document.getElementById("kpiProductoDestacado");
const kpiProductoDestacadoMeta = document.getElementById("kpiProductoDestacadoMeta");
const kpiStockBajo = document.getElementById("kpiStockBajo");
const kpiPromedioDiario = document.getElementById("kpiPromedioDiario");
const kpiGananciaNeta = document.getElementById("kpiGananciaNeta");

const tablaReportesBody = document.getElementById("tablaReportesBody");
const estadoTablaReportes = document.getElementById("estadoTablaReportes");

let productos = [];
let ventasRaw = [];
let entradasRaw = [];

let ventasChart = null;
let categoriaChart = null;
let tendenciaChart = null;
let ventasEntradasChart = null;

let ultimoResumenDiario = [];
let ultimoResumenTotales = { ventas: 0, ingresos: 0 };

function getHeaders() {
    return {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
    };
}

function money(value) {
    return `$${Number(value || 0).toFixed(2)}`;
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

function parseDateValue(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
    const date = parseDateValue(value);
    if (!date) return "-";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function requestJson(path) {
    return fetch(`${API_BASE}${path}`, {
        method: "GET",
        headers: getHeaders(),
    }).then(async (response) => {
        if (response.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "login.html";
            throw new Error("Sesión expirada");
        }

        if (!response.ok) {
            throw new Error(`No se pudo consultar ${path}`);
        }

        return response.json();
    });
}

function setEstadoTabla(text) {
    if (!estadoTablaReportes) return;
    estadoTablaReportes.textContent = text;
    estadoTablaReportes.style.display = "block";
}

function hideEstadoTabla() {
    if (!estadoTablaReportes) return;
    estadoTablaReportes.style.display = "none";
}

function cargarCategoriasFiltro() {
    const categorias = new Map();

    productos.forEach((item) => {
        if (item?.categoria?.id_categoria) {
            categorias.set(String(item.categoria.id_categoria), item.categoria.nombre || "Sin categoría");
        }
    });

    const options = ['<option value="">Todas</option>'];

    Array.from(categorias.entries())
        .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "es"))
        .forEach(([id, nombre]) => {
            options.push(`<option value="${escapeHtml(id)}">${escapeHtml(nombre)}</option>`);
        });

    filtroCategoria.innerHTML = options.join("");
}

function getProductoMapById() {
    const map = new Map();
    productos.forEach((item) => {
        map.set(Number(item.id_producto), item);
    });
    return map;
}

function normalizarEntradas(raw) {
    const grouped = new Map();

    raw.forEach((item) => {
        const idCompra = Number(item?.id_compra || 0);
        if (!idCompra) return;

        if (!grouped.has(idCompra)) {
            grouped.set(idCompra, {
                id_compra: idCompra,
                fecha: item?.fecha || null,
                total: Number(item?.total || 0),
            });
        }
    });

    return Array.from(grouped.values());
}

function filtrarVentas() {
    const productoMap = getProductoMapById();

    const desde = filtroDesde.value ? new Date(`${filtroDesde.value}T00:00:00`) : null;
    const hasta = filtroHasta.value ? new Date(`${filtroHasta.value}T23:59:59`) : null;
    const mes = Number(filtroMes.value || 0);
    const categoria = filtroCategoria.value;

    return ventasRaw.filter((item) => {
        const fecha = parseDateValue(item?.fecha);
        if (!fecha) return false;

        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
        if (mes && (fecha.getMonth() + 1) !== mes) return false;

        if (categoria) {
            const producto = productoMap.get(Number(item?.id_producto || 0));
            if (!producto || String(producto?.id_categoria || "") !== categoria) {
                return false;
            }
        }

        return true;
    });
}

function filtrarEntradas(entradas) {
    const desde = filtroDesde.value ? new Date(`${filtroDesde.value}T00:00:00`) : null;
    const hasta = filtroHasta.value ? new Date(`${filtroHasta.value}T23:59:59`) : null;
    const mes = Number(filtroMes.value || 0);

    return entradas.filter((item) => {
        const fecha = parseDateValue(item?.fecha);
        if (!fecha) return false;

        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
        if (mes && (fecha.getMonth() + 1) !== mes) return false;

        return true;
    });
}

function calcularResumen(ventasFiltradas, entradasFiltradas) {
    const ventasById = new Map();
    const subtotalByVenta = new Map();
    const productoCount = new Map();

    ventasFiltradas.forEach((item) => {
        const idVenta = Number(item?.id_venta || 0);
        if (!idVenta) return;

        if (!ventasById.has(idVenta)) {
            ventasById.set(idVenta, {
                id_venta: idVenta,
                fecha: item?.fecha || null,
                metodo_pago: item?.metodo_pago || "-",
            });
        }

        const subtotalItem = Number(item?.subtotal || (Number(item?.cantidad || 0) * Number(item?.precio_unitario || 0)) || 0);
        subtotalByVenta.set(idVenta, Number(subtotalByVenta.get(idVenta) || 0) + subtotalItem);

        const nombreProducto = String(item?.producto || "Producto");
        productoCount.set(nombreProducto, Number(productoCount.get(nombreProducto) || 0) + Number(item?.cantidad || 0));
    });

    let ingresos = 0;
    subtotalByVenta.forEach((subtotal) => {
        ingresos += subtotal * 1.16;
    });

    let productoDestacado = "-";
    let productoDestacadoCantidad = 0;
    Array.from(productoCount.entries()).forEach(([nombre, cantidad]) => {
        if (cantidad > productoDestacadoCantidad) {
            productoDestacado = nombre;
            productoDestacadoCantidad = cantidad;
        }
    });

    const stockBajo = productos.filter((item) => Number(item?.stock || 0) < 5).length;

    const porDia = new Map();
    ventasFiltradas.forEach((item) => {
        const fechaKey = formatDate(item?.fecha);
        const idVenta = Number(item?.id_venta || 0);
        if (fechaKey === "-" || !idVenta) return;

        if (!porDia.has(fechaKey)) {
            porDia.set(fechaKey, {
                fecha: fechaKey,
                ventaIds: new Set(),
                totalDia: 0,
                metodos: new Map(),
            });
        }

        const registro = porDia.get(fechaKey);
        const subtotalItem = Number(item?.subtotal || (Number(item?.cantidad || 0) * Number(item?.precio_unitario || 0)) || 0);
        registro.totalDia += subtotalItem;

        if (!registro.ventaIds.has(idVenta)) {
            registro.ventaIds.add(idVenta);
            const metodo = String(item?.metodo_pago || "-");
            registro.metodos.set(metodo, Number(registro.metodos.get(metodo) || 0) + 1);
        }
    });

    const resumenDiario = Array.from(porDia.values())
        .map((item) => {
            let metodoPredominante = "-";
            let maxMetodo = 0;

            item.metodos.forEach((count, metodo) => {
                if (count > maxMetodo) {
                    maxMetodo = count;
                    metodoPredominante = metodo;
                }
            });

            return {
                fecha: item.fecha,
                numeroVentas: item.ventaIds.size,
                totalDia: item.totalDia * 1.16,
                metodoPredominante,
            };
        })
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

    const promedioDiario = resumenDiario.length ? ingresos / resumenDiario.length : 0;

    const entradasTotal = entradasFiltradas.reduce((sum, item) => sum + Number(item?.total || 0), 0);
    const gananciaNeta = ingresos - entradasTotal;

    return {
        totalVentas: ventasById.size,
        ingresos,
        productoDestacado,
        productoDestacadoCantidad,
        stockBajo,
        promedioDiario,
        gananciaNeta,
        resumenDiario,
        entradasTotal,
    };
}

function renderKpis(resumen) {
    kpiTotalVentas.textContent = String(resumen.totalVentas || 0);
    kpiIngresosTotales.textContent = money(resumen.ingresos);
    kpiProductoDestacado.textContent = resumen.productoDestacado || "-";
    kpiProductoDestacadoMeta.textContent = `${Number(resumen.productoDestacadoCantidad || 0)} unidades vendidas`;
    kpiStockBajo.textContent = String(resumen.stockBajo || 0);
    kpiPromedioDiario.textContent = money(resumen.promedioDiario);
    kpiGananciaNeta.textContent = money(resumen.gananciaNeta);
}

function renderTabla(resumenDiario) {
    ultimoResumenDiario = resumenDiario;

    if (!resumenDiario.length) {
        tablaReportesBody.innerHTML = "";
        setEstadoTabla("No hay datos para el rango seleccionado.");
        return;
    }

    hideEstadoTabla();

    const totalVentas = resumenDiario.reduce((sum, item) => sum + Number(item.numeroVentas || 0), 0);
    const totalIngresos = resumenDiario.reduce((sum, item) => sum + Number(item.totalDia || 0), 0);
    ultimoResumenTotales = { ventas: totalVentas, ingresos: totalIngresos };

    const rows = resumenDiario.map((item) => {
        return `
            <tr>
                <td>${escapeHtml(item.fecha)}</td>
                <td><span class="badge-num">${escapeHtml(item.numeroVentas)}</span></td>
                <td class="dinero">${escapeHtml(money(item.totalDia))}</td>
                <td><span class="badge-pago">${escapeHtml(item.metodoPredominante || "-")}</span></td>
            </tr>
        `;
    });

    rows.push(`
        <tr class="fila-total-final">
            <td class="label-total">TOTAL</td>
            <td><span class="badge-total">${escapeHtml(totalVentas)}</span></td>
            <td class="total-dinero">${escapeHtml(money(totalIngresos))}</td>
            <td></td>
        </tr>
    `);

    tablaReportesBody.innerHTML = rows.join("");
}

function destroyChart(chartRef) {
    if (chartRef && typeof chartRef.destroy === "function") {
        chartRef.destroy();
    }
}

function agruparMensual(ventasFiltradas, entradasFiltradas) {
    const ventasMes = new Map();
    const entradasMes = new Map();

    ventasFiltradas.forEach((item) => {
        const fecha = parseDateValue(item?.fecha);
        if (!fecha) return;

        const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
        const subtotal = Number(item?.subtotal || (Number(item?.cantidad || 0) * Number(item?.precio_unitario || 0)) || 0);
        ventasMes.set(mes, Number(ventasMes.get(mes) || 0) + (subtotal * 1.16));
    });

    entradasFiltradas.forEach((item) => {
        const fecha = parseDateValue(item?.fecha);
        if (!fecha) return;

        const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
        entradasMes.set(mes, Number(entradasMes.get(mes) || 0) + Number(item?.total || 0));
    });

    const allMeses = Array.from(new Set([...ventasMes.keys(), ...entradasMes.keys()])).sort();

    return {
        labels: allMeses,
        ventas: allMeses.map((mes) => Number(ventasMes.get(mes) || 0)),
        entradas: allMeses.map((mes) => Number(entradasMes.get(mes) || 0)),
    };
}

function renderCharts(ventasFiltradas, entradasFiltradas) {
    const topProductosMap = new Map();
    const categoriasMap = new Map();

    const productoById = getProductoMapById();

    ventasFiltradas.forEach((item) => {
        const nombre = String(item?.producto || "Producto");
        topProductosMap.set(nombre, Number(topProductosMap.get(nombre) || 0) + Number(item?.cantidad || 0));

        const idProducto = Number(item?.id_producto || 0);
        const producto = productoById.get(idProducto);
        const categoria = producto?.categoria?.nombre || "Sin categoría";
        categoriasMap.set(categoria, Number(categoriasMap.get(categoria) || 0) + Number(item?.cantidad || 0));
    });

    const topProductos = Array.from(topProductosMap.entries())
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 6);

    const categorias = Array.from(categoriasMap.entries())
        .sort((a, b) => Number(b[1]) - Number(a[1]));

    const mensual = agruparMensual(ventasFiltradas, entradasFiltradas);

    destroyChart(ventasChart);
    destroyChart(categoriaChart);
    destroyChart(tendenciaChart);
    destroyChart(ventasEntradasChart);

    const ventasCtx = document.getElementById("ventasChart");
    const categoriaCtx = document.getElementById("categoriaChart");
    const tendenciaCtx = document.getElementById("tendenciaVentas");
    const ventasEntradasCtx = document.getElementById("ventasEntradas");

    ventasChart = new Chart(ventasCtx, {
        type: "bar",
        data: {
            labels: topProductos.length ? topProductos.map(([nombre]) => nombre) : ["Sin datos"],
            datasets: [{
                data: topProductos.length ? topProductos.map(([, cantidad]) => cantidad) : [0],
                backgroundColor: "#4f7dd6",
                borderRadius: 8,
            }],
        },
        options: {
            animation: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } },
        },
    });

    categoriaChart = new Chart(categoriaCtx, {
        type: "pie",
        data: {
            labels: categorias.length ? categorias.map(([nombre]) => nombre) : ["Sin datos"],
            datasets: [{
                data: categorias.length ? categorias.map(([, cantidad]) => cantidad) : [0],
                backgroundColor: ["#4f7dd6", "#3aa675", "#e39d3a", "#7a5de8", "#e04c3f", "#0ea5e9"],
            }],
        },
        options: {
            animation: false,
            plugins: { legend: { position: "bottom" } },
        },
    });

    tendenciaChart = new Chart(tendenciaCtx, {
        type: "line",
        data: {
            labels: mensual.labels.length ? mensual.labels : ["Sin datos"],
            datasets: [{
                label: "Ventas",
                data: mensual.labels.length ? mensual.ventas : [0],
                borderColor: "#4aa874",
                backgroundColor: "rgba(74,168,116,0.2)",
                tension: 0.35,
                pointRadius: 4,
                fill: true,
            }],
        },
        options: {
            animation: false,
            scales: { y: { beginAtZero: true } },
        },
    });

    ventasEntradasChart = new Chart(ventasEntradasCtx, {
        type: "bar",
        data: {
            labels: mensual.labels.length ? mensual.labels : ["Sin datos"],
            datasets: [
                {
                    label: "Ventas",
                    data: mensual.labels.length ? mensual.ventas : [0],
                    backgroundColor: "#4aa874",
                },
                {
                    label: "Entradas",
                    data: mensual.labels.length ? mensual.entradas : [0],
                    backgroundColor: "#d94b45",
                },
            ],
        },
        options: {
            animation: false,
            scales: { y: { beginAtZero: true } },
        },
    });
}

async function exportarReporteCompletoPdf() {
    const reporteNodo = document.getElementById("reportePdf");

    if (!reporteNodo) {
        alert("No se encontro el bloque del reporte para exportar.");
        return;
    }

    if (!window.html2canvas) {
        alert("No se pudo inicializar html2canvas para la captura.");
        return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("No se pudo inicializar el generador de PDF.");
        return;
    }

    const canvas = await window.html2canvas(reporteNodo, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const margin = 8;
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const renderWidth = pdfWidth - (margin * 2);
    const renderHeight = (canvas.height * renderWidth) / canvas.width;
    const pageContentHeight = pdfHeight - (margin * 2);

    let heightLeft = renderHeight;
    let y = margin;

    pdf.addImage(imgData, "PNG", margin, y, renderWidth, renderHeight, undefined, "FAST");
    heightLeft -= pageContentHeight;

    while (heightLeft > 0) {
        pdf.addPage();
        y = margin - (renderHeight - heightLeft);
        pdf.addImage(imgData, "PNG", margin, y, renderWidth, renderHeight, undefined, "FAST");
        heightLeft -= pageContentHeight;
    }

    const fechaActual = new Date();
    const nombre = `reporte_captura_${fechaActual.getFullYear()}${String(fechaActual.getMonth() + 1).padStart(2, "0")}${String(fechaActual.getDate()).padStart(2, "0")}_${String(fechaActual.getHours()).padStart(2, "0")}${String(fechaActual.getMinutes()).padStart(2, "0")}.pdf`;
    pdf.save(nombre);
}

function setupEventos() {
    btnGenerar?.addEventListener("click", async (event) => {
        event.preventDefault();

        btnGenerar.disabled = true;
        const textoOriginal = btnGenerar.textContent;
        btnGenerar.textContent = "Generando PDF...";

        try {
            renderReporte();
            await exportarReporteCompletoPdf();
        } finally {
            btnGenerar.disabled = false;
            btnGenerar.textContent = textoOriginal;
        }
    });

    filtroDesde?.addEventListener("change", renderReporte);
    filtroHasta?.addEventListener("change", renderReporte);
    filtroMes?.addEventListener("change", renderReporte);
    filtroCategoria?.addEventListener("change", renderReporte);
}

function renderReporte() {
    const entradasNormalizadas = normalizarEntradas(entradasRaw);
    const ventasFiltradas = filtrarVentas();
    const entradasFiltradas = filtrarEntradas(entradasNormalizadas);

    const resumen = calcularResumen(ventasFiltradas, entradasFiltradas);

    renderKpis(resumen);
    renderTabla(resumen.resumenDiario);
    renderCharts(ventasFiltradas, entradasFiltradas);

    return {
        ventasFiltradas,
        entradasFiltradas,
        resumen,
    };
}

async function cargarUsuario() {
    try {
        const user = await requestJson("/me");
        topbarUsuarioNombre.textContent = user?.nombre || "Usuario";
        topbarUsuarioRol.textContent = "Administrador";
    } catch {
        topbarUsuarioNombre.textContent = "Sin sesión";
    }
}

async function init() {
    setEstadoTabla("Cargando reporte...");

    try {
        await cargarUsuario();

        const [productosRes, ventasRes, entradasRes] = await Promise.all([
            requestJson("/productos"),
            requestJson("/ventas"),
            requestJson("/entradas"),
        ]);

        productos = Array.isArray(productosRes) ? productosRes : [];
        ventasRaw = Array.isArray(ventasRes) ? ventasRes : [];
        entradasRaw = Array.isArray(entradasRes) ? entradasRes : [];

        cargarCategoriasFiltro();
        renderReporte();
    } catch (error) {
        console.error(error);
        setEstadoTabla("No se pudo cargar la informacion del reporte.");
    }
}

setupEventos();
void init();
