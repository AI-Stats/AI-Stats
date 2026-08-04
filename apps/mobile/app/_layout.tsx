import "react-native-gesture-handler";
import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { AppProviders } from "@/providers/AppProviders";
import { navigationTheme } from "@/theme";

export default function RootLayout() {
  const dark = useColorScheme() === "dark";
  return <AppProviders><ThemeProvider value={navigationTheme(dark)}><StatusBar style={dark ? "light" : "dark"} /><Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}><Stack.Screen name="(tabs)" options={{ headerShown: false }} /><Stack.Screen name="model/[id]" options={{ title: "Model" }} /><Stack.Screen name="sign-in" options={{ title: "Sign in" }} /></Stack></ThemeProvider></AppProviders>;
}
