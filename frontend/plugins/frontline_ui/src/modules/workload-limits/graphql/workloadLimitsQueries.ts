import { gql } from '@apollo/client';

export const FRONTLINE_WORKLOAD_LIMITS = gql`
  query FrontlineWorkloadLimits {
    frontlineWorkloadLimits {
      email
      chat
      messenger
      call
      other
    }
  }
`;

export const FRONTLINE_WORKLOAD_LIMITS_UPDATE = gql`
  mutation FrontlineWorkloadLimitsUpdate(
    $limits: FrontlineWorkloadLimitsInput!
  ) {
    frontlineWorkloadLimitsUpdate(limits: $limits) {
      email
      chat
      messenger
      call
      other
    }
  }
`;
