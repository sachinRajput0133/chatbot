"use client";
import { useParams } from "next/navigation";
import ConversationsView from "../ConversationsView";

export default function ConversationDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return <ConversationsView initialOpenId={id} />;
}
