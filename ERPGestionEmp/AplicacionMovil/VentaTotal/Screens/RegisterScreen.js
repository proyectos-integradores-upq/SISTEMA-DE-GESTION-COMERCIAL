import { SafeAreaView } from "react-native-safe-area-context";
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";

export default function RegisterScreen({ navigation }) {

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const registro = async () => {
    // Validaciones
    if (!nombre.trim() || !apellido.trim() || !correo.trim() || !contrasena || !confirmar) {
      setMensaje("Por favor completa todos los campos");
      return;
    }

    if (contrasena.length < 6) {
      setMensaje("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (contrasena !== confirmar) {
      setMensaje("Las contraseñas no coinciden");
      return;
    }

    if (!aceptaTerminos) {
      setMensaje("Debes aceptar los términos y condiciones");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) {
      setMensaje("Por favor ingresa un correo válido");
      return;
    }

    try {
      setCargando(true);
      const response = await fetch("http://192.168.1.77:8000/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ 
          nombre, 
          apellido, 
          correo, 
          contrasena 
        })
      });

      const text = await response.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        setMensaje("Error en servidor");
        setCargando(false);
        return;
      }

      if (response.ok) {
        setMensaje("¡Cuenta creada exitosamente!");
        setTimeout(() => {
          navigation.replace("Main");
        }, 1500);
      } else {
        setMensaje(data.message || "Error al crear la cuenta");
        setCargando(false);
      }

    } catch (error) {
      setMensaje("Error de conexión");
      setCargando(false);
    }
  };

  return (

    <LinearGradient
      colors={["#1e3a8a", "#1e293b"]}
      style={{ flex: 1 }}
    >

      <SafeAreaView style={{ flex: 1 }}>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >

          <ScrollView contentContainerStyle={styles.scroll}>

            <View style={styles.card}>

              <View style={styles.logoContainer}>
                <Ionicons name="person-add-outline" size={40} color="#3b82f6" />
              </View>

              <Text style={styles.title}>VentaTotal</Text>
              <Text style={styles.subtitle}>Crear Cuenta Nueva</Text>

              {/* Nombre y Apellido en fila */}
              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.label}>Nombre</Text>
                  <View style={styles.input}>
                    <Ionicons name="person-outline" size={20} color="#888" />
                    <TextInput
                      placeholder="Tu nombre"
                      style={styles.inputText}
                      value={nombre}
                      onChangeText={setNombre}
                    />
                  </View>
                </View>

                <View style={{ flex: 1, marginLeft: 5 }}>
                  <Text style={styles.label}>Apellido</Text>
                  <View style={styles.input}>
                    <Ionicons name="person-outline" size={20} color="#888" />
                    <TextInput
                      placeholder="Tu apellido"
                      style={styles.inputText}
                      value={apellido}
                      onChangeText={setApellido}
                    />
                  </View>
                </View>
              </View>

              {/* Correo */}
              <Text style={styles.label}>Correo Electrónico</Text>
              <View style={styles.input}>
                <Ionicons name="mail-outline" size={20} color="#888" />
                <TextInput
                  placeholder="tu@email.com"
                  style={styles.inputText}
                  value={correo}
                  onChangeText={setCorreo}
                  keyboardType="email-address"
                />
              </View>

              {/* Contraseña */}
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.input}>
                <Ionicons name="lock-closed-outline" size={20} color="#888" />
                <TextInput
                  secureTextEntry={!showPassword}
                  style={styles.inputText}
                  value={contrasena}
                  onChangeText={setContrasena}
                  placeholder="••••••••"
                />
                <TouchableOpacity onPress={() => setShowPassword(prev => !prev)} style={styles.eyeButton}>
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color="#888" 
                  />
                </TouchableOpacity>
              </View>

              {/* Confirmar Contraseña */}
              <Text style={styles.label}>Confirmar Contraseña</Text>
              <View style={styles.input}>
                <Ionicons name="lock-closed-outline" size={20} color="#888" />
                <TextInput
                  secureTextEntry={!showConfirm}
                  style={styles.inputText}
                  value={confirmar}
                  onChangeText={setConfirmar}
                  placeholder="••••••••"
                />
                <TouchableOpacity onPress={() => setShowConfirm(prev => !prev)} style={styles.eyeButton}>
                  <Ionicons 
                    name={showConfirm ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color="#888" 
                  />
                </TouchableOpacity>
              </View>

              {/* Términos y Condiciones */}
              <View style={styles.checkboxContainer}>
                <TouchableOpacity 
                  onPress={() => setAceptaTerminos(!aceptaTerminos)}
                  style={styles.checkbox}
                >
                  <Ionicons 
                    name={aceptaTerminos ? "checkbox" : "square-outline"} 
                    size={24} 
                    color={aceptaTerminos ? "#3b82f6" : "#888"}
                  />
                </TouchableOpacity>
                <Text style={styles.checkboxText}>
                  Acepto los términos y condiciones
                </Text>
              </View>

              {/* Botón Crear Cuenta */}
              <TouchableOpacity 
                style={[styles.button, cargando && styles.buttonDisabled]} 
                onPress={registro}
                disabled={cargando}
              >
                <Text style={styles.buttonText}>
                  {cargando ? "Creando..." : "Crear Cuenta"}
                </Text>
              </TouchableOpacity>

              {/* Mensaje de error/éxito */}
              {mensaje !== "" && (
                <Text style={[
                  styles.mensaje, 
                  mensaje.includes("exitosamente") ? styles.exito : styles.error
                ]}>
                  {mensaje}
                </Text>
              )}

              {/* Link a Login */}
              <View style={styles.loginLink}>
                <Text style={styles.texto}>¿Ya tienes cuenta? </Text>
                <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                  <Text style={styles.link}>Inicia sesión aquí</Text>
                </TouchableOpacity>
              </View>

            </View>

          </ScrollView>

        </KeyboardAvoidingView>

      </SafeAreaView>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({

  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },

  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    padding: 25,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8
  },

  logoContainer: {
    backgroundColor: "#e0e7ff",
    alignSelf: "center",
    padding: 15,
    borderRadius: 15,
    marginBottom: 10
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5
  },

  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    color: "#666"
  },

  rowInputs: {
    flexDirection: "row",
    marginBottom: 5
  },

  label: {
    marginTop: 10,
    marginBottom: 5,
    color: "#555",
    fontSize: 14,
    fontWeight: "500"
  },

  input: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    position: "relative"
  },

  inputText: {
    flex: 1,
    marginLeft: 10,
    paddingRight: 40
  },

  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
    marginBottom: 15
  },

  checkbox: {
    marginRight: 10
  },

  checkboxText: {
    flex: 1,
    color: "#555",
    fontSize: 14
  },

  button: {
    backgroundColor: "#3b82f6",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10
  },

  buttonDisabled: {
    opacity: 0.6
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16
  },

  mensaje: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500"
  },

  error: {
    color: "#dc2626"
  },

  exito: {
    color: "#16a34a"
  },

  eyeButton: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: [{ translateY: -10 }],
    padding: 4
  },

  loginLink: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb"
  },

  texto: {
    color: "#666",
    fontSize: 14
  },

  link: {
    color: "#3b82f6",
    fontWeight: "bold",
    fontSize: 14
  }

});
