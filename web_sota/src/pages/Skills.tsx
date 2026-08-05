import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { type Skill, api } from "../api";
import { PageHeader } from "../components/ui";

export default function Skills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");

  useEffect(() => {
    api
      .get<{ skills: Skill[] }>("/api/skills")
      .then((r) => setSkills(r.skills))
      .catch(() => {});
  }, []);

  const open = async (name: string) => {
    setSelected(name);
    try {
      const r = await api.get<{ content: string }>(`/api/skills/${name}`);
      setContent(r.content);
    } catch {
      setContent("(skill content unavailable)");
    }
  };

  return (
    <div data-testid="skills-page" className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div>
        <PageHeader title="Skills" subtitle="How this server wants to be used" />
        <div className="space-y-1" data-testid="skill-list">
          {skills.map((s) => (
            <button
              key={s.name}
              onClick={() => open(s.name)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm ${selected === s.name ? "bg-amber-500/10 text-amber-400" : "text-zinc-300 hover:bg-zinc-800"}`}
            >
              {s.name}
            </button>
          ))}
          {skills.length === 0 && (
            <div className="text-sm text-zinc-600">No skills registered.</div>
          )}
        </div>
      </div>
      <div
        className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6"
        data-testid="skill-content"
      >
        {selected ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-sm text-zinc-600">Select a skill to read its instructions.</div>
        )}
      </div>
    </div>
  );
}
