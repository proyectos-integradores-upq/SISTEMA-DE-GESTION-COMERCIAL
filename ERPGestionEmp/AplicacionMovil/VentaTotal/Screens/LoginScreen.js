import { SafeAreaView } from "react-native-safe-area-context";
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { saveSession } from "../utils/authStorage";
import { apiRequest } from "../config/api";

export default function LoginScreen({ navigation }) {

  const [show, setShow] = useState(false);
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mensaje, setMensaje] = useState("");

  const login = async () => {
    try {
      console.log("Intentando conectar...");

      const response = await apiRequest("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ correo, contrasena })
      });

      console.log("RESPUESTA:", response.status);

      const text = await response.text();
      console.log("TEXT:", text);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        setMensaje("Error en servidor");
        return;
      }

      console.log("DATA:", data);

      if (response.ok) {
        if (data?.token) {
          await saveSession({
            token: data.token,
            usuario: data.usuario
          });
        }
        navigation.replace("Main");
      } else {
        setMensaje("Credenciales incorrectas");
      }

    } catch (error) {
      console.log("ERROR REAL:", error);
      setMensaje("Error de conexión");
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
                <Ionicons name="log-in-outline" size={40} color="#3b82f6" />
              </View>

              <Text style={styles.title}>VentaTotal</Text>

              <Text style={styles.label}>Correo Electrónico</Text>

              <View style={styles.input}>
                <Ionicons name="mail-outline" size={20} color="#888" />
                <TextInput
                  placeholder="juan@example.com"
                  style={styles.inputText}
                  value={correo}
                  onChangeText={setCorreo}
                  keyboardType="email-address"
                />
              </View>

              <Text style={styles.label}>Contraseña</Text>

              <View style={styles.input}>
                <Ionicons name="lock-closed-outline" size={20} color="#888" />

                <TextInput
                  secureTextEntry={!show}
                  style={styles.inputText}
                  value={contrasena}
                  onChangeText={setContrasena}
                  placeholder="********"
                />

                <TouchableOpacity
                  onPress={() => setShow(prev => !prev)}
                  style={styles.eyeButton}
                >
                  <Ionicons 
                    name={show ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color="#888" 
                  />
                </TouchableOpacity>

              </View>

              <TouchableOpacity style={styles.button} onPress={login}>
                <Text style={styles.buttonText}>Ingresar</Text>
              </TouchableOpacity>

              {mensaje !== "" && (
                <Text style={styles.error}>{mensaje}</Text>
              )}

              <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>

              <View style={styles.registerLink}>
                <Text style={styles.texto}>¿No tienes cuenta? </Text>
                <TouchableOpacity onPress={() => navigation.navigate("Register")}>
                  <Text style={styles.link}>Crea una aquí</Text>
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
    marginBottom: 20
  },

  label: {
    marginTop: 10,
    marginBottom: 5,
    color: "#555"
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

  button: {
    backgroundColor: "#3b82f6",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 15
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16
  },

  error: {
    textAlign: "center",
    marginTop: 10,
    color: "red"
  },

  link: {
    textAlign: "center",
    marginTop: 15,
    color: "#3b82f6"
  },

  eyeButton: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: [{ translateY: -10 }],
    padding: 4
  },

  registerLink: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb"
  },

  texto: {
    color: "#666",
    fontSize: 14
  }

});