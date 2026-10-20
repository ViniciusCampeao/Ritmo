import { useEffect, useMemo, useState } from "react";
import { registerPlugin } from "@capacitor/core";

type Task = {
  id: string;
  title: string;
  category: string;
  time: string;
  day: string;
  done: boolean;
};
type Project = {
  id: string;
  name: string;
  description: string;
  status: "Em andamento" | "Planejado" | "Concluído";
  stack: string;
  updated: string;
};
type Routine = { id: string; title: string; time: string; active: boolean };
type Reward = { id: string; title: string; cost: number };
type Activity = {
  id: string;
  taskId?: string;
  title: string;
  type: "task" | "reward";
  time: number;
  points: number;
};
type Data = {
  tasks: Task[];
  projects: Project[];
  routine: Routine[];
  rewards: Reward[];
  history: Activity[];
  points: number;
  breakMinutes: number;
};
type View = "today" | "agenda" | "projects" | "routine" | "trail" | "focus";
type PhoneUsagePlugin = {
  permission(): Promise<{ granted: boolean }>;
  openPermissionSettings(): Promise<void>;
  startMonitoring(options: {
    breakMinutes: number;
  }): Promise<{ active: boolean }>;
  stopMonitoring(): Promise<{ active: boolean }>;
  monitorState(): Promise<{ active: boolean }>;
};
const PhoneUsage = registerPlugin<PhoneUsagePlugin>("PhoneUsage");
const KEY = "devroutine.v2";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const initial: Data = {
  tasks: [
    {
      id: "t1",
      title: "Escolher a primeira tarefa",
      category: "Planejamento",
      time: "09:00",
      day: today(),
      done: false,
    },
    {
      id: "t2",
      title: "Trabalhar em um projeto de código",
      category: "Projeto",
      time: "10:00",
      day: today(),
      done: false,
    },
    {
      id: "t3",
      title: "Fazer uma pausa",
      category: "Pausa",
      time: "11:30",
      day: today(),
      done: false,
    },
  ],
  projects: [
    {
      id: "p1",
      name: "Painel de rotina",
      description: "Aplicação para organizar tarefas e hábitos.",
      status: "Em andamento",
      stack: "React · TypeScript",
      updated: "Hoje",
    },
    {
      id: "p2",
      name: "API de portfólio",
      description: "API documentada para projetos pessoais.",
      status: "Planejado",
      stack: "Node.js · PostgreSQL",
      updated: "Esta semana",
    },
  ],
  routine: [
    { id: "r1", title: "Planejar o dia", time: "09:00", active: true },
    { id: "r2", title: "Bloco de programação", time: "10:00", active: true },
    { id: "r3", title: "Pausa", time: "12:00", active: true },
    { id: "r4", title: "Estudo técnico", time: "15:00", active: true },
  ],
  rewards: [
    { id: "rw1", title: "Pausa para um café", cost: 30 },
    { id: "rw2", title: "Tempo livre", cost: 60 },
  ],
  history: [],
  points: 0,
  breakMinutes: 30,
};
const nav: { id: View; label: string; icon: string }[] = [
  { id: "today", label: "Hoje", icon: "▦" },
  { id: "agenda", label: "Agenda", icon: "▤" },
  { id: "projects", label: "Projetos", icon: "⌘" },
  { id: "routine", label: "Rotina", icon: "◷" },
  { id: "trail", label: "Trilha", icon: "↗" },
  { id: "focus", label: "Pausas", icon: "Ⅱ" },
];
function load(): Data {
  try {
    const saved = localStorage.getItem(KEY);
    if (!saved) return initial;
    const parsed = JSON.parse(saved);
    return {
      ...initial,
      ...parsed,
      tasks: Array.isArray(parsed.tasks)
        ? parsed.tasks.map((task: Partial<Task>) => ({
            ...task,
            day: task.day || today(),
          }))
        : initial.tasks,
      history: parsed.history || [],
      rewards: parsed.rewards || initial.rewards,
      points: parsed.points || 0,
    };
  } catch {
    return initial;
  }
}
function displayDay(day: string) {
  if (day === today()) return "Hoje";
  return new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}
function dateLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());
}
function id() {
  return crypto.randomUUID();
}
export default function App() {
  const [data, setData] = useState<Data>(load);
  const [view, setView] = useState<View>("today");
  const [dialog, setDialog] = useState<
    "task" | "project" | "routine" | "reward" | null
  >(null);
  const [selectedDay, setSelectedDay] = useState(today());
  const [notice, setNotice] = useState("");
  const [usageGranted, setUsageGranted] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(false);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(data));
  }, [data]);
  useEffect(() => {
    const refreshPhoneState = () => {
      PhoneUsage.permission()
        .then((x) => setUsageGranted(x.granted))
        .catch(() => {});
      PhoneUsage.monitorState()
        .then((x) => setMonitoring(x.active))
        .catch(() => {});
    };
    refreshPhoneState();
    document.addEventListener("visibilitychange", refreshPhoneState);
    return () =>
      document.removeEventListener("visibilitychange", refreshPhoneState);
  }, []);
  const tasksForDay = useMemo(
    () =>
      data.tasks
        .filter((t) => t.day === (view === "agenda" ? selectedDay : today()))
        .sort((a, b) => a.time.localeCompare(b.time)),
    [data.tasks, view, selectedDay],
  );
  const doneToday = data.tasks.filter(
    (t) => t.day === today() && t.done,
  ).length;
  const pendingToday = data.tasks.filter(
    (t) => t.day === today() && !t.done,
  ).length;
  const completedCount = data.history.filter((x) => x.type === "task").length;
  const title = nav.find((n) => n.id === view)?.label || "Hoje";
  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const completeTask = (task: Task) => {
    if (task.done) {
      setData((d) => {
        const earned = d.history.find(
          (item) => item.taskId === task.id && item.type === "task",
        );
        return {
          ...d,
          tasks: d.tasks.map((t) =>
            t.id === task.id ? { ...t, done: false } : t,
          ),
          history: earned
            ? d.history.filter((item) => item.id !== earned.id)
            : d.history,
          points: earned ? Math.max(0, d.points - earned.points) : d.points,
        };
      });
      return;
    }
    const event = {
      id: id(),
      taskId: task.id,
      title: task.title,
      type: "task" as const,
      time: Date.now(),
      points: 10,
    };
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, done: true } : t)),
      history: [event, ...d.history],
      points: d.points + event.points,
    }));
  };
  const saveNew = (
    kind: "task" | "project" | "routine" | "reward",
    form: FormData,
  ) => {
    const key = id();
    if (kind === "task")
      setData((d) => ({
        ...d,
        tasks: [
          ...d.tasks,
          {
            id: key,
            title: String(form.get("title")),
            category: String(form.get("category") || "Pessoal"),
            time: String(form.get("time") || "09:00"),
            day: String(form.get("day") || today()),
            done: false,
          },
        ],
      }));
    if (kind === "project")
      setData((d) => ({
        ...d,
        projects: [
          ...d.projects,
          {
            id: key,
            name: String(form.get("title")),
            description: String(form.get("description") || ""),
            status: String(form.get("status")) as Project["status"],
            stack: String(form.get("stack") || "A definir"),
            updated: "Hoje",
          },
        ],
      }));
    if (kind === "routine")
      setData((d) => ({
        ...d,
        routine: [
          ...d.routine,
          {
            id: key,
            title: String(form.get("title")),
            time: String(form.get("time") || "09:00"),
            active: true,
          },
        ].sort((a, b) => a.time.localeCompare(b.time)),
      }));
    if (kind === "reward")
      setData((d) => ({
        ...d,
        rewards: [
          ...d.rewards,
          {
            id: key,
            title: String(form.get("title")),
            cost: Math.max(1, Number(form.get("cost")) || 1),
          },
        ],
      }));
    setDialog(null);
  };
  const redeem = (reward: Reward) => {
    if (data.points < reward.cost) return;
    setData((d) => ({
      ...d,
      points: d.points - reward.cost,
      history: [
        {
          id: id(),
          title: reward.title,
          type: "reward",
          time: Date.now(),
          points: -reward.cost,
        },
        ...d.history,
      ],
    }));
    flash("Recompensa resgatada");
  };
  const requestUsage = async () => {
    setLoadingPermission(true);
    try {
      await PhoneUsage.openPermissionSettings();
    } catch {
      flash("O acesso ao uso do celular fica disponível no APK Android.");
    } finally {
      setLoadingPermission(false);
    }
  };
  const toggleMonitor = async () => {
    try {
      const result = monitoring
        ? await PhoneUsage.stopMonitoring()
        : await PhoneUsage.startMonitoring({ breakMinutes: data.breakMinutes });
      setMonitoring(result.active);
      if (!monitoring) {
        setUsageGranted(true);
        flash("Lembretes de pausa ativados");
      } else flash("Acompanhamento encerrado");
    } catch (error) {
      flash(
        String(error).includes("permission")
          ? "Ative o acesso ao uso nas configurações do Android."
          : "Não foi possível iniciar o acompanhamento.",
      );
    }
  };
  const toggleRoutine = (rid: string) =>
    setData((d) => ({
      ...d,
      routine: d.routine.map((r) =>
        r.id === rid ? { ...r, active: !r.active } : r,
      ),
    }));
  const addReward = () => setDialog("reward");
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("today");
          }}
        >
          <span className="brand-mark">R</span>
          <span>Ritmo</span>
        </a>
        <div className="side-label">ROTINA PESSOAL</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? "selected" : ""}`}
              onClick={() => setView(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
              {n.id === "today" && (
                <span className="nav-count">{pendingToday}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="storage">
            <span className="status-dot" />
            Salvo neste dispositivo
          </div>
          <div className="points-chip">{data.points} pontos disponíveis</div>
          <div className="version">RITMO · VERSÃO PESSOAL</div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="crumb">
            Ritmo <span>/</span> <b>{title}</b>
          </div>
          <div className="top-actions">
            <span className="today-date">{dateLabel()}</span>
          </div>
        </header>
        <div className="content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "today" ? "PLANO DO DIA" : "ROTINA PESSOAL"}
              </div>
              <h1>{view === "today" ? "Seu dia" : title}</h1>
              <p>
                {view === "today"
                  ? "Uma tarefa de cada vez. O que você quer tirar da frente primeiro?"
                  : view === "agenda"
                    ? "Tarefas organizadas por data e horário."
                    : view === "trail"
                      ? "O que você concluiu e as recompensas que resgatou."
                      : view === "focus"
                        ? "Lembretes de pausa quando o celular está em uso."
                        : view === "projects"
                          ? "Projetos em andamento e próximos passos."
                          : "Blocos de rotina que você escolheu manter."}
              </p>
            </div>
            {["today", "agenda", "projects", "routine"].includes(view) && (
              <button
                className="primary-button"
                onClick={() =>
                  setDialog(
                    view === "projects"
                      ? "project"
                      : view === "routine"
                        ? "routine"
                        : "task",
                  )
                }
              >
                ＋{" "}
                <span>
                  {view === "projects"
                    ? "Novo projeto"
                    : view === "routine"
                      ? "Novo bloco"
                      : "Nova tarefa"}
                </span>
              </button>
            )}
          </section>
          {view === "today" && (
            <>
              <section className="stats-grid">
                <Stat
                  label="Feitas hoje"
                  value={`${doneToday}`}
                  detail={`${pendingToday} ainda na lista`}
                >
                  <span className="stat-symbol">✓</span>
                </Stat>
                <Stat
                  label="Na trilha"
                  value={String(completedCount)}
                  detail="tarefas concluídas no total"
                >
                  <span className="stat-symbol">↗</span>
                </Stat>
                <Stat
                  label="Pontos"
                  value={String(data.points)}
                  detail="por tarefas concluídas"
                >
                  <span className="stat-symbol">＋</span>
                </Stat>
              </section>
              <section className="focus-card">
                <div>
                  <div className="eyebrow">PRÓXIMA TAREFA</div>
                  <h2>
                    {tasksForDay.find((t) => !t.done)?.title ||
                      "Nenhuma tarefa pendente"}
                  </h2>
                  <p>
                    {tasksForDay.find((t) => !t.done)
                      ? `${tasksForDay.find((t) => !t.done)?.time} · ${tasksForDay.find((t) => !t.done)?.category}`
                      : "Você pode adicionar uma tarefa à lista."}
                  </p>
                </div>
                {tasksForDay.find((t) => !t.done) && (
                  <button
                    className="primary-button"
                    onClick={() =>
                      completeTask(tasksForDay.find((t) => !t.done)!)
                    }
                  >
                    Concluir
                  </button>
                )}
              </section>
              <div className="section-row">
                <h2>Hoje</h2>
                <button
                  className="text-button"
                  onClick={() => setView("agenda")}
                >
                  Abrir agenda <span>→</span>
                </button>
              </div>
              <section className="panel">
                <div className="task-list">
                  {tasksForDay.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onToggle={() => completeTask(t)}
                    />
                  ))}
                  {tasksForDay.length === 0 && (
                    <Empty text="Sua lista está vazia." />
                  )}
                </div>
                <div className="panel-foot">
                  <button
                    className="text-button"
                    onClick={() => setDialog("task")}
                  >
                    ＋ Adicionar tarefa
                  </button>
                </div>
              </section>
              <Rewards data={data} onRedeem={redeem} onAdd={addReward} />
            </>
          )}
          {view === "agenda" && (
            <>
              <div className="filter-line">
                <label className="date-filter">
                  Data{" "}
                  <input
                    type="date"
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                  />
                </label>
                <button
                  className="text-button"
                  onClick={() => setSelectedDay(today())}
                >
                  Ir para hoje
                </button>
              </div>
              <section className="panel">
                <div className="task-list full-list">
                  {tasksForDay.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      dayLabel={displayDay(t.day)}
                      onToggle={() => completeTask(t)}
                    />
                  ))}
                  {tasksForDay.length === 0 && (
                    <Empty text="Nada marcado para esta data." />
                  )}
                </div>
              </section>
              <div className="section-row project-section-title">
                <h2>Blocos de rotina</h2>
                <button
                  className="text-button"
                  onClick={() => setView("routine")}
                >
                  Editar rotina <span>→</span>
                </button>
              </div>
              <section className="panel routine-panel">
                <RoutineList routine={data.routine} onToggle={toggleRoutine} />
              </section>
            </>
          )}
          {view === "projects" && (
            <section className="project-grid full-project-grid">
              {data.projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onDelete={() =>
                    setData((d) => ({
                      ...d,
                      projects: d.projects.filter((x) => x.id !== p.id),
                    }))
                  }
                />
              ))}
              {data.projects.length === 0 && (
                <Empty text="Nenhum projeto cadastrado." />
              )}
            </section>
          )}
          {view === "routine" && (
            <section className="panel routine-panel">
              <RoutineList routine={data.routine} onToggle={toggleRoutine} />
              <div className="panel-foot">
                <button
                  className="text-button"
                  onClick={() => setDialog("routine")}
                >
                  ＋ Adicionar bloco
                </button>
              </div>
            </section>
          )}
          {view === "trail" && (
            <>
              <section className="trail-summary">
                <span>{completedCount} tarefas concluídas</span>
                <span>{data.points} pontos no saldo</span>
              </section>
              <section className="panel history-panel">
                {data.history.length === 0 ? (
                  <Empty text="Suas tarefas concluídas vão aparecer aqui." />
                ) : (
                  data.history.map((item) => (
                    <div className="history-row" key={item.id}>
                      <span className={`history-mark ${item.type}`}>
                        {item.type === "task" ? "✓" : "＋"}
                      </span>
                      <span className="history-title">
                        {item.title}
                        <small>
                          {item.type === "task"
                            ? "Tarefa concluída"
                            : "Recompensa resgatada"}
                        </small>
                      </span>
                      <span
                        className={`history-points ${item.points < 0 ? "spent" : ""}`}
                      >
                        {item.points > 0 ? "+" : ""}
                        {item.points} pts
                      </span>
                      <time>
                        {new Date(item.time).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                  ))
                )}
              </section>
              <Rewards data={data} onRedeem={redeem} onAdd={addReward} />
            </>
          )}
          {view === "focus" && (
            <>
              <section className="panel focus-settings">
                <div className="focus-copy">
                  <span className="project-status">
                    {monitoring ? (
                      <>
                        <i className="live-dot" />
                        ACOMPANHAMENTO ATIVO
                      </>
                    ) : (
                      "OPCIONAL"
                    )}
                  </span>
                  <h2>Lembretes de pausa</h2>
                  <p>
                    O Ritmo pode consultar quais apps estão em primeiro plano
                    para sugerir uma pausa. Não lê mensagens, conteúdo da tela
                    ou teclas. O acompanhamento fica no aparelho e pode ser
                    desligado quando quiser.
                  </p>
                </div>
                <label className="field-label interval-field">
                  Lembrar após
                  <select
                    value={data.breakMinutes}
                    onChange={(e) =>
                      setData((d) => ({
                        ...d,
                        breakMinutes: Number(e.target.value),
                      }))
                    }
                  >
                    <option value={20}>20 minutos</option>
                    <option value={30}>30 minutos</option>
                    <option value={45}>45 minutos</option>
                    <option value={60}>60 minutos</option>
                  </select>
                </label>
                <div className="permission-status">
                  <span className={`status-dot ${usageGranted ? "" : "off"}`} />
                  <div>
                    <b>
                      {usageGranted
                        ? "Acesso ao uso ativado"
                        : "Acesso ao uso ainda não autorizado"}
                    </b>
                    <small>
                      O Android pede essa autorização nas configurações do
                      sistema.
                    </small>
                  </div>
                </div>
                <div className="focus-actions">
                  <button
                    className="secondary-button"
                    disabled={loadingPermission}
                    onClick={requestUsage}
                  >
                    {usageGranted
                      ? "Revisar autorização"
                      : "Abrir configuração de acesso"}
                  </button>
                  <button
                    className={`primary-button ${monitoring ? "stop-button" : ""}`}
                    disabled={!usageGranted}
                    onClick={toggleMonitor}
                  >
                    {monitoring
                      ? "Encerrar acompanhamento"
                      : "Ativar lembretes de pausa"}
                  </button>
                </div>
                <p className="privacy-note">
                  Os avisos precisam de permissão para notificações. Quando
                  ativo, o Android mantém uma notificação visível. O Ritmo só
                  usa o acesso para contar tempo de uso entre pausas; nenhum
                  histórico de aplicativos é salvo.
                </p>
              </section>
              <section className="panel local-timer">
                <div>
                  <h3>Sem monitoramento</h3>
                  <p>
                    Você também pode usar um temporizador simples de foco. Ele
                    não observa outros apps.
                  </p>
                </div>
                <FocusTimer />
              </section>
            </>
          )}
          <footer className="app-footer">
            Seus dados ficam neste aparelho.
          </footer>
        </div>
      </main>
      {dialog && (
        <Dialog
          kind={dialog}
          onClose={() => setDialog(null)}
          onSubmit={(form) => saveNew(dialog, form)}
        />
      )}{" "}
      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}
function Stat({
  label,
  value,
  detail,
  children,
}: {
  label: string;
  value: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        {children}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </article>
  );
}
function TaskRow({
  task,
  onToggle,
  dayLabel,
}: {
  task: Task;
  onToggle: () => void;
  dayLabel?: string;
}) {
  return (
    <div className={`task-row ${task.done ? "completed" : ""}`}>
      <button
        className={`check ${task.done ? "checked" : ""}`}
        onClick={onToggle}
        aria-label={task.done ? "Marcar como pendente" : "Concluir tarefa"}
      >
        {task.done ? "✓" : ""}
      </button>
      <span className="task-title">{task.title}</span>
      {dayLabel && <span className="task-day">{dayLabel}</span>}
      <span className="task-category">{task.category}</span>
      <span className="task-time">{task.time}</span>
    </div>
  );
}
function ProjectCard({
  project,
  onDelete,
}: {
  project: Project;
  onDelete?: () => void;
}) {
  return (
    <article className="project-card">
      <div className="project-card-top">
        <span
          className={`project-status ${project.status === "Em andamento" ? "in-progress" : project.status === "Concluído" ? "finished" : ""}`}
        >
          <i />
          {project.status}
        </span>
        {onDelete && (
          <button
            className="icon-button subtle"
            title="Excluir projeto"
            onClick={onDelete}
          >
            ×
          </button>
        )}
      </div>
      <h3>{project.name}</h3>
      <p>{project.description}</p>
      <div className="project-meta">
        <span>{project.stack}</span>
        <span>{project.updated}</span>
      </div>
    </article>
  );
}
function RoutineList({
  routine,
  onToggle,
}: {
  routine: Routine[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="routine-list">
      {[...routine]
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((r) => (
          <div
            className={`routine-row ${r.active ? "" : "inactive"}`}
            key={r.id}
          >
            <span className="routine-time">{r.time}</span>
            <span className="timeline-mark" />
            <span className="routine-title">{r.title}</span>
            <button
              className={`switch ${r.active ? "on" : ""}`}
              aria-label={r.active ? "Desativar bloco" : "Ativar bloco"}
              onClick={() => onToggle(r.id)}
            >
              <i />
            </button>
          </div>
        ))}
      {routine.length === 0 && <Empty text="Nenhum bloco cadastrado." />}
    </div>
  );
}
function Rewards({
  data,
  onRedeem,
  onAdd,
}: {
  data: Data;
  onRedeem: (r: Reward) => void;
  onAdd: () => void;
}) {
  return (
    <>
      <div className="section-row reward-title">
        <h2>Recompensas</h2>
        <span className="reward-balance">{data.points} pontos</span>
      </div>
      <section className="reward-grid">
        {data.rewards.map((r) => (
          <article className="reward-card" key={r.id}>
            <div>
              <h3>{r.title}</h3>
              <p>{r.cost} pontos</p>
            </div>
            <button
              className="secondary-button"
              disabled={data.points < r.cost}
              onClick={() => onRedeem(r)}
            >
              Resgatar
            </button>
          </article>
        ))}
        <button className="reward-add" onClick={onAdd}>
          ＋ Criar recompensa
        </button>
      </section>
    </>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
function FocusTimer() {
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!remaining) return;
    const timer = window.setInterval(
      () => setRemaining((v) => Math.max(0, v - 1)),
      60000,
    );
    return () => window.clearInterval(timer);
  }, [remaining > 0]);
  return (
    <div className="timer-controls">
      <select
        disabled={remaining > 0}
        value={minutes}
        onChange={(e) => setMinutes(Number(e.target.value))}
      >
        <option value={15}>15 min</option>
        <option value={25}>25 min</option>
        <option value={40}>40 min</option>
      </select>
      <button
        className="secondary-button"
        onClick={() => setRemaining(remaining ? 0 : minutes)}
      >
        {remaining ? `${remaining} min · Parar` : "Iniciar"}
      </button>
    </div>
  );
}
function Dialog({
  kind,
  onClose,
  onSubmit,
}: {
  kind: "task" | "project" | "routine" | "reward";
  onClose: () => void;
  onSubmit: (data: FormData) => void;
}) {
  const titles = {
    task: "Nova tarefa",
    project: "Novo projeto",
    routine: "Novo bloco de rotina",
    reward: "Nova recompensa",
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="modal"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
        <div className="modal-head">
          <h2>{titles[kind]}</h2>
          <button type="button" className="icon-button" onClick={onClose}>
            ×
          </button>
        </div>
        <label className="field-label">
          {kind === "project"
            ? "Nome do projeto"
            : kind === "reward"
              ? "O que você quer resgatar?"
              : "Título"}
          <input name="title" required maxLength={100} autoFocus />
        </label>
        {kind === "task" && (
          <>
            <div className="field-row">
              <label className="field-label">
                Categoria
                <input name="category" maxLength={30} placeholder="Pessoal" />
              </label>
              <label className="field-label">
                Horário
                <input name="time" type="time" defaultValue="09:00" />
              </label>
            </div>
            <label className="field-label">
              Data
              <input name="day" type="date" defaultValue={today()} />
            </label>
          </>
        )}
        {kind === "routine" && (
          <label className="field-label">
            Horário
            <input name="time" type="time" defaultValue="09:00" />
          </label>
        )}
        {kind === "project" && (
          <>
            <label className="field-label">
              Descrição
              <input name="description" maxLength={180} />
            </label>
            <label className="field-label">
              Tecnologias
              <input name="stack" maxLength={80} />
            </label>
            <label className="field-label">
              Status
              <select name="status" defaultValue="Planejado">
                <option>Planejado</option>
                <option>Em andamento</option>
                <option>Concluído</option>
              </select>
            </label>
          </>
        )}
        {kind === "reward" && (
          <label className="field-label">
            Pontos necessários
            <input name="cost" type="number" min="1" defaultValue="30" />
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button">Salvar</button>
        </div>
      </form>
    </div>
  );
}
