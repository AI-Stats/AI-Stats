import * as SecureStore from "expo-secure-store";

const KEY = "phaseo.user-api-key";
export const secureKey = {
  get: () => SecureStore.getItemAsync(KEY, { requireAuthentication: false }),
  set: (value: string) => SecureStore.setItemAsync(KEY, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  clear: () => SecureStore.deleteItemAsync(KEY)
};
