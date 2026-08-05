export interface BatchRequestItem {
  body: {
    [key: string]: unknown;
  };
  custom_id?: string;
  method?: "POST";
  url?: string;
}
