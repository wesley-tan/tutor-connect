declare global {
  var demoMessages: {
    [conversationId: string]: Array<{
      id: string;
      conversationId: string;
      senderId: string;
      receiverId: string;
      messageText: string;
      messageType: string;
      fileUrl: string | null;
      isRead: boolean;
      readAt: string | null;
      createdAt: string;
      sender: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        profileImageUrl: string | null;
      };
      receiver: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        profileImageUrl: string | null;
      };
    }>;
  };

  var demoConversations: Array<{
    id: string;
    participantA: string;
    participantB: string;
    lastMessageAt: string;
    createdAt: string;
    updatedAt: string;
    participantAUser: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      profileImageUrl: string | null;
    };
    participantBUser: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      profileImageUrl: string | null;
    };
    lastMessage: {
      id: string;
      messageText: string;
      createdAt: string;
      senderId: string;
    };
  }>;
}

export {}; 