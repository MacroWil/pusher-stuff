//route to handle seen messages with pusher
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import prisma from "@/lib/prismadb";

interface IParams {
  conversationId?: string;
}

export async function POST(request: Request, { params }: { params: IParams }) {
  try {
    const user = await currentUser();
    const { conversationId } = params;

    if (!user?.id || !user?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Find existing conversation
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      include: {
        messages: {
          include: {
            seen: true,
          },
        },
        users: true,
      },
    });

    if (!conversation) {
      return new NextResponse("Invalid ID", { status: 400 });
    }

    // Find last message
    const lastMessage = conversation.messages[conversation.messages.length - 1];

    if (!lastMessage) {
      return NextResponse.json(conversation);
    }

    // Update seen of last message
    const updatedMessage = await prisma.message.update({
      where: {
        id: lastMessage?.id,
      },

      include: {
        sender: true,
        seen: true,
      },
      data: {
        seen: {
          connect: {
            id: user?.id,
          },
        },
      },
    });
    const seenIds = updatedMessage.sender.seenMessageIds;
    if (seenIds.length >= 10) {
      seenIds.shift();

      await prisma.user.update({
        where: { id: updatedMessage.sender.id },
        data: {
          seenMessageIds: seenIds,
        },
      });
    }

    if (user?.seenMessageIds.length >= 10) {
      const userSeenIds = user?.seenMessageIds;
      userSeenIds.shift();

      await prisma.user.update({
        where: { id: user.id },
        data: {
          seenMessageIds: userSeenIds,
        },
      });
    }
    const convoIds = updatedMessage.sender.conversationIds;
    if (convoIds.length >= 10) {
      convoIds.shift();
      await prisma.user.update({
        where: { id: updatedMessage.sender.id },
        data: {
          conversationIds: convoIds,
        },
      });
    }

    if (user?.conversationIds.length >= 10) {
      const userConvoIds = user?.conversationIds;
      userConvoIds.shift();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          conversationIds: userConvoIds,
        },
      });
    }
    // Update all connections with new seen
    await pusherServer.trigger(user.email, "conversation:update", {
      id: conversationId,
      messages: [updatedMessage],
    });

    // If user has already seen the message, no need to go further
    if (lastMessage.seenIds.indexOf(user.id) !== -1) {
      return NextResponse.json(conversation);
    }

    // Update last message seen
    await pusherServer.trigger(
      conversationId!,
      "message:update",
      updatedMessage
    );

    return new NextResponse("Success");
  } catch (error) {
    console.log(error, "ERROR_MESSAGES_SEEN");
    return new NextResponse("Error", { status: 500 });
  }
}
