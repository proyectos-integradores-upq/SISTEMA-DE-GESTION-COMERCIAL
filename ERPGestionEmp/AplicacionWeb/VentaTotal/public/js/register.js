// Mostrar/ocultar contraseñas
document.querySelectorAll(".toggle-password").forEach(button => {
    button.addEventListener("click", function(e) {
        e.preventDefault();
        const input = this.previousElementSibling;
        const icon = this.querySelector("i");

        if (input.type === "password") {
            input.type = "text";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        } else {
            input.type = "password";
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        }
    });
});

// Validación y envío del formulario
document.getElementById("registerForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const nombre = document.getElementById("nombre").value.trim();
    const apellido = document.getElementById("apellido").value.trim();
    const correo = document.getElementById("correo").value.trim();
    const contrasena = document.getElementById("contrasena").value;
    const confirmar_contrasena = document.getElementById("confirmar_contrasena").value;
    const terminos = document.getElementById("terminos").checked;

    // Validaciones
    if (!nombre || !apellido || !correo || !contrasena || !confirmar_contrasena) {
        mostrarError("Por favor completa todos los campos");
        return;
    }

    if (contrasena.length < 6) {
        mostrarError("La contraseña debe tener al menos 6 caracteres");
        return;
    }

    if (contrasena !== confirmar_contrasena) {
        mostrarError("Las contraseñas no coinciden");
        return;
    }

    if (!terminos) {
        mostrarError("Debes aceptar los términos y condiciones");
        return;
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) {
        mostrarError("Por favor ingresa un correo válido");
        return;
    }

    try {
        const boton = document.querySelector(".btn-register");
        boton.classList.add("loading");
        boton.disabled = true;

        const response = await fetch("http://127.0.0.1:8000/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nombre: nombre,
                apellido: apellido,
                correo: correo,
                contrasena: contrasena
            })
        });

        const data = await response.json();

        if (response.ok) {
            mostrarExito("¡Cuenta creada exitosamente! Redirigiendo...");
            setTimeout(() => {
                localStorage.setItem("token", data.token);
                window.location.href = "dashboard.html";
            }, 1500);
        } else {
            mostrarError(data.message || "Error al crear la cuenta");
            boton.classList.remove("loading");
            boton.disabled = false;
        }

    } catch (error) {
        console.error(error);
        mostrarError("Error de conexión con el servidor");
        const boton = document.querySelector(".btn-register");
        boton.classList.remove("loading");
        boton.disabled = false;
    }
});

function mostrarError(mensaje) {
    const formulario = document.querySelector(".register-form");
    
    // Eliminar mensajes anteriores
    const mensajeAnterior = document.querySelector(".error-message");
    if (mensajeAnterior) {
        mensajeAnterior.remove();
    }

    const div = document.createElement("div");
    div.className = "error-message";
    div.innerHTML = `<p>${mensaje}</p>`;
    formulario.parentElement.insertBefore(div, formulario);

    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
        div.remove();
    }, 5000);
}

function mostrarExito(mensaje) {
    const formulario = document.querySelector(".register-form");
    
    // Eliminar mensajes anteriores
    const mensajeAnterior = document.querySelector(".success-message");
    if (mensajeAnterior) {
        mensajeAnterior.remove();
    }

    const div = document.createElement("div");
    div.className = "success-message";
    div.innerHTML = `<p>${mensaje}</p>`;
    formulario.parentElement.insertBefore(div, formulario);
}
