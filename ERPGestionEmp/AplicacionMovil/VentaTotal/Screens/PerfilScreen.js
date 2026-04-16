import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../config/api";
import { clearSession, getStoredToken, getStoredUser, saveSession } from "../utils/authStorage";

export default function PerfilScreen({ navigation }) {
  const [usuario, setUsuario] = useState(null);
  const [estadoSesion, setEstadoSesion] = useState("Cargando sesión...");
  const [cargando, setCargando] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [nombreEdit, setNombreEdit] = useState("");
  const [correoEdit, setCorreoEdit] = useState("");
  const [contrasenaEdit, setContrasenaEdit] = useState("");
  const [mensajeModal, setMensajeModal] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [modalUsuarioVisible, setModalUsuarioVisible] = useState(false);
  const [modoUsuario, setModoUsuario] = useState("crear");
  const [usuarioSeleccionadoId, setUsuarioSeleccionadoId] = useState(null);
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [correoUsuario, setCorreoUsuario] = useState("");
  const [telefonoUsuario, setTelefonoUsuario] = useState("");
  const [contrasenaUsuario, setContrasenaUsuario] = useState("");
  const [mensajeModalUsuario, setMensajeModalUsuario] = useState("");
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);

  const obtenerHeadersAutenticacion = useCallback(async (incluirJson) => {
    const token = await getStoredToken();

    if (!token) {
      return null;
    }

    return {
      ...(incluirJson ? { "Content-Type": "application/json" } : {}),
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    };
  }, []);

  const cargarPerfil = useCallback(async () => {
    setCargando(true);

    try {
      const usuarioLocal = await getStoredUser();
      if (usuarioLocal) {
        setUsuario(usuarioLocal);
      }

      const token = await getStoredToken();
      if (!token) {
        setEstadoSesion("Sin token local");
        setCargando(false);
        return;
      }

      const response = await apiRequest("/api/me", {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        await clearSession();
        navigation.replace("Login");
        return;
      }

      if (!response.ok) {
        setEstadoSesion("Sesión local activa");
        setCargando(false);
        return;
      }

      const data = await response.json();
      setUsuario((prev) => ({ ...prev, ...data }));
      setEstadoSesion("Sesión activa");
    } catch {
      setEstadoSesion("Sin conexión (datos locales)");
    } finally {
      setCargando(false);
    }
  }, [navigation]);

  const cargarUsuarios = useCallback(async () => {
    setCargandoUsuarios(true);

    try {
      const headers = await obtenerHeadersAutenticacion(false);
      if (!headers) {
        await clearSession();
        navigation.replace("Login");
        return;
      }

      const response = await apiRequest("/api/usuarios", {
        method: "GET",
        headers
      });

      if (response.status === 401) {
        await clearSession();
        navigation.replace("Login");
        return;
      }

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setUsuarios(Array.isArray(data) ? data : []);
    } catch {
      setUsuarios([]);
    } finally {
      setCargandoUsuarios(false);
    }
  }, [navigation, obtenerHeadersAutenticacion]);

  useEffect(() => {
    cargarPerfil();
    cargarUsuarios();
  }, [cargarPerfil, cargarUsuarios]);

  const refrescarTodo = async () => {
    await cargarPerfil();
    await cargarUsuarios();
  };

  const cerrarSesion = async () => {
    await clearSession();
    navigation.replace("Login");
  };

  const abrirModalEditar = () => {
    setNombreEdit(usuario?.nombre || "");
    setCorreoEdit(usuario?.correo || "");
    setContrasenaEdit("");
    setMensajeModal("");
    setModalVisible(true);
  };

  const cerrarModalEditar = () => {
    if (guardando) {
      return;
    }

    setModalVisible(false);
    setMensajeModal("");
    setContrasenaEdit("");
  };

  const guardarPerfil = async () => {
    const nombreLimpio = nombreEdit.trim();
    const correoLimpio = correoEdit.trim();

    if (!nombreLimpio || !correoLimpio) {
      setMensajeModal("Nombre y correo son obligatorios.");
      return;
    }

    if (contrasenaEdit && contrasenaEdit.length < 6) {
      setMensajeModal("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    try {
      setGuardando(true);
      setMensajeModal("");

      const token = await getStoredToken();
      const idUsuarioNumero = usuario?.id_usuario;

      if (!token || !idUsuarioNumero) {
        setMensajeModal("No se encontró sesión válida para actualizar perfil.");
        return;
      }

      const payload = {
        nombre: nombreLimpio,
        correo: correoLimpio
      };

      if (contrasenaEdit) {
        payload.contrasena = contrasenaEdit;
      }

      const response = await apiRequest(`/api/usuarios/${idUsuarioNumero}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.status === 401) {
        await clearSession();
        navigation.replace("Login");
        return;
      }

      if (!response.ok) {
        const primerError = data?.errors ? Object.values(data.errors)[0]?.[0] : null;
        setMensajeModal(primerError || data?.message || "No se pudo actualizar el perfil.");
        return;
      }

      const usuarioActualizado = {
        ...(usuario || {}),
        ...(data || {}),
        nombre: nombreLimpio,
        correo: correoLimpio,
        id_usuario: idUsuarioNumero
      };

      setUsuario(usuarioActualizado);
      await saveSession({ token, usuario: usuarioActualizado });
      setEstadoSesion("Sesión activa");
      setModalVisible(false);
      setContrasenaEdit("");
      Alert.alert("Perfil actualizado", "Tus datos se guardaron correctamente.");
    } catch {
      setMensajeModal("Error de conexión al guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const abrirModalNuevoUsuario = () => {
    setModoUsuario("crear");
    setUsuarioSeleccionadoId(null);
    setNombreUsuario("");
    setCorreoUsuario("");
    setTelefonoUsuario("");
    setContrasenaUsuario("");
    setMensajeModalUsuario("");
    setModalUsuarioVisible(true);
  };

  const abrirModalEditarUsuario = (item) => {
    setModoUsuario("editar");
    setUsuarioSeleccionadoId(item?.id_usuario || null);
    setNombreUsuario(item?.nombre || "");
    setCorreoUsuario(item?.correo || "");
    setTelefonoUsuario(item?.telefono || "");
    setContrasenaUsuario("");
    setMensajeModalUsuario("");
    setModalUsuarioVisible(true);
  };

  const cerrarModalUsuario = () => {
    if (guardandoUsuario) {
      return;
    }

    setModalUsuarioVisible(false);
    setMensajeModalUsuario("");
  };

  const guardarUsuario = async () => {
    const nombreLimpio = nombreUsuario.trim();
    const correoLimpio = correoUsuario.trim();
    const telefonoLimpio = telefonoUsuario.trim();

    if (!nombreLimpio || !correoLimpio) {
      setMensajeModalUsuario("Nombre y correo son obligatorios.");
      return;
    }

    if (modoUsuario === "crear" && !contrasenaUsuario) {
      setMensajeModalUsuario("La contraseña es obligatoria al crear.");
      return;
    }

    if (contrasenaUsuario && contrasenaUsuario.length < 6) {
      setMensajeModalUsuario("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    try {
      setGuardandoUsuario(true);
      setMensajeModalUsuario("");

      const headers = await obtenerHeadersAutenticacion(true);
      if (!headers) {
        await clearSession();
        navigation.replace("Login");
        return;
      }

      const payload = {
        nombre: nombreLimpio,
        correo: correoLimpio,
        telefono: telefonoLimpio,
        id_rol: 1
      };

      if (contrasenaUsuario) {
        payload.contrasena = contrasenaUsuario;
      }

      const endpoint =
        modoUsuario === "crear"
          ? "/api/usuarios"
          : `/api/usuarios/${usuarioSeleccionadoId}`;

      const method = modoUsuario === "crear" ? "POST" : "PUT";

      const response = await apiRequest(endpoint, {
        method,
        headers,
        body: JSON.stringify(payload)
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.status === 401) {
        await clearSession();
        navigation.replace("Login");
        return;
      }

      if (!response.ok) {
        const primerError = data?.errors ? Object.values(data.errors)[0]?.[0] : null;
        setMensajeModalUsuario(primerError || data?.message || "No se pudo guardar usuario.");
        return;
      }

      if (
        modoUsuario === "editar" &&
        usuario?.id_usuario &&
        Number(usuario.id_usuario) === Number(usuarioSeleccionadoId)
      ) {
        const token = await getStoredToken();
        const usuarioActualizadoSesion = {
          ...usuario,
          nombre: nombreLimpio,
          correo: correoLimpio
        };

        setUsuario(usuarioActualizadoSesion);

        if (token) {
          await saveSession({ token, usuario: usuarioActualizadoSesion });
        }
      }

      setModalUsuarioVisible(false);
      setContrasenaUsuario("");
      await cargarUsuarios();
      Alert.alert("Usuarios", modoUsuario === "crear" ? "Usuario creado." : "Usuario actualizado.");
    } catch {
      setMensajeModalUsuario("Error de conexión al guardar usuario.");
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const confirmarEliminarUsuario = (item) => {
    Alert.alert(
      "Eliminar usuario",
      `Se eliminara a ${item?.nombre || "este usuario"}.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => eliminarUsuario(item?.id_usuario)
        }
      ]
    );
  };

  const eliminarUsuario = async (idUsuario) => {
    if (!idUsuario) {
      return;
    }

    try {
      const headers = await obtenerHeadersAutenticacion(false);
      if (!headers) {
        await clearSession();
        navigation.replace("Login");
        return;
      }

      const response = await apiRequest(`/api/usuarios/${idUsuario}`, {
        method: "DELETE",
        headers
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.status === 401) {
        await clearSession();
        navigation.replace("Login");
        return;
      }

      if (!response.ok) {
        Alert.alert("Usuarios", data?.message || "No se pudo eliminar usuario.");
        return;
      }

      await cargarUsuarios();
      Alert.alert("Usuarios", "Usuario eliminado correctamente.");
    } catch {
      Alert.alert("Usuarios", "Error de conexión al eliminar usuario.");
    }
  };

  const nombre = usuario?.nombre || "Usuario";
  const correo = usuario?.correo || "Sin correo";
  const rol = "Administrador";
  const idUsuario = usuario?.id_usuario ? `#${usuario.id_usuario}` : "-";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Perfil</Text>
              <Text style={styles.headerSubtitle}>Gestiona tu sesión y usuarios del sistema</Text>
            </View>
            <TouchableOpacity style={styles.refreshIconBtn} onPress={refrescarTodo} disabled={cargando || cargandoUsuarios}>
              {(cargando || cargandoUsuarios)
                ? <ActivityIndicator size="small" color="#1d4ed8" />
                : <Ionicons name="refresh-outline" size={16} color="#1d4ed8" />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.usuarioActivo}>
          <View style={styles.avatarGrande}>
            <Ionicons name="person-outline" size={30} color="white" />
          </View>

          <View style={styles.usuarioBlock}>
            <Text style={styles.usuarioTitulo}>Usuario en sesión</Text>
            <Text style={styles.usuarioNombre}>{nombre}</Text>
            <Text style={styles.usuarioCorreo}>{correo}</Text>
          </View>

          {cargando ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : (
            <View style={styles.estadoBadge}>
              <Text style={styles.estadoText}>{estadoSesion}</Text>
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#2563eb" />
            <Text style={styles.infoText}>{correo}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#2563eb" />
            <Text style={styles.infoText}>{rol}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="id-card-outline" size={20} color="#2563eb" />
            <Text style={styles.infoText}>ID usuario: {idUsuario}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={abrirModalEditar}
        >
          <Ionicons name="create-outline" size={20} color="#2563eb" />
          <Text style={styles.secondaryText}>Editar perfil</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logout} onPress={cerrarSesion}>
          <Ionicons name="log-out-outline" size={20} color="white" />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <View style={styles.usuariosCard}>
          <View style={styles.usuariosHeader}>
            <Text style={styles.usuariosTitle}>Usuarios registrados</Text>
            <TouchableOpacity style={styles.addUserButton} onPress={abrirModalNuevoUsuario}>
              <Ionicons name="person-add-outline" size={18} color="white" />
              <Text style={styles.addUserText}>Nuevo</Text>
            </TouchableOpacity>
          </View>

          {cargandoUsuarios ? (
            <View style={styles.usuariosEstado}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.usuariosEstadoText}>Cargando usuarios...</Text>
            </View>
          ) : usuarios.length === 0 ? (
            <Text style={styles.usuariosEstadoText}>No hay usuarios registrados.</Text>
          ) : (
            usuarios.map((item) => (
              <View key={String(item.id_usuario)} style={styles.usuarioItem}>
                <View style={styles.usuarioItemInfo}>
                  <Text style={styles.usuarioItemNombre}>{item.nombre || "Sin nombre"}</Text>
                  <Text style={styles.usuarioItemCorreo}>{item.correo || "Sin correo"}</Text>
                  <Text style={styles.usuarioItemMeta}>
                    Rol: {item?.rol?.nombre || `#${item?.id_rol || 1}`}
                  </Text>
                </View>

                <View style={styles.usuarioAcciones}>
                  <TouchableOpacity
                    style={styles.iconButtonEdit}
                    onPress={() => abrirModalEditarUsuario(item)}
                  >
                    <Ionicons name="create-outline" size={16} color="#1d4ed8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.iconButtonDelete}
                    onPress={() => confirmarEliminarUsuario(item)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={cerrarModalEditar}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar perfil</Text>
              <TouchableOpacity onPress={cerrarModalEditar} disabled={guardando}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Nombre</Text>
            <TextInput
              value={nombreEdit}
              onChangeText={setNombreEdit}
              placeholder="Nombre completo"
              style={styles.modalInput}
              editable={!guardando}
            />

            <Text style={styles.modalLabel}>Correo</Text>
            <TextInput
              value={correoEdit}
              onChangeText={setCorreoEdit}
              placeholder="correo@ejemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.modalInput}
              editable={!guardando}
            />

            <Text style={styles.modalLabel}>Contraseña (opcional)</Text>
            <TextInput
              value={contrasenaEdit}
              onChangeText={setContrasenaEdit}
              placeholder="Minimo 6 caracteres"
              secureTextEntry
              style={styles.modalInput}
              editable={!guardando}
            />

            {mensajeModal ? <Text style={styles.modalError}>{mensajeModal}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={cerrarModalEditar}
                disabled={guardando}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveButton, guardando && styles.modalSaveButtonDisabled]}
                onPress={guardarPerfil}
                disabled={guardando}
              >
                {guardando ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalSaveText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={modalUsuarioVisible}
        onRequestClose={cerrarModalUsuario}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modoUsuario === "crear" ? "Nuevo usuario" : "Editar usuario"}
              </Text>
              <TouchableOpacity onPress={cerrarModalUsuario} disabled={guardandoUsuario}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Nombre</Text>
            <TextInput
              value={nombreUsuario}
              onChangeText={setNombreUsuario}
              placeholder="Nombre completo"
              style={styles.modalInput}
              editable={!guardandoUsuario}
            />

            <Text style={styles.modalLabel}>Correo</Text>
            <TextInput
              value={correoUsuario}
              onChangeText={setCorreoUsuario}
              placeholder="correo@ejemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.modalInput}
              editable={!guardandoUsuario}
            />

            <Text style={styles.modalLabel}>Teléfono</Text>
            <TextInput
              value={telefonoUsuario}
              onChangeText={setTelefonoUsuario}
              placeholder="Opcional"
              keyboardType="phone-pad"
              style={styles.modalInput}
              editable={!guardandoUsuario}
            />

            <Text style={styles.modalLabel}>
              Contraseña {modoUsuario === "crear" ? "*" : "(opcional)"}
            </Text>
            <TextInput
              value={contrasenaUsuario}
              onChangeText={setContrasenaUsuario}
              placeholder={modoUsuario === "crear" ? "Minimo 6 caracteres" : "Solo si deseas cambiarla"}
              secureTextEntry
              style={styles.modalInput}
              editable={!guardandoUsuario}
            />

            {mensajeModalUsuario ? (
              <Text style={styles.modalError}>{mensajeModalUsuario}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={cerrarModalUsuario}
                disabled={guardandoUsuario}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveButton, guardandoUsuario && styles.modalSaveButtonDisabled]}
                onPress={guardarUsuario}
                disabled={guardandoUsuario}
              >
                {guardandoUsuario ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalSaveText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9"
  },

  scroll: {
    paddingBottom: 24
  },

  header: {
    backgroundColor: "#2c4da7",
    padding: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20
  },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  headerTextWrap: { flex: 1, paddingRight: 12 },

  headerTitle: { color: "white", fontSize: 20, fontWeight: "bold" },

  headerSubtitle: { color: "#dbeafe", marginTop: 4 },

  refreshIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center"
  },

  usuarioActivo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "white",
    margin: 20,
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4
  },

  avatarGrande: {
    width: 58,
    height: 58,
    backgroundColor: "#3b82f6",
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center"
  },

  usuarioBlock: {
    flex: 1
  },

  usuarioTitulo: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4
  },

  usuarioNombre: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a"
  },

  usuarioCorreo: {
    fontSize: 13,
    color: "#334155",
    marginTop: 2
  },

  estadoBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14
  },

  estadoText: {
    color: "#16a34a",
    fontSize: 11,
    fontWeight: "600"
  },

  infoCard: {
    backgroundColor: "white",
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 14
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center"
  },

  infoText: {
    marginLeft: 10,
    fontSize: 15,
    color: "#0f172a"
  },

  secondaryButton: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#bfdbfe"
  },

  secondaryText: {
    color: "#2563eb",
    marginLeft: 10,
    fontWeight: "600"
  },

  usuariosCard: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },

  usuariosHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },

  usuariosTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a"
  },

  addUserButton: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },

  addUserText: {
    color: "white",
    fontWeight: "700"
  },

  usuariosEstado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8
  },

  usuariosEstadoText: {
    color: "#64748b",
    fontSize: 13
  },

  usuarioItem: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },

  usuarioItemInfo: {
    flex: 1,
    paddingRight: 10
  },

  usuarioItemNombre: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a"
  },

  usuarioItemCorreo: {
    fontSize: 13,
    color: "#334155",
    marginTop: 2
  },

  usuarioItemMeta: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4
  },

  usuarioAcciones: {
    flexDirection: "row",
    gap: 8
  },

  iconButtonEdit: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center"
  },

  iconButtonDelete: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center"
  },

  logout: {
    backgroundColor: "#ef4444",
    margin: 20,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center"
  },

  logoutText: {
    color: "white",
    fontWeight: "bold",
    marginLeft: 6
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: 20
  },

  modalCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a"
  },

  modalLabel: {
    fontSize: 13,
    color: "#334155",
    marginTop: 10,
    marginBottom: 6,
    fontWeight: "600"
  },

  modalInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f172a"
  },

  modalError: {
    color: "#dc2626",
    fontSize: 13,
    marginTop: 10
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16
  },

  modalCancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#e2e8f0"
  },

  modalCancelText: {
    color: "#334155",
    fontWeight: "600"
  },

  modalSaveButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    minWidth: 88,
    alignItems: "center"
  },

  modalSaveButtonDisabled: {
    opacity: 0.7
  },

  modalSaveText: {
    color: "white",
    fontWeight: "700"
  }
});
