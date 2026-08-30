export interface WorkspaceDepartmentCreateRequest {
  color?:
    | "blue"
    | "emerald"
    | "amber"
    | "rose"
    | "violet"
    | "slate"
    | "cyan"
    | "teal"
    | "lime"
    | "yellow"
    | "orange"
    | "red"
    | "pink"
    | "fuchsia"
    | "indigo"
    | "sky"
    | "green"
    | "purple";
  description?: string | null;
  icon?:
    | "users"
    | "briefcase"
    | "megaphone"
    | "code"
    | "palette"
    | "headphones"
    | "landmark"
    | "scale"
    | "heart-pulse"
    | "globe"
    | "flask"
    | "graduation-cap"
    | "shield-check"
    | "shopping-bag"
    | "wrench"
    | "truck"
    | "handshake"
    | "chart";
  name: string;
}
