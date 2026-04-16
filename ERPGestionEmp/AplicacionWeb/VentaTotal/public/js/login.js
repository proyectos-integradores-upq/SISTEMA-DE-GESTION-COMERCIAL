// Mostrar/ocultar contraseña
document.querySelectorAll(".toggle-password").forEach(button => {
    button.addEventListener("click", function(e) {
        e.preventDefault();
        const input = document.querySelector("#contrasena");
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


document.getElementById("loginForm").addEventListener("submit", async function(e){
    e.preventDefault();

    const correo = document.getElementById("correo").value;
    const contrasena = document.getElementById("contrasena").value;

    try {
        const response = await fetch("http://127.0.0.1:8000/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                correo: correo,
                contrasena: contrasena
            })
        });

        const data = await response.json();

        if(response.ok){
            localStorage.setItem("token", data.token);
            window.location.href = "dashboard.html";
        } else {
            alert("Credenciales incorrectas");
        }

    } catch (error) {
        console.error(error);
        alert("Error de conexión con el servidor");
    }
});