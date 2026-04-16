const API_BASE = "http://127.0.0.1:8000/api";

const token = localStorage.getItem("token");

const btnNuevoUsuario = document.getElementById("btnNuevoUsuario");
const modalUsuario = document.getElementById("modalUsuario");
const cerrarUsuario = document.getElementById("cerrarUsuario");
const cancelarUsuario = document.getElementById("cancelarUsuario");
const formUsuario = document.getElementById("formUsuario");
const tbody = document.querySelector(".tabla-usuarios tbody");
const estadoTabla = document.getElementById("estadoTabla");
const mensajeFormulario = document.getElementById("mensajeFormulario");
const idUsuarioInput = document.getElementById("idUsuario");
const nombreInput = document.getElementById("nombre");
const correoInput = document.getElementById("correo");
const contrasenaInput = document.getElementById("contrasena");
const idRolInput = document.getElementById("idRol");
const btnGuardarUsuario = document.getElementById("btnGuardarUsuario");
const modalTitulo = document.querySelector(".modal-header h3");
const usuarioSesionNombre = document.getElementById("usuarioSesionNombre");
const usuarioSesionCorreo = document.getElementById("usuarioSesionCorreo");
const topbarUsuarioNombre = document.getElementById("topbarUsuarioNombre");
const topbarUsuarioRol = document.getElementById("topbarUsuarioRol");
const btnCerrarSesionUsuario = document.getElementById("btnCerrarSesionUsuario");

let usuarios = [];

if (!token) {
    window.location.href = "login.html";
}

function getHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
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

function abrirModal() {
    modalUsuario.style.display = "flex";
}

function cerrarModal() {
    modalUsuario.style.display = "none";
    limpiarFormulario();
}

function limpiarFormulario() {
    formUsuario.reset();
    idUsuarioInput.value = "";
    mensajeFormulario.textContent = "";
    modalTitulo.textContent = "Nuevo Usuario";
    contrasenaInput.required = true;
    btnGuardarUsuario.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Usuario';
}

function marcarCargandoTabla(mensaje) {
    tbody.innerHTML = `<tr><td colspan="4" id="estadoTabla">${escapeHtml(mensaje)}</td></tr>`;
}

function renderUsuarios() {
    if (!usuarios.length) {
        marcarCargandoTabla("No hay usuarios registrados.");
        return;
    }

    tbody.innerHTML = usuarios.map((usuario) => {
        const nombreRol = usuario.rol && usuario.rol.nombre ? usuario.rol.nombre : `Rol #${usuario.id_rol}`;
        const claseRol = nombreRol.toLowerCase().includes("admin") ? "rol admin" : "rol";

        return `
            <tr>
                <td>${escapeHtml(usuario.nombre)}</td>
                <td>${escapeHtml(usuario.correo)}</td>
                <td><span class="${claseRol}">${escapeHtml(nombreRol)}</span></td>
                <td class="acciones">
                    <i class="fa-solid fa-pen editar" title="Editar" data-id="${usuario.id_usuario}"></i>
                    <i class="fa-solid fa-trash eliminar" title="Eliminar" data-id="${usuario.id_usuario}"></i>
                </td>
            </tr>
        `;
    }).join("");
}

async function cargarUsuarioSesion() {
    try {
        const response = await fetch(`${API_BASE}/me`, {
            method: "GET",
            headers: getHeaders()
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
        usuarioSesionNombre.textContent = usuario.nombre || "Usuario";
        usuarioSesionCorreo.textContent = usuario.correo || "-";
        topbarUsuarioNombre.textContent = usuario.nombre || "Usuario";
        topbarUsuarioRol.textContent = "Administrador";
    } catch (error) {
        console.error(error);
        usuarioSesionNombre.textContent = "Sin sesión";
        usuarioSesionCorreo.textContent = "Error al cargar";
        topbarUsuarioNombre.textContent = "Sin sesión";
        topbarUsuarioRol.textContent = "Administrador";
    }
}

async function cargarUsuarios() {
    marcarCargandoTabla("Cargando usuarios...");

    try {
        const response = await fetch(`${API_BASE}/usuarios`, {
            method: "GET",
            headers: getHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "login.html";
                return;
            }

            throw new Error("No se pudieron cargar los usuarios");
        }

        usuarios = await response.json();
        renderUsuarios();
    } catch (error) {
        console.error(error);
        marcarCargandoTabla("Error al cargar usuarios. Verifica que el backend esté en ejecución.");
    }
}

async function cerrarSesion() {
    try {
        await fetch(`${API_BASE}/logout`, {
            method: "POST",
            headers: getHeaders(),
        });
    } catch (error) {
        console.error(error);
    } finally {
        localStorage.removeItem("token");
        window.location.href = "login.html";
    }
}

function abrirModalNuevo() {
    limpiarFormulario();
    modalTitulo.textContent = "Nuevo Usuario";
    contrasenaInput.required = true;
    abrirModal();
}

function abrirModalEditar(idUsuario) {
    const usuario = usuarios.find((item) => Number(item.id_usuario) === Number(idUsuario));

    if (!usuario) {
        alert("No se encontró el usuario seleccionado.");
        return;
    }

    limpiarFormulario();
    idUsuarioInput.value = String(usuario.id_usuario);
    nombreInput.value = usuario.nombre || "";
    correoInput.value = usuario.correo || "";
    idRolInput.value = String(usuario.id_rol || 1);
    contrasenaInput.required = false;
    modalTitulo.textContent = "Editar Usuario";
    btnGuardarUsuario.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';
    abrirModal();
}

async function crearUsuario(payload) {
    const response = await fetch(`${API_BASE}/usuarios`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
        throw data;
    }
}

async function actualizarUsuario(idUsuario, payload) {
    const response = await fetch(`${API_BASE}/usuarios/${idUsuario}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
        throw data;
    }
}

async function eliminarUsuario(idUsuario) {
    const confirmar = confirm("¿Seguro que deseas eliminar este usuario?");

    if (!confirmar) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/usuarios/${idUsuario}`, {
            method: "DELETE",
            headers: getHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "No se pudo eliminar el usuario");
        }

        await cargarUsuarios();
    } catch (error) {
        console.error(error);
        alert(error.message || "Error al eliminar usuario");
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
    return "No se pudo guardar el usuario.";
}

formUsuario.addEventListener("submit", async (event) => {
    event.preventDefault();

    const idUsuario = idUsuarioInput.value.trim();
    const payload = {
        nombre: nombreInput.value.trim(),
        correo: correoInput.value.trim()
    };

    const idRol = Number(idRolInput.value);
    if (Number.isFinite(idRol) && idRol > 0) {
        payload.id_rol = idRol;
    }

    const contrasena = contrasenaInput.value;

    if (!payload.nombre || !payload.correo) {
        mensajeFormulario.textContent = "Nombre y correo son obligatorios.";
        return;
    }

    if (!idUsuario && !contrasena) {
        mensajeFormulario.textContent = "La contraseña es obligatoria para crear un usuario.";
        return;
    }

    if (contrasena) {
        if (contrasena.length < 6) {
            mensajeFormulario.textContent = "La contraseña debe tener al menos 6 caracteres.";
            return;
        }

        payload.contrasena = contrasena;
    }

    mensajeFormulario.textContent = "";
    btnGuardarUsuario.disabled = true;

    try {
        if (idUsuario) {
            await actualizarUsuario(idUsuario, payload);
        } else {
            await crearUsuario(payload);
        }

        cerrarModal();
        await cargarUsuarios();
    } catch (errorData) {
        console.error(errorData);
        mensajeFormulario.textContent = obtenerErrorValidacion(errorData);
    } finally {
        btnGuardarUsuario.disabled = false;
    }
});

tbody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.classList.contains("editar")) {
        abrirModalEditar(target.dataset.id);
        return;
    }

    if (target.classList.contains("eliminar")) {
        eliminarUsuario(target.dataset.id);
    }
});

btnNuevoUsuario.addEventListener("click", abrirModalNuevo);
cerrarUsuario.addEventListener("click", cerrarModal);
cancelarUsuario.addEventListener("click", cerrarModal);

btnCerrarSesionUsuario?.addEventListener("click", () => {
    const confirmar = confirm("¿Deseas cerrar sesión?");
    if (!confirmar) return;
    void cerrarSesion();
});

window.addEventListener("click", (event) => {
    if (event.target === modalUsuario) {
        cerrarModal();
    }
});

(async function init() {
    await cargarUsuarioSesion();
    await cargarUsuarios();
})();
