export const types = `
  type FrontlineTeamBoardCounts {
    call: Int
    email: Int
    chat: Int
    messenger: Int
    other: Int
    total: Int
  }

  type FrontlineTeamBoardAgent {
    _id: String!
    email: String
    username: String
    fullName: String
    avatar: String
    chatStatus: String
    boardStatus: String
    counts: FrontlineTeamBoardCounts
  }

  type FrontlineQueueBoardRow {
    _id: String!
    name: String
    buckets: [String]
    assignedCount: Int
    unassignedCount: Int
    oldestUnassignedAt: Date
    memberCount: Int
    onlineCount: Int
  }
`;

export const queries = `
  frontlineTeamBoard(channelId: String): [FrontlineTeamBoardAgent]
  frontlineQueueBoard: [FrontlineQueueBoardRow]
`;
