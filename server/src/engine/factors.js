// Emission factor library.
//
// IMPORTANT: these values are representative defaults compiled for development
// and demo use. They are NOT a substitute for the published datasets. Before
// using results for reporting or audit, replace/verify each factor against the
// current release of the cited source (EPA, DEFRA/DESNZ, IPCC, IEA) and update
// `year`. Admins can override any factor at runtime via /api/factors.
//
// factor unit: kg CO2e per `unit`
// scope: 1 = direct, 2 = purchased energy, 3 = value chain

export const FACTORS = [
  // ---- Scope 2: purchased electricity (kg CO2e / kWh) ----
  { key: 'electricity.us', category: 'Electricity', label: 'Electricity – US average grid', scope: 2, unit: 'kWh', factor: 0.37, source: 'EPA eGRID', year: 2022 },
  { key: 'electricity.uk', category: 'Electricity', label: 'Electricity – UK grid', scope: 2, unit: 'kWh', factor: 0.207, source: 'DEFRA', year: 2023 },
  { key: 'electricity.in', category: 'Electricity', label: 'Electricity – India grid', scope: 2, unit: 'kWh', factor: 0.71, source: 'IEA', year: 2022 },
  { key: 'electricity.eu', category: 'Electricity', label: 'Electricity – EU average grid', scope: 2, unit: 'kWh', factor: 0.25, source: 'IEA', year: 2022 },
  { key: 'electricity.global', category: 'Electricity', label: 'Electricity – global average', scope: 2, unit: 'kWh', factor: 0.44, source: 'IEA', year: 2022 },

  // ---- Scope 1: stationary & mobile combustion ----
  { key: 'fuel.natural_gas', category: 'Stationary Fuel', label: 'Natural gas', scope: 1, unit: 'kWh', factor: 0.183, source: 'DEFRA', year: 2023 },
  { key: 'fuel.diesel', category: 'Fleet & Fuel', label: 'Diesel', scope: 1, unit: 'litre', factor: 2.7, source: 'EPA', year: 2023 },
  { key: 'fuel.petrol', category: 'Fleet & Fuel', label: 'Petrol / gasoline', scope: 1, unit: 'litre', factor: 2.31, source: 'EPA', year: 2023 },
  { key: 'refrigerant.r410a', category: 'Refrigerants', label: 'Refrigerant R-410A leakage', scope: 1, unit: 'kg', factor: 2088, source: 'IPCC AR5 GWP100', year: 2014 },

  // ---- Scope 3: travel, waste, water ----
  { key: 'travel.flight_domestic', category: 'Business Travel', label: 'Flight – domestic', scope: 3, unit: 'passenger-km', factor: 0.246, source: 'DEFRA', year: 2023 },
  { key: 'travel.flight_short', category: 'Business Travel', label: 'Flight – short-haul', scope: 3, unit: 'passenger-km', factor: 0.151, source: 'DEFRA', year: 2023 },
  { key: 'travel.flight_long', category: 'Business Travel', label: 'Flight – long-haul', scope: 3, unit: 'passenger-km', factor: 0.148, source: 'DEFRA', year: 2023 },
  { key: 'travel.rail', category: 'Business Travel', label: 'Rail', scope: 3, unit: 'passenger-km', factor: 0.035, source: 'DEFRA', year: 2023 },
  { key: 'travel.car', category: 'Business Travel', label: 'Car (average)', scope: 3, unit: 'km', factor: 0.17, source: 'DEFRA', year: 2023 },
  { key: 'travel.hotel', category: 'Business Travel', label: 'Hotel stay', scope: 3, unit: 'night', factor: 15, source: 'DEFRA', year: 2023 },
  { key: 'waste.landfill', category: 'Waste & Water', label: 'Waste – landfill', scope: 3, unit: 'kg', factor: 0.45, source: 'DEFRA', year: 2023 },
  { key: 'waste.recycled', category: 'Waste & Water', label: 'Waste – recycled', scope: 3, unit: 'kg', factor: 0.02, source: 'DEFRA', year: 2023 },
  { key: 'water.supply', category: 'Waste & Water', label: 'Water supply', scope: 3, unit: 'm3', factor: 0.15, source: 'DEFRA', year: 2023 },

  // ---- Scope 3: spend-based (kg CO2e / USD), used for invoice ingestion ----
  { key: 'spend.office', category: 'Purchased Goods & Services', label: 'Spend – office supplies', scope: 3, unit: 'USD', factor: 0.4, source: 'EPA USEEIO (representative)', year: 2022 },
  { key: 'spend.it', category: 'Purchased Goods & Services', label: 'Spend – IT equipment & software', scope: 3, unit: 'USD', factor: 0.3, source: 'EPA USEEIO (representative)', year: 2022 },
  { key: 'spend.professional', category: 'Purchased Goods & Services', label: 'Spend – professional services', scope: 3, unit: 'USD', factor: 0.15, source: 'EPA USEEIO (representative)', year: 2022 },
  { key: 'spend.logistics', category: 'Purchased Goods & Services', label: 'Spend – freight & logistics', scope: 3, unit: 'USD', factor: 0.9, source: 'EPA USEEIO (representative)', year: 2022 },
  { key: 'spend.food', category: 'Purchased Goods & Services', label: 'Spend – food & catering', scope: 3, unit: 'USD', factor: 0.7, source: 'EPA USEEIO (representative)', year: 2022 },
  { key: 'spend.general', category: 'Purchased Goods & Services', label: 'Spend – general / other', scope: 3, unit: 'USD', factor: 0.35, source: 'EPA USEEIO (representative)', year: 2022 },
];

// Unit conversions to each factor's native unit. key = `${from}->${to}`.
export const UNIT_CONVERSIONS = {
  'mwh->kWh': 1000,
  'gwh->kWh': 1e6,
  'therm->kWh': 29.3071,
  'm3->kWh': 10.55, // natural gas, approximate calorific conversion; only used for fuel.natural_gas
  'gallon->litre': 3.78541,
  'mile->km': 1.609344,
  'passenger-mile->passenger-km': 1.609344,
  'tonne->kg': 1000,
  'lb->kg': 0.453592,
};

// Illustrative FX rates to USD for invoice ingestion. Override with the
// CURRENCY_RATES env var (JSON, e.g. {"EUR":1.08}).
export const DEFAULT_RATES = { USD: 1, EUR: 1.08, GBP: 1.27, INR: 0.012 };

// Keyword mapping used to classify an invoice line to a spend factor when no
// explicit category is given.
export const INVOICE_KEYWORDS = [
  { re: /(laptop|computer|software|saas|cloud|hosting|license|licence|server|it\b)/i, key: 'spend.it' },
  { re: /(stationery|office|paper|supplies|printer|toner)/i, key: 'spend.office' },
  { re: /(consult|legal|audit|accounting|advis|agency|professional)/i, key: 'spend.professional' },
  { re: /(freight|shipping|courier|logistic|cargo|delivery|transport)/i, key: 'spend.logistics' },
  { re: /(food|catering|meal|restaurant|coffee|snack)/i, key: 'spend.food' },
];
