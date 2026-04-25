"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

interface Goal {
  id: string;
  name: string;
  description: string;
  goal_type: "keyword" | "url_match" | "event";
  target_value: string;
  completion_count: number;
  created_at: string;
}

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // New goal form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goalType, setGoalType] = useState<"keyword" | "url_match">("keyword");
  const [targetValue, setTargetValue] = useState("");

  useEffect(() => {
    fetchGoals();
  }, []);

  async function fetchGoals() {
    setLoading(true);
    try {
      const data = await api.getGoals();
      setGoals(data);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !targetValue) return;

    setSaving(true);
    try {
      const newGoal = await api.createGoal({
        name,
        description,
        goal_type: goalType,
        target_value: targetValue,
      });
      setGoals([newGoal, ...goals]);
      setIsCreating(false);
      setName("");
      setDescription("");
      setTargetValue("");
    } catch (err) {
      console.error(err);
      alert("Failed to create goal");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this goal?")) return;
    try {
      await api.deleteGoal(id);
      setGoals(goals.filter(g => g.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete goal");
    }
  }

  if (loading) {
    return <div className="text-gray-400 text-sm font-bold py-20 text-center">Loading...</div>;
  }

  return (
    <div className="max-w-4xl" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <div className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-extrabold tracking-tighter text-gray-900 leading-tight mb-4">
            Bot <span className="text-orange-600 italic">Goals.</span>
          </h1>
          <p className="text-lg text-gray-500 font-medium leading-relaxed max-w-2xl">
            Track user behavior automatically. Set up conversion goals based on keywords or pages visited.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="px-5 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
        >
          {isCreating ? "Cancel" : "New Goal"}
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-6 shadow-sm border border-orange-200 mb-8 flex flex-col gap-5">
          <div>
            <h3 className="font-extrabold text-gray-900 text-lg mb-1">Create a new Goal</h3>
            <p className="text-xs text-gray-500">Define what constitutes a conversion for your business.</p>
          </div>
          
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Goal Name</label>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Pricing Page Visited"
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:bg-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Goal Type</label>
              <select
                value={goalType}
                onChange={e => setGoalType(e.target.value as any)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:bg-white"
              >
                <option value="url_match">URL Match (Page Visit)</option>
                <option value="keyword">Keyword (Message Content)</option>
              </select>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Target Value</label>
            <input
              required
              value={targetValue}
              onChange={e => setTargetValue(e.target.value)}
              placeholder={goalType === "url_match" ? "e.g. /pricing" : "e.g. discount"}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:bg-white"
            />
            <p className="text-xs text-gray-400">
              {goalType === "url_match" 
                ? "The goal is completed if the visitor's page URL contains this value." 
                : "The goal is completed if the visitor's message contains this keyword."}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Description (Optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:bg-white resize-none"
              rows={2}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-orange-600 text-white rounded-xl font-bold text-sm hover:bg-orange-700 disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving..." : "Save Goal"}
            </button>
          </div>
        </form>
      )}

      {goals.length === 0 && !isCreating ? (
        <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-orange-500" style={{ fontSize: "32px" }}>sports_score</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No goals set up yet</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md">
            Create goals to track when users visit specific pages or mention certain keywords in their messages.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="px-6 py-2.5 bg-orange-100 text-orange-700 rounded-xl font-bold text-sm hover:bg-orange-200 transition-colors"
          >
            Create First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map(goal => (
            <div key={goal.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-extrabold text-gray-900 text-lg">{goal.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2.5 py-0.5 rounded bg-gray-100 text-[10px] font-black text-gray-600 uppercase tracking-widest">
                      {goal.goal_type === "url_match" ? "URL Match" : "Keyword"}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(goal.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>delete</span>
                </button>
              </div>
              
              <p className="text-sm text-gray-500 mb-6 flex-1 line-clamp-2">
                {goal.description || `Triggered when ${goal.goal_type === "url_match" ? "URL" : "message"} contains: "${goal.target_value}"`}
              </p>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Target</span>
                  <span className="text-sm font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded truncate max-w-[150px]">
                    {goal.target_value}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Completions</span>
                  <span className="text-2xl font-black text-orange-600 leading-none">
                    {goal.completion_count}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
