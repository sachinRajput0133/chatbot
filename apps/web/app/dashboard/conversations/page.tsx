"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

export default function ConversationsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listConversations()
      .then(setConversations)
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, []);

  async function openConversation(conv: any) {
    setSelected(conv);
    const msgs = await api.getMessages(conv.id);
    setMessages(msgs);
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Conversations</h1>
      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : conversations.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">💬</div>
          <p>No conversations yet. Share your embed code to start getting chats!</p>
        </div>
      ) : (
        <div className="flex gap-4 h-[560px]">
          {/* List */}
          <div className="w-64 bg-white border rounded-xl overflow-y-auto">
            {conversations.map((conv, i) => (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                className={`w-full text-left p-4 border-b last:border-0 hover:bg-gray-50 transition ${selected?.id === conv.id ? "bg-indigo-50" : ""}`}
              >
                <div className="text-sm font-medium text-gray-800 truncate">Visitor {conv.visitor_id.slice(-6)}</div>
                <div className="text-xs text-gray-400 mt-0.5">{conv.message_count} messages · {new Date(conv.last_message_at).toLocaleDateString()}</div>
                {conv.page_url && <div className="text-xs text-indigo-400 truncate mt-0.5">{conv.page_url}</div>}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 bg-white border rounded-xl flex flex-col">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Select a conversation
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white self-end rounded-br-sm"
                        : "bg-gray-100 text-gray-800 self-start rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
