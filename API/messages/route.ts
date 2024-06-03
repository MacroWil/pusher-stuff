//create messages, and handle pusher subscriptions and pushing on new message.
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import prisma from "@/lib/prismadb";
import webPush, { PushSubscription } from "web-push";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    const body = await request.json();
    const { message, messageOrder, image, conversationId, otherUserId } = body;
    if (!user?.id || !user?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const recipients = await prisma.user.findUnique({
      where: {
        id: otherUserId,
      },
    });

    const newMessage = await prisma.message.create({
      include: {
        seen: true,
        sender: true,
      },
      data: {
        body: message,
        messageOrder: messageOrder,
        image: image,
        conversation: {
          connect: { id: conversationId },
        },
        sender: {
          connect: { id: user.id },
        },
        seen: {
          connect: {
            id: user.id,
          },
        },
      },
    });

    const updatedConversation = await prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        lastMessageAt: new Date(),
        messages: {
          connect: {
            id: newMessage.id,
          },
        },
      },
      include: {
        users: true,
        messages: {
          include: {
            seen: true,
          },
        },
      },
    });

    await pusherServer.trigger(conversationId, "messages:new", newMessage);

    const lastMessage =
      updatedConversation.messages[updatedConversation.messages.length - 1];

    updatedConversation.users.map((user) => {
      pusherServer.trigger(user.email!, "conversation:update", {
        id: conversationId,
        messages: [lastMessage],
      });
    });
    if (recipients?.subscriptions) {
      try {
        const recipientSubs = recipients.subscriptions;
        const formatrecipients = JSON.parse(recipientSubs);
        //console.log(recipients);
        const send = formatrecipients.map((subscription: PushSubscription) =>
          webPush.sendNotification(
            subscription,
            JSON.stringify({
              title: user.name,
              body: message,
              id: conversationId,
            }),
            {
              vapidDetails: {
                subject: "mailto:ezhomesteading@gmail.com",
                publicKey: process.env
                  .NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY as string,
                privateKey: process.env.WEB_PUSH_PRIVATE_KEY as string,
              },
            }
          )
        );
        await Promise.all(send);
      } catch (error) {
        console.log("A users Push subscription has expired.");
      }
    }
    return NextResponse.json(newMessage);
  } catch (error) {
    console.log(error, "ERROR_MESSAGES");
    return new NextResponse("Error", { status: 500 });
  }
}
