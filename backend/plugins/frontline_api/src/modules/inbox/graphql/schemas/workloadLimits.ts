export const types = `
  type FrontlineWorkloadLimits {
    email: Int
    chat: Int
    messenger: Int
    call: Int
    other: Int
  }

  input FrontlineWorkloadLimitsInput {
    email: Int
    chat: Int
    messenger: Int
    call: Int
    other: Int
  }
`;

export const queries = `
  frontlineWorkloadLimits: FrontlineWorkloadLimits
`;

export const mutations = `
  frontlineWorkloadLimitsUpdate(limits: FrontlineWorkloadLimitsInput!): FrontlineWorkloadLimits
`;
