import { Tabs } from "expo-router";
import { Activity, Bot, Home, MessageSquare, UserRound } from "lucide-react-native";
import { colour, icon } from "@/theme";

const tabs = [
  ["index", "Home", Home], ["models", "Models", Bot], ["chat", "Chat", MessageSquare], ["activity", "Activity", Activity], ["account", "Account", UserRound]
] as const;
export default function TabLayout() {
  return <Tabs screenOptions={{ tabBarActiveTintColor: colour.blue, headerShadowVisible: false, tabBarStyle: { height: 84, paddingTop: 8 }, tabBarLabelStyle: { fontSize: 11, fontWeight: "600" } }}>
    {tabs.map(([name, title, Icon]) => <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color }) => <Icon color={color} size={icon.nav} strokeWidth={icon.stroke} /> }} />)}
  </Tabs>;
}
