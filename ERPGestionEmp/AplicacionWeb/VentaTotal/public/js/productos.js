const API_BASE = "http://127.0.0.1:8000/api";
const token = localStorage.getItem("token");
const API_ORIGIN = new URL(API_BASE).origin;

const btnNuevoProducto = document.getElementById("btnNuevoProducto");
const modalProducto = document.getElementById("modalProducto");
const cerrarModal = document.getElementById("cerrarModal");
const cancelarProducto = document.getElementById("cancelarProducto");
const formProducto = document.getElementById("formProducto");
const tbody = document.querySelector(".tabla tbody");
const estadoTabla = document.getElementById("estadoTabla");
const buscarProducto = document.getElementById("buscarProducto");
const filtroCategoria = document.getElementById("filtroCategoria");
const totalProductos = document.getElementById("totalProductos");
const stockBajo = document.getElementById("stockBajo");
const cardTotalProductos = document.getElementById("cardTotalProductos");
const cardStockBajo = document.getElementById("cardStockBajo");
const topbarUsuarioNombre = document.getElementById("topbarUsuarioNombre");
const topbarUsuarioRol = document.getElementById("topbarUsuarioRol");

const idProductoInput = document.getElementById("idProducto");
const nombreProductoInput = document.getElementById("nombreProducto");
const descripcionProductoInput = document.getElementById("descripcionProducto");
const imagenProductoInput = document.getElementById("imagenProducto");
const previewImagenProducto = document.getElementById("previewImagenProducto");
const categoriaProductoInput = document.getElementById("categoriaProducto");
const precioProductoInput = document.getElementById("precioProducto");
const stockProductoInput = document.getElementById("stockProducto");
const mensajeProducto = document.getElementById("mensajeProducto");
const btnGuardarProducto = document.getElementById("btnGuardarProducto");
const modalTitulo = document.querySelector("#modalProducto .modal-header h3");

const btnCategoria = document.getElementById("btnCategoria");
const modalCategoria = document.getElementById("modalCategoria");
const cerrarCategoria = document.getElementById("cerrarCategoria");
const cancelarCategoria = document.getElementById("cancelarCategoria");
const formCategoria = document.getElementById("formCategoria");
const nombreCategoriaInput = document.getElementById("nombreCategoria");
const descripcionCategoriaInput = document.getElementById("descripcionCategoria");
const mensajeCategoria = document.getElementById("mensajeCategoria");
const listaCategoriasGestion = document.getElementById("listaCategoriasGestion");
const btnGuardarCategoria = document.getElementById("btnGuardarCategoria");


let productos = [];
let categorias = [];
let soloStockBajo = false;
let categoriaEditandoId = null;

if (!token) {
    window.location.href = "login.html";
}

function getHeaders() {
    return {
        "Authorization": `Bearer ${token}`,
    };
}

function getJsonHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
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

function marcarCargandoTabla(mensaje) {
    tbody.innerHTML = `<tr><td colspan="8" id="estadoTabla">${escapeHtml(mensaje)}</td></tr>`;
}

function actualizarPreviewImagen(url) {
    if (!previewImagenProducto) return;

    if (!url) {
        previewImagenProducto.style.display = "none";
        previewImagenProducto.removeAttribute("src");
        return;
    }

    previewImagenProducto.src = url;
    previewImagenProducto.style.display = "block";
}

function resolverUrlImagen(producto) {
    if (producto.imagen) {
        const limpia = String(producto.imagen).replace(/^\/+/, "");
        return `${API_ORIGIN}/storage/${limpia}`;
    }

    if (producto.imagen_url) {
        if (producto.imagen_url.startsWith("http://") || producto.imagen_url.startsWith("https://")) {
            const marcadorStorage = "/storage/";
            const indiceStorage = producto.imagen_url.indexOf(marcadorStorage);

            if (indiceStorage !== -1) {
                const rutaStorage = producto.imagen_url.substring(indiceStorage);
                return `${API_ORIGIN}${rutaStorage}`;
            }

            return producto.imagen_url;
        }

        return `${API_ORIGIN}${producto.imagen_url.startsWith("/") ? "" : "/"}${producto.imagen_url}`;
    }

    return null;
}

function abrirModalProducto() {
    modalProducto.style.display = "flex";
}

function cerrarModalProducto() {
    modalProducto.style.display = "none";
    limpiarFormulario();
}

function abrirModalCategoria() {
    modalCategoria.style.display = "flex";
}

function cerrarModalCategoria() {
    modalCategoria.style.display = "none";
    categoriaEditandoId = null;

    if (formCategoria) {
        formCategoria.reset();
    }

    if (mensajeCategoria) {
        mensajeCategoria.textContent = "";
    }

    if (btnGuardarCategoria) {
        btnGuardarCategoria.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Categoría';
    }
}

function activarEdicionCategoria(categoria) {
    if (!categoria) return;

    categoriaEditandoId = Number(categoria.id_categoria);
    nombreCategoriaInput.value = categoria.nombre || "";
    descripcionCategoriaInput.value = categoria.descripcion || "";
    mensajeCategoria.textContent = `Editando categoría: ${categoria.nombre || ""}`;

    if (btnGuardarCategoria) {
        btnGuardarCategoria.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar cambios';
    }

    nombreCategoriaInput.focus();
}

function limpiarFormulario() {
    formProducto.reset();
    idProductoInput.value = "";
    mensajeProducto.textContent = "";
    modalTitulo.textContent = "Nuevo Producto";
    btnGuardarProducto.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Producto';
    categoriaProductoInput.value = "";
    if (imagenProductoInput) {
        imagenProductoInput.value = "";
    }

    actualizarPreviewImagen(null);
}

function actualizarEstadisticas(lista) {
    totalProductos.textContent = String(lista.length);
    const conteoStockBajo = lista.filter((item) => Number(item.stock) < 5).length;
    stockBajo.textContent = String(conteoStockBajo);
}

function renderEstadoFiltroRapido() {
    if (cardStockBajo) {
        cardStockBajo.classList.toggle("active-filter", soloStockBajo);
    }

    if (cardTotalProductos) {
        cardTotalProductos.classList.toggle("active-filter", !soloStockBajo);
    }
}

function getEstadoClass(nombreEstado) {
    const nombre = (nombreEstado || "").toLowerCase();

    if (nombre.includes("activo")) return "estado activo";
    if (nombre.includes("agotado")) return "estado agotado";
    return "estado";
}

function getStockClass(stock) {
    if (stock < 5) return "stock stock-rojo";
    if (stock >= 10 && stock <= 30) return "stock stock-amarillo";
    if (stock > 30) return "stock stock-verde";
    return "stock stock-intermedio";
}

function renderProductos() {
    const texto = buscarProducto.value.trim().toLowerCase();
    const categoriaSeleccionada = filtroCategoria.value;

    const filtrados = productos.filter((producto) => {
        const coincideStockBajo = !soloStockBajo || Number(producto.stock || 0) < 5;

        const coincideTexto = !texto
            || String(producto.nombre || "").toLowerCase().includes(texto)
            || String(producto.codigo || "").toLowerCase().includes(texto);

        const coincideCategoria = !categoriaSeleccionada
            || String(producto.id_categoria || "") === categoriaSeleccionada;

        return coincideStockBajo && coincideTexto && coincideCategoria;
    });

    actualizarEstadisticas(productos);
    renderEstadoFiltroRapido();

    if (!filtrados.length) {
        marcarCargandoTabla("No hay productos para mostrar con esos filtros.");
        return;
    }

    tbody.innerHTML = filtrados.map((producto) => {
        const categoria = producto.categoria && producto.categoria.nombre
            ? producto.categoria.nombre
            : "Sin categoría";

        const estado = Number(producto.stock || 0) <= 0 ? "Agotado" : "Activo";

        const precio = Number(producto.precio || 0).toFixed(2);
        const stock = Number(producto.stock || 0);
        const stockClass = getStockClass(stock);
        const imagenUrl = resolverUrlImagen(producto);
        const imagen = imagenUrl
            ? `<img class="img-mini" src="${escapeHtml(imagenUrl)}" alt="${escapeHtml(producto.nombre)}">`
            : '<span class="sin-imagen">Sin imagen</span>';

        return `
            <tr>
                <td>${imagen}</td>
                <td>${escapeHtml(producto.codigo)}</td>
                <td>${escapeHtml(producto.nombre)}</td>
                <td><span class="categoria">${escapeHtml(categoria)}</span></td>
                <td>$${escapeHtml(precio)}</td>
                <td><span class="${stockClass}">${escapeHtml(stock)}</span></td>
                <td><span class="${getEstadoClass(estado)}">${escapeHtml(estado)}</span></td>
                <td class="acciones">
                    <i class="fa-solid fa-pen editar" title="Editar" data-action="editar" data-id="${producto.id_producto}"></i>
                    <i class="fa-solid fa-trash eliminar" title="Eliminar" data-action="eliminar" data-id="${producto.id_producto}"></i>
                </td>
            </tr>
        `;
    }).join("");
}

function llenarSelect(selectElement, items, placeholder) {
    const opciones = [`<option value="">${escapeHtml(placeholder)}</option>`];

    items.forEach((item) => {
        const id = item.id_categoria;
        opciones.push(`<option value="${id}">${escapeHtml(item.nombre)}</option>`);
    });

    selectElement.innerHTML = opciones.join("");
}

function renderCatalogos() {
    llenarSelect(filtroCategoria, categorias, "Todas las Categorías");
    llenarSelect(categoriaProductoInput, categorias, "Selecciona una categoría");
    renderCategoriasGestion();
}

function renderCategoriasGestion() {
    if (!listaCategoriasGestion) return;

    if (!Array.isArray(categorias) || !categorias.length) {
        listaCategoriasGestion.innerHTML = '<p class="categorias-vacio">No hay categorías registradas.</p>';
        return;
    }

    listaCategoriasGestion.innerHTML = categorias.map((item) => {
        const descripcion = item.descripcion ? String(item.descripcion) : "Sin descripción";

        return `
            <div class="categoria-item">
                <div class="categoria-info">
                    <span class="categoria-titulo">${escapeHtml(item.nombre || "Sin nombre")}</span>
                    <span class="categoria-desc">${escapeHtml(descripcion)}</span>
                </div>
                <div class="categoria-acciones">
                    <button type="button" class="btn-editar-categoria" data-id="${item.id_categoria}">Editar</button>
                    <button type="button" class="btn-eliminar-categoria" data-id="${item.id_categoria}" data-nombre="${escapeHtml(item.nombre || "categoria")}">Eliminar</button>
                </div>
            </div>
        `;
    }).join("");
}

async function cargarUsuarioSesion() {
    try {
        const response = await fetch(`${API_BASE}/me`, {
            method: "GET",
            headers: getJsonHeaders(),
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "login.html";
                return;
            }

            throw new Error("No se pudo obtener la sesión");
        }

        const usuario = await response.json();
        topbarUsuarioNombre.textContent = usuario.nombre || "Usuario";
        topbarUsuarioRol.textContent = "Administrador";
    } catch (error) {
        console.error(error);
        topbarUsuarioNombre.textContent = "Sin sesión";
        topbarUsuarioRol.textContent = "Administrador";
    }
}

async function cargarCatalogos() {
    const categoriasResponse = await fetch(`${API_BASE}/categorias`, { method: "GET", headers: getHeaders() });

    if (!categoriasResponse.ok) {
        if (categoriasResponse.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "login.html";
            return;
        }

        throw new Error("No se pudieron cargar categorías");
    }

    categorias = await categoriasResponse.json();
    renderCatalogos();
}

async function crearCategoria(payload) {
    const response = await fetch(`${API_BASE}/categorias`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
        throw data;
    }

    return data;
}

async function actualizarCategoria(idCategoria, payload) {
    const response = await fetch(`${API_BASE}/categorias/${idCategoria}`, {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
        throw data;
    }

    return data;
}

async function eliminarCategoria(idCategoria) {
    const response = await fetch(`${API_BASE}/categorias/${idCategoria}`, {
        method: "DELETE",
        headers: getJsonHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
        throw data;
    }

    return data;
}

async function cargarProductos() {
    marcarCargandoTabla("Cargando productos...");

    try {
        const response = await fetch(`${API_BASE}/productos`, {
            method: "GET",
            headers: getJsonHeaders(),
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "login.html";
                return;
            }

            throw new Error("No se pudieron cargar los productos");
        }

        productos = await response.json();
        renderProductos();
    } catch (error) {
        console.error(error);
        marcarCargandoTabla("Error al cargar productos. Verifica que el backend esté en ejecución.");
    }
}

function abrirModalNuevo() {
    limpiarFormulario();
    abrirModalProducto();
}

function abrirModalEditar(idProducto) {
    const producto = productos.find((item) => Number(item.id_producto) === Number(idProducto));

    if (!producto) {
        alert("No se encontró el producto seleccionado.");
        return;
    }

    limpiarFormulario();
    idProductoInput.value = String(producto.id_producto);
    nombreProductoInput.value = producto.nombre || "";
    descripcionProductoInput.value = producto.descripcion || "";
    categoriaProductoInput.value = String(producto.id_categoria || "");
    precioProductoInput.value = String(producto.precio || 0);
    stockProductoInput.value = String(producto.stock || 0);
    actualizarPreviewImagen(resolverUrlImagen(producto));

    modalTitulo.textContent = "Editar Producto";
    btnGuardarProducto.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';
    abrirModalProducto();
}

function construirFormDataProducto(payload, esEdicion) {
    const formData = new FormData();

    formData.append("nombre", payload.nombre);
    formData.append("descripcion", payload.descripcion || "");
    formData.append("precio", String(payload.precio));
    formData.append("stock", String(payload.stock));
    formData.append("id_categoria", String(payload.id_categoria));

    if (esEdicion) {
        formData.append("_method", "PUT");
    }

    if (imagenProductoInput && imagenProductoInput.files && imagenProductoInput.files[0]) {
        formData.append("imagen", imagenProductoInput.files[0]);
    }

    return formData;
}

async function crearProducto(formData) {
    const response = await fetch(`${API_BASE}/productos`, {
        method: "POST",
        headers: getHeaders(),
        body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
        throw data;
    }
}

async function actualizarProducto(idProducto, formData) {
    const response = await fetch(`${API_BASE}/productos/${idProducto}`, {
        method: "POST",
        headers: getHeaders(),
        body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
        throw data;
    }
}

async function eliminarProducto(idProducto) {
    const confirmar = confirm("¿Seguro que deseas eliminar este producto?");

    if (!confirmar) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/productos/${idProducto}`, {
            method: "DELETE",
            headers: getJsonHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "No se pudo eliminar el producto");
        }

        await cargarProductos();
    } catch (error) {
        console.error(error);
        alert(error.message || "Error al eliminar producto");
    }
}

function obtenerErrorValidacion(errorData) {
    if (!errorData) return "Ocurrió un error inesperado.";

    if (errorData.errors) {
        const primeraClave = Object.keys(errorData.errors)[0];

        if (primeraClave && errorData.errors[primeraClave] && errorData.errors[primeraClave][0]) {
            return errorData.errors[primeraClave][0];
        }
    }

    if (errorData.message) return errorData.message;
    return "No se pudo guardar el producto.";
}

formProducto.addEventListener("submit", async (event) => {
    event.preventDefault();

    const idProducto = idProductoInput.value.trim();
    const payload = {
        nombre: nombreProductoInput.value.trim(),
        descripcion: descripcionProductoInput.value.trim(),
        precio: Number(precioProductoInput.value),
        stock: Number(stockProductoInput.value),
        id_categoria: categoriaProductoInput.value ? Number(categoriaProductoInput.value) : null,
    };

    if (!payload.nombre) {
        mensajeProducto.textContent = "El nombre es obligatorio.";
        return;
    }

    if (!Number.isFinite(payload.precio) || payload.precio < 0) {
        mensajeProducto.textContent = "Ingresa un precio válido.";
        return;
    }

    if (!Number.isInteger(payload.stock) || payload.stock < 0) {
        mensajeProducto.textContent = "Ingresa un stock válido.";
        return;
    }

    if (!payload.id_categoria) {
        mensajeProducto.textContent = "La categoría es obligatoria.";
        return;
    }

    if (imagenProductoInput && imagenProductoInput.files && imagenProductoInput.files[0]) {
        const archivo = imagenProductoInput.files[0];
        const tiposPermitidos = ["image/jpeg", "image/png", "image/webp"];
        const maxBytes = 2 * 1024 * 1024;

        if (!tiposPermitidos.includes(archivo.type)) {
            mensajeProducto.textContent = "La imagen debe ser JPG, PNG o WEBP.";
            return;
        }

        if (archivo.size > maxBytes) {
            mensajeProducto.textContent = "La imagen no puede superar 2MB.";
            return;
        }
    }

    mensajeProducto.textContent = "";

    try {
        if (idProducto) {
            const formData = construirFormDataProducto(payload, true);
            await actualizarProducto(idProducto, formData);
        } else {
            const formData = construirFormDataProducto(payload, false);
            await crearProducto(formData);
        }

        cerrarModalProducto();
        await cargarProductos();
    } catch (errorData) {
        console.error(errorData);
        mensajeProducto.textContent = obtenerErrorValidacion(errorData);
    }
});

tbody.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
        return;
    }

    const accion = target.getAttribute("data-action");
    const idProducto = target.getAttribute("data-id");

    if (!accion || !idProducto) {
        return;
    }

    if (accion === "editar") {
        abrirModalEditar(idProducto);
        return;
    }

    if (accion === "eliminar") {
        eliminarProducto(idProducto);
    }
});

buscarProducto.addEventListener("input", renderProductos);
filtroCategoria.addEventListener("change", renderProductos);

if (cardStockBajo) {
    cardStockBajo.addEventListener("click", () => {
        soloStockBajo = true;
        renderProductos();
    });
}

if (cardTotalProductos) {
    cardTotalProductos.addEventListener("click", () => {
        soloStockBajo = false;
        renderProductos();
    });
}

btnNuevoProducto.addEventListener("click", abrirModalNuevo);
cerrarModal.addEventListener("click", cerrarModalProducto);
cancelarProducto.addEventListener("click", cerrarModalProducto);

if (imagenProductoInput) {
    imagenProductoInput.addEventListener("change", () => {
        if (!imagenProductoInput.files || !imagenProductoInput.files[0]) {
            actualizarPreviewImagen(null);
            return;
        }

        const url = URL.createObjectURL(imagenProductoInput.files[0]);
        actualizarPreviewImagen(url);
    });
}

if (btnCategoria && modalCategoria && cerrarCategoria) {
    btnCategoria.addEventListener("click", abrirModalCategoria);
    cerrarCategoria.addEventListener("click", cerrarModalCategoria);
}

if (cancelarCategoria) {
    cancelarCategoria.addEventListener("click", cerrarModalCategoria);
}

if (formCategoria) {
    formCategoria.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = {
            nombre: nombreCategoriaInput.value.trim(),
            descripcion: descripcionCategoriaInput.value.trim(),
        };

        if (!payload.nombre) {
            mensajeCategoria.textContent = "El nombre de la categoría es obligatorio.";
            return;
        }

        try {
            const enEdicion = Boolean(categoriaEditandoId);

            if (categoriaEditandoId) {
                await actualizarCategoria(categoriaEditandoId, payload);
            } else {
                await crearCategoria(payload);
            }

            await cargarCatalogos();
            cerrarModalCategoria();
            alert(enEdicion ? "Categoría actualizada correctamente." : "Categoría agregada correctamente.");
        } catch (errorData) {
            console.error(errorData);
            mensajeCategoria.textContent = obtenerErrorValidacion(errorData);
        }
    });
}

if (listaCategoriasGestion) {
    listaCategoriasGestion.addEventListener("click", async (event) => {
        const editButton = event.target.closest("button.btn-editar-categoria[data-id]");

        if (editButton) {
            const idCategoria = Number(editButton.getAttribute("data-id"));
            const categoria = categorias.find((item) => Number(item.id_categoria) === idCategoria);

            if (!categoria) {
                alert("No se encontró la categoría seleccionada.");
                return;
            }

            activarEdicionCategoria(categoria);
            return;
        }

        const deleteButton = event.target.closest("button.btn-eliminar-categoria[data-id]");

        if (!deleteButton) {
            return;
        }

        const idCategoria = deleteButton.getAttribute("data-id");
        const nombreCategoria = deleteButton.getAttribute("data-nombre") || "esta categoría";

        const confirmar = confirm(`¿Seguro que deseas eliminar ${nombreCategoria}?`);

        if (!confirmar) {
            return;
        }

        try {
            const resultado = await eliminarCategoria(idCategoria);
            await cargarCatalogos();
            alert(resultado?.message || "Categoría eliminada correctamente.");
        } catch (errorData) {
            console.error(errorData);
            alert(obtenerErrorValidacion(errorData));
        }
    });
}

window.addEventListener("click", (event) => {
    if (event.target === modalProducto) {
        cerrarModalProducto();
    }

    if (event.target === modalCategoria) {
        cerrarModalCategoria();
    }
});

async function init() {
    await cargarUsuarioSesion();

    try {
        await cargarCatalogos();
    } catch (error) {
        console.error(error);
        categorias = [];
        renderCatalogos();
    }

    await cargarProductos();
}

init();
