export type GatewayPricingMeter = {
  currency: string | null;
  price_per_unit: string;
  provider_id: string;
  unit: string;
  unit_size: number;
} | null;
