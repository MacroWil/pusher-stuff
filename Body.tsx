"use client";
//body component for messenger, this is where pusher is initialised, map over all messages
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { pusherClient } from "@/lib/pusher";
import MessageBox from "./MessageBox";
import { FullMessageType } from "@/types";
import { find } from "lodash";

interface BodyProps {
  initialMessages: FullMessageType[];
  otherUser: any;
  order: any;
  user: any;
  conversationId: any;
}

const Body: React.FC<BodyProps> = ({
  initialMessages = [],
  otherUser,
  order,
  user,
  conversationId,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState(initialMessages);

  useEffect(() => {
    axios.post(`/api/conversations/${conversationId}/seen`);
  }, [conversationId]);

  useEffect(() => {
    const messageHandler = (message: FullMessageType) => {
      axios.post(`/api/conversations/${conversationId}/seen`);
      setMessages((current) => {
        if (find(current, { id: message.id })) {
          return current;
        }
        return [...current, message];
      });
      bottomRef?.current?.scrollIntoView();
    };

    const updateMessageHandler = (newMessage: FullMessageType) => {
      setMessages((current) =>
        current.map((currentMessage) => {
          if (currentMessage.id === newMessage.id) {
            return newMessage;
          }
          return currentMessage;
        })
      );
    };

    // this is all still a mess because of pusher creating infinite connections (in contact with pusher team to try to resolve)

    // const clearConnection = async () => {
    //   pusherClient.disconnect();
    //   pusherClient.unsubscribe(conversationId);
    //   pusherClient.unbind("messages:new", messageHandler);
    //   pusherClient.unbind("message:update", updateMessageHandler);
    // };
    // const Connect = async () => {
    //pusherClient.connect();
    // };
    // const reConnect = async () => {
    //   // await clearConnection();
    //   await Connect();
    // };

    // if (pusherClient.connection.state == "disconnected") {
    //   reConnect();
    // }

    // Subscribe to the channel and bind event handlers
    pusherClient.subscribe(conversationId);
    pusherClient.bind("messages:new", messageHandler);
    pusherClient.bind("message:update", updateMessageHandler);

    // Cleanup function to unsubscribe and unbind event handlers
    return () => {
      pusherClient.unsubscribe(conversationId);
      pusherClient.unbind("messages:new", messageHandler);
      pusherClient.unbind("message:update", updateMessageHandler);
      //pusherClient.disconnect(); // Disconnect Pusher connection
    };
  }, [conversationId]);

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.map((message, i) => (
        <MessageBox
          isLast={i === messages.length - 1}
          key={message.id}
          data={message}
          user={user}
          convoId={conversationId}
          otherUsersId={otherUser.id}
          order={order}
          otherUserRole={otherUser.role}
          stripeAccountId={otherUser.stripeAccountId}
        />
      ))}
      <div className="pt-24" ref={bottomRef} />
    </div>
  );
};

export default Body;
