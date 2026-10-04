import { gql } from '@apollo/client';

export const FRONTLINE_TEAM_BOARD = gql`
  query FrontlineTeamBoard($channelId: String) {
    frontlineTeamBoard(channelId: $channelId) {
      _id
      email
      username
      fullName
      avatar
      chatStatus
      boardStatus
      counts {
        call
        email
        chat
        messenger
        other
        total
      }
    }
  }
`;

export const FRONTLINE_QUEUE_BOARD = gql`
  query FrontlineQueueBoard {
    frontlineQueueBoard {
      _id
      name
      buckets
      assignedCount
      unassignedCount
      oldestUnassignedAt
      memberCount
      onlineCount
    }
  }
`;
