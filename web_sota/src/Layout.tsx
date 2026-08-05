import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Database,
  HelpCircle,
  Inbox as InboxIcon,
  LayoutDashboard,
  ListChecks,
  Logs as LogsIcon,
  MessageSquare,
  Settings,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { type Health, api } from "./api";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import Datasets from "./pages/Datasets";
import Help from "./pages/Help";
import Inbox from "./pages/Inbox";
import Jobs from "./pages/Jobs";
import Logs from "./pages/Logs";
import Models from "./pages/Models";
import SettingsPage from "./pages/Settings";
import Skills from "./pages/Skills";
import Tools from "./pages/Tools";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: ListChecks },
  { to: "/models", label: "Models", icon: Cpu },
  { to: "/datasets", label: "Datasets", icon: Database },
  { to: "/inbox", label: "Inbox", icon: InboxIcon },
  { to: "/tools", label: "Tools", icon: Wrench },
  { to: "/skills", label: "Skills", icon: Sparkles },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: HelpCircle },
  { to: "/logs", label: "Logs", icon: LogsIcon },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const h = await api.get<Health>("/api/health");
        setHealth(h);
        setHealthOk(true);
      } catch {
        setHealthOk(false);
      }
    };
    poll();
    const t = setInterval(poll, 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100" data-testid="app">
      <aside
        data-testid="sidebar"
        className={`flex flex-col border-r border-zinc-800 bg-zinc-900/60 backdrop-blur transition-all ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-amber-500" />
            {!collapsed && (
              <div>
                <div className="text-sm font-semibold">Unsloth MCP</div>
                <div className="text-[10px] text-zinc-500">v0.1.0</div>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            data-testid="sidebar-collapse"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-amber-500/10 text-amber-400"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`
              }
              title={label}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-zinc-800 p-3">
          <div className="flex items-center gap-2">
            <span
              data-testid="backend-dot"
              className={`h-2 w-2 rounded-full animate-pulse ${
                healthOk === null ? "bg-zinc-500" : healthOk ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-xs text-zinc-400">
              {healthOk === null ? "Connecting..." : healthOk ? "Connected" : "Offline"}
            </span>
          </div>
          {health && (
            <div className="mt-1 text-[10px] text-zinc-600">
              {health.tool_count} tools · {health.server} {health.version}
            </div>
          )}
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header
          data-testid="topbar"
          className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-6"
        >
          <div className="text-sm font-medium text-zinc-300">Local Fine-Tuning Control Plane</div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span
                className={`h-2 w-2 rounded-full ${healthOk ? "bg-green-500" : "bg-red-500"}`}
              />
              Backend {healthOk ? "online" : "offline"}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/models" element={<Models />} />
            <Route path="/datasets" element={<Datasets />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/skills" element={<Skills />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/help" element={<Help />} />
            <Route path="/logs" element={<Logs />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
