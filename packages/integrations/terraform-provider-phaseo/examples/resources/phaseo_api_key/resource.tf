resource "phaseo_api_key" "example" {
  name         = "Production application"
  workspace_id = phaseo_workspace.example.id
  scopes       = ["chat.completions", "responses"]
  limit        = 250
  limit_reset  = "monthly"
}
