export interface XbrlConcept {
  tag: string;
  unit: string;
  dataType: "decimal" | "integer" | "string";
}

export const ESRS_CONCEPTS: Record<string, XbrlConcept> = {
  scope1_emissions:       { tag: "esrs:E1-6_GrossScope1GHGEmissions",    unit: "tCO2e",  dataType: "decimal" },
  scope2_emissions:       { tag: "esrs:E1-6_GrossScope2GHGEmissions",    unit: "tCO2e",  dataType: "decimal" },
  scope3_emissions:       { tag: "esrs:E1-6_GrossScope3GHGEmissions",    unit: "tCO2e",  dataType: "decimal" },
  energy_consumption:     { tag: "esrs:E1-5_TotalEnergyConsumption",      unit: "MWh",    dataType: "decimal" },
  renewable_energy_pct:   { tag: "esrs:E1-5_EnergyFromRenewables",        unit: "pure",   dataType: "decimal" },
  water_consumption:      { tag: "esrs:E3-4_TotalWaterConsumption",        unit: "m3",     dataType: "decimal" },
  waste_total:            { tag: "esrs:E5-5_TotalWasteGenerated",          unit: "tonnes", dataType: "decimal" },
  waste_recycled_pct:     { tag: "esrs:E5-5_WasteRecycledPercent",         unit: "pure",   dataType: "decimal" },
  biodiversity_sites:     { tag: "esrs:E4-5_SitesInOrNearProtectedAreas", unit: "count",  dataType: "integer" },
  headcount:              { tag: "esrs:S1-6_NumberOfEmployees",            unit: "people", dataType: "integer" },
  gender_pay_gap:         { tag: "esrs:S1-16_GenderPayGap",               unit: "pure",   dataType: "decimal" },
  board_gender_diversity: { tag: "esrs:G1-1_BoardGenderDiversity",         unit: "pure",   dataType: "decimal" },
  corruption_incidents:   { tag: "esrs:G1-4_CorruptionIncidents",          unit: "count",  dataType: "integer" },
  revenue:                { tag: "esrs:G1-2_NetRevenue",                   unit: "EUR",    dataType: "decimal" },
  training_hours:         { tag: "esrs:S1-13_TrainingHoursPerEmployee",    unit: "hours",  dataType: "decimal" },
  work_accidents:         { tag: "esrs:S1-14_WorkRelatedAccidents",        unit: "count",  dataType: "integer" },
  supplier_screening_pct: { tag: "esrs:G1-2_SupplierScreeningPercent",     unit: "pure",   dataType: "decimal" },
  whistleblower_cases:    { tag: "esrs:G1-1_WhistleblowerCases",           unit: "count",  dataType: "integer" },
  nps_score:              { tag: "esrs:G1-2_CustomerSatisfactionScore",    unit: "pure",   dataType: "decimal" },
  iso_27001_certified:    { tag: "esrs:G1-1_InformationSecurityCertified", unit: "bool",   dataType: "string" },
};

// Map ESRS article codes to concept keys
export const ESRS_ARTICLE_TO_CONCEPTS: Record<string, string[]> = {
  "ESRS E1-4": ["scope1_emissions", "scope2_emissions", "scope3_emissions"],
  "ESRS E1-5": ["energy_consumption", "renewable_energy_pct"],
  "ESRS E1-6": ["scope1_emissions", "scope2_emissions"],
  "ESRS E3-4": ["water_consumption"],
  "ESRS E4-5": ["biodiversity_sites"],
  "ESRS E5-5": ["waste_total", "waste_recycled_pct"],
  "ESRS S1-6": ["headcount"],
  "ESRS S1-13": ["training_hours"],
  "ESRS S1-14": ["work_accidents"],
  "ESRS S1-16": ["gender_pay_gap"],
  "ESRS G1-1": ["board_gender_diversity", "corruption_incidents", "whistleblower_cases"],
  "ESRS G1-2": ["revenue", "supplier_screening_pct"],
  "ESRS G1-4": ["corruption_incidents"],
};
