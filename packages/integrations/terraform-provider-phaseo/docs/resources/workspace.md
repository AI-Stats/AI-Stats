---
page_title: "phaseo_workspace Resource"
description: |-
  Creates and manages a Phaseo workspace.
---

# phaseo_workspace

```terraform
resource "phaseo_workspace" "production" {
  name = "Production"
  slug = "production"
}
```

## Schema

### Required

- `name` (String) Workspace display name.

### Optional

- `slug` (String) URL-safe workspace slug.

### Read-only

- `id` (String) Workspace UUID.
- `created_by` (String) Creator identifier.
- `created_at` (String) Creation timestamp.
- `updated_at` (String) Last update timestamp.

## Import

Import a workspace using its UUID:

```shell
terraform import phaseo_workspace.production 33333333-3333-4333-8333-333333333333
```
