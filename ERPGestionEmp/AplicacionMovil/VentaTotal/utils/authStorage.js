import * as SecureStore from "expo-secure-store";

export const AUTH_TOKEN_KEY = "auth_token";
export const AUTH_USER_KEY = "auth_user";

export const saveSession = async ({ token, usuario }) => {
  try {
    if (!token) {
      console.log("ERROR: token vacío");
      return;
    }

    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    await SecureStore.setItemAsync(
      AUTH_USER_KEY,
      JSON.stringify(usuario || null)
    );

    console.log("Sesión guardada correctamente 🔐");
  } catch (error) {
    console.log("Error guardando sesión:", error);
  }
};

export const getStoredToken = async () => {
  return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
};

export const getStoredUser = async () => {
  const user = await SecureStore.getItemAsync(AUTH_USER_KEY);
  return user ? JSON.parse(user) : null;
};

export const clearSession = async () => {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(AUTH_USER_KEY);
};