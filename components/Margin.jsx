"use client";
import { useReducer, useMemo, useState, useEffect } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabaseClient";
import * as db from "@/lib/db";
import {
  LayoutDashboard,
  Hammer,
  Calculator,
  Wallet,
  Settings as Cog,
  Plus,
  TrendingUp,
  X,
  LogOut,
} from "lucide-react";

/* ============================================================
   MARGIN — budgeting app for trades contractors
   Full working demo of the spec: dashboard, job costing,
   bid calculator, expenses, invoices, cash flow, settings.
   State is in-session (useReducer). In the real app this maps
   to Supabase tables (jobs, job_costs, invoices, expenses, etc).
   ============================================================ */

const C = {
  ink: "#13242E",
  panel: "#0F2C3C",
  panelEdge: "#28505F",
  bg: "#E8ECEC",
  card: "#FBFCFC",
  cardEdge: "#DDE6E6",
  line: "#EAEFEF",
  clay: "#1C6E8C",
  clayDeep: "#15576F",
  gold: "#B5894C",
  goldSoft: "#D8BD8A",
  stone: "#6E7E84",
  stoneSoft: "#A2B0B4",
  red: "#C0492F",
  redSoft: "#E0795F",
  ochre: "#C08A3C",
  green: "#2F855A",
  greenSoft: "#5BA77E",
  neutral: "#6B7B82",
};
const D = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const B = "'Inter', ui-sans-serif, system-ui, sans-serif";

const num = (v) => {
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
};
const money = (n) =>
  (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
const pct = (n) => `${(n * 100).toFixed(0)}%`;

/* ---------- seed data (multi-trade, brand-neutral) ---------- */
const seed = {
  settings: {
    company: "Margin",
    laborRate: 45,
    reservePct: 28,
    overhead: [
      { id: 1, label: "Truck payment", amount: 620 },
      { id: 2, label: "Insurance", amount: 410 },
      { id: 3, label: "Phone + software", amount: 180 },
      { id: 4, label: "Fuel", amount: 540 },
      { id: 5, label: "Tools / maintenance", amount: 250 },
    ],
  },
  jobs: [
    { id: 1, client: "Maple St Residence", type: "Concrete", quoted: 9800, deposit: 4900,
      status: "active", costs: { materials: 3200, labor: 2400, equipment: 600, subs: 0 } },
    { id: 2, client: "Alvarez HVAC swap", type: "HVAC", quoted: 7200, deposit: 3600,
      status: "closed", costs: { materials: 3800, labor: 1200, equipment: 200, subs: 0 } },
    { id: 3, client: "Backyard turf — Vegas", type: "Turf", quoted: 7770, deposit: 3885,
      status: "active", costs: { materials: 2800, labor: 1440, equipment: 250, subs: 0 } },
    { id: 4, client: "Lakeside deck", type: "Decking", quoted: 14500, deposit: 7250,
      status: "closed", costs: { materials: 6800, labor: 3600, equipment: 400, subs: 900 } },
    { id: 5, client: "Patio pavers", type: "Hardscape", quoted: 11200, deposit: 5600,
      status: "active", costs: { materials: 4900, labor: 2800, equipment: 500, subs: 0 } },
  ],
  expenses: [
    { id: 1, date: "Jun 02", desc: "Material run — rebar", category: "Materials", amount: 480, jobId: 1 },
    { id: 2, date: "Jun 05", desc: "Insurance", category: "Overhead", amount: 410, jobId: null },
    { id: 3, date: "Jun 09", desc: "Diesel", category: "Fuel", amount: 220, jobId: null },
    { id: 4, date: "Jun 14", desc: "Compactor rental", category: "Equipment", amount: 310, jobId: 5 },
  ],
  invoices: [
    { id: 1, jobId: 2, client: "Alvarez HVAC swap", amount: 3600, status: "paid", age: 0 },
    { id: 2, jobId: 4, client: "Lakeside deck", amount: 7250, status: "paid", age: 0 },
    { id: 3, jobId: 1, client: "Maple St Residence", amount: 4900, status: "unpaid", age: 12 },
    { id: 4, jobId: 3, client: "Backyard turf — Vegas", amount: 3885, status: "overdue", age: 38 },
    { id: 5, jobId: 5, client: "Patio pavers", amount: 5600, status: "unpaid", age: 6 },
  ],
};

function reducer(state, a) {
  switch (a.type) {
    case "addJob":
      return { ...state, jobs: [a.job, ...state.jobs] };
    case "updateJobCost": {
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id === a.id ? { ...j, costs: { ...j.costs, [a.key]: a.value } } : j
        ),
      };
    }
    case "setDeposit":
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id === a.id ? { ...j, deposit: a.value } : j
        ),
      };
    case "addExpense":
      return { ...state, expenses: [a.exp, ...state.expenses] };
    case "payInvoice":
      return {
        ...state,
        invoices: state.invoices.map((i) =>
          i.id === a.id ? { ...i, status: "paid", age: 0 } : i
        ),
      };
    case "setSetting":
      return { ...state, settings: { ...state.settings, [a.key]: a.value } };
    case "setOverhead":
      return { ...state, settings: { ...state.settings, overhead: a.value } };
    default:
      return state;
  }
}

const jobCost = (j) =>
  j.costs.materials + j.costs.labor + j.costs.equipment + j.costs.subs;
const jobProfit = (j) => j.quoted - jobCost(j);
const jobMargin = (j) => (j.quoted ? jobProfit(j) / j.quoted : 0);
const jobDeposit = (j) => j.deposit || 0;
const jobBalance = (j) => j.quoted - jobDeposit(j);
const collectedPct = (j) => (j.quoted ? Math.min(jobDeposit(j) / j.quoted, 1) : 0);

/* ---------- motivational quote bank (unattributed) ---------- */
const QUOTES = [
  "Hard work beats talent when talent stops working.",
  "Show up before you feel like it.",
  "Discipline is doing it when the mood is gone.",
  "Small jobs done right build big reputations.",
  "Sweat now, smile later.",
  "The grind doesn't care how you feel.",
  "Done is better than perfect.",
  "Start where you stand, with what you have.",
  "Every pro was once a beginner who refused to quit.",
  "Your only competition is who you were yesterday.",
  "Pressure makes diamonds.",
  "Stop waiting for the perfect time. Build it.",
  "Action cures fear.",
  "The best time to start was yesterday. The next best is now.",
  "You don't find time. You make it.",
  "Cheap work is expensive later.",
  "Measure twice, charge once.",
  "Quality is remembered long after price is forgotten.",
  "Slow is smooth. Smooth is fast.",
  "Win the morning, win the day.",
  "Hustle in silence. Let success make the noise.",
  "Dream big. Start small. Act now.",
  "If it were easy, everyone would do it.",
  "Fall seven times, stand up eight.",
  "Comfort is the enemy of progress.",
  "Do the work nobody sees.",
  "Consistency beats intensity.",
  "One job at a time. One day at a time.",
  "The wall is the workout.",
  "Excuses don't build anything.",
  "Be so good they can't ignore you.",
  "Get up. Dress up. Show up. Never give up.",
  "Your reputation is built on the last job you finished.",
  "Hard days build strong people.",
  "Make it happen or make an excuse. Not both.",
  "Money loves speed and respects discipline.",
  "Bet on yourself. Nobody else will.",
  "Work like the lights could go out tomorrow.",
  "Sharpen the saw before you cut.",
  "A goal without a deadline is just a wish.",
  "Plan your work, then work your plan.",
  "Stay hungry. Stay humble.",
  "Effort is free. Spend it.",
  "Build the life nobody handed you.",
  "Tough times don't last. Tough people do.",
  "The dream is free. The hustle is sold separately.",
  "Outwork your doubt.",
  "What you tolerate, you teach.",
  "Price your worth, not your fear.",
  "Underpromise. Overdeliver.",
  "The job site rewards the prepared.",
  "Don't watch the clock. Be the clock.",
  "Reputation is earned in years and lost in minutes.",
  "Take the hard road. It's less crowded.",
  "Standards over feelings.",
  "Finish strong or don't start.",
  "Bid with confidence. Work with pride.",
  "Today's effort is tomorrow's advantage.",
  "Stack small wins until they become big ones.",
  "Be the hardest worker in the room.",
  "No one is coming to save you. Good. Build it yourself.",
  "Skill is built in the boring reps.",
  "Respect the craft and the craft respects you.",
  "Late nights, early mornings, no complaints.",
  "Your future is built by what you do today.",
  "Charge for the value, not the hours.",
  "A busy fool stays broke. Work smart and hard.",
  "Profit is what's left after the discipline.",
  "Cut corners and the corners cut you.",
  "The estimate is a promise. Keep it.",
  "Quote like a pro, not like you're scared.",
  "Cash flow is oxygen. Protect it.",
  "Know your numbers or your numbers run you.",
  "Margins matter more than revenue.",
  "Busy is not the same as profitable.",
  "Get paid what you're worth, then earn it.",
  "Build systems so the business runs without you.",
  "Hard work compounds. So does laziness.",
  "Be relentless about the basics.",
  "Win the bid on value, not on price.",
  "Treat every job like your best ad.",
  "Reputation travels faster than any flyer.",
  "Do it right, even when no one's watching.",
  "The grind is the gift.",
  "Fortune favors the finisher.",
  "Stop renting your time. Start building your name.",
  "Pressure is a privilege.",
  "Make the call you're avoiding.",
  "The follow-up is where the money hides.",
  "Show up sharp and they'll remember you.",
  "Master one thing before chasing the next.",
  "Patience plus pressure equals progress.",
  "Build it brick by brick.",
  "You become what you repeat.",
  "Hard work is a talent. Train it.",
  "Quit talking. Start nailing.",
  "Sweat equity never depreciates.",
  "The work works if you do.",
  "A craftsman never blames the tools.",
  "Stay ready so you don't have to get ready.",
  "Big results live on the other side of boring days.",
  "Earn the trust, then earn the check.",
  "Hustle until your haters ask if you're hiring.",
  "The early truck gets the job.",
  "Trade comfort for growth every single day.",
  "Do more than you're paid for now. Get paid more later.",
  "Wake up with a purpose, not just an alarm.",
  "Don't lower the price. Raise the value.",
  "The best marketing is a finished job done right.",
  "One more call. One more bid. One more rep.",
  "Discipline today, freedom tomorrow.",
  "Grind in private. Shine in public.",
  "Be obsessed or be average.",
  "Your work ethic is your signature. Sign every job.",
  "Sloppy is a choice. So is excellence.",
  "Make the customer's neighbor jealous.",
  "Keep your word and your calendar full.",
  "There's no traffic on the extra mile.",
  "Tired is temporary. Quitting is forever.",
  "Trade excuses for results.",
  "Bills don't care about your mood. Get to work.",
  "The job you do today pays you for years.",
  "Reputation is the only asset that appreciates with use.",
  "Sell the outcome, not the labor.",
  "Hard now, easy later. Easy now, hard later.",
  "Be the contractor people brag about.",
  "Standards are the floor, not the ceiling.",
  "Win the day before the day wins you.",
  "Stack skills. Stack cash. Stack respect.",
  "The finish coat is where pride shows.",
  "If you want it, schedule it.",
  "No shortcuts to a place worth going.",
  "Stay in your lane and dominate it.",
  "Hard work whispers. Results shout.",
  "The job's not done until it's clean.",
  "Be early, be ready, be unforgettable.",
  "Money follows mastery.",
  "Sharpen one skill until it pays the bills.",
  "Show up on the worst days. That's where legends form.",
  "Bid bold. Deliver gold.",
  "Don't count the hours. Make the hours count.",
  "Pride in the work outlasts the paycheck.",
  "Build your name one nail at a time.",
  "The grind doesn't stop. Neither do you.",
  "Turn pressure into product.",
  "Every callback is a reputation built.",
  "Be the reason they stop shopping around.",
  "Effort today, empire tomorrow.",
  "Work hard in silence. Let the results talk.",
  "Stop dreaming about it. Go quote it.",
  "Excellence is a habit, not an event.",
  "The estimate is easy. The follow-through is the flex.",
  "Be relentless. Be reliable. Be requested.",
  "Outlast the doubt.",
  "A clean job site is a closed deal.",
  "Crush the small stuff. The big stuff follows.",
  "Make today expensive to ignore.",
  "Hustle hard. Bill harder.",
  "Sweat the details others skip.",
  "Your name is on every job. Act like it.",
  "Refuse to be average.",
  "The work won't do itself. Lucky you.",
  "Be the standard, not the exception.",
  "Pressure on. Excuses off.",
  "Earn it daily.",
  "Quote with backbone.",
  "Profit is a skill. Practice it.",
  "Build now. Brag never.",
  "The reps don't lie.",
  "Show up like rent is due. It is.",
  "Greatness is just consistency in work boots.",
  "Be too busy building to complain.",
  "Do it scared. Do it anyway.",
  "Win the morning with motion.",
  "Hard work is the cheat code.",
  "Make excellence your default setting.",
  "Hands dirty, head clear.",
  "Today is the deposit on tomorrow.",
  "Bet on the boring grind.",
  "Sell trust first, service second.",
  "Be the fix, not the excuse.",
  "Hustle is a habit, not a hashtag.",
  "Keep going. Slow progress is still progress.",
  "Get it done before they ask twice.",
  "The job site doesn't care about your feelings, only your finish.",
  "Build the business that builds your freedom.",
  "Pride is in the prep.",
  "Be famous for finishing.",
  "Turn sweat into systems.",
  "Charge confidently. Deliver completely.",
  "The grind is undefeated when you don't quit.",
  "Outlast everyone who started with you.",
  "Discipline is just love for your future self.",
  "Do the rep nobody's clapping for.",
  "Quality work is the loudest ad you'll ever run.",
  "Make momentum your business partner.",
  "Be early. Stay late. Get paid.",
  "Stop negotiating with the snooze button.",
  "Build a name worth referring.",
  "Get a little better every single job.",
  "Hard work makes luck show up.",
  "The hustle pays in installments. Keep depositing.",
  "Be the one they call back.",
  "Excuses are expensive. Skip them.",
  "Show up, level up, get paid up.",
  "Master the boring. Own the market.",
  "Win trust on the small jobs.",
  "Effort is the only fair tax. Pay it.",
  "Bid for the business you want, not the one you fear.",
  "Be relentless on the days you'd rather rest.",
  "Sweat the quote, smile at the deposit.",
  "Today's grind funds tomorrow's freedom.",
  "Build it like your name depends on it. It does.",
  "No one out-grinds the obsessed.",
  "Finish what the quote promised.",
  "Get paid for results, not for showing up.",
  "Keep the trucks moving and the standards high.",
  "Turn one job into ten referrals.",
  "Stay coachable. Stay hungry. Stay paid.",
  "Hard work is the only shortcut.",
  "Be the contractor others measure against.",
  "Build margin into every bid and every habit.",
  "Pressure reveals who actually wants it.",
  "Make today the proof.",
  "The grind builds the brand.",
  "Do it well or don't put your name on it.",
  "Hustle isn't loud. It's early.",
  "Win the work, then earn the trust.",
  "Stack good days until they become a great year.",
  "Your next job is watching how you finish this one.",
  "Be worth every dollar you charge.",
  "Show your work, not your excuses.",
  "Grind today so future you can coast a little.",
  "Pride in, profit out.",
  "Hard hats, harder work.",
  "Be obsessed with the finish line.",
  "Build trust faster than you build the deck.",
  "The bid is a handshake. Keep it.",
  "Earn the referral on every job.",
  "Money is made in the follow-up.",
  "Outlast the slow season with smart cash.",
  "Set the price. Hold the line.",
  "Reliability is rare. Be rare.",
  "The work you avoid is the work that pays.",
  "Be early to the grind, late to the excuses.",
  "Build something today your future self thanks you for.",
  "Sweat the estimate so the job doesn't sweat you.",
  "Be the standard the others copy.",
  "Every finished job is a brick in your name.",
  "Don't chase cheap clients. Build great ones.",
  "Do the job once, do it right.",
  "Hustle quiet, deliver loud.",
  "Keep your numbers tight and your standards tighter.",
  "Show up like it's the job that makes your name. It is.",
  "Discipline pays interest.",
  "Turn pressure into paychecks.",
  "Be the reason the review is five stars.",
  "Work hard, charge fair, sleep well.",
  "The grind is the plan.",
  "Be relentless about the next right move.",
  "Earn today. Compound forever.",
  "Make the work speak so you don't have to.",
];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function buildState(d) {
  const s = d.settings || {};
  return {
    jobs: d.jobs || [],
    expenses: d.expenses || [],
    invoices: d.invoices || [],
    settings: {
      company: s.company || "Margin",
      laborRate: s.labor_rate != null ? Number(s.labor_rate) : 45,
      reservePct: s.reserve_pct != null ? Number(s.reserve_pct) : 28,
      overhead: d.overhead || [],
    },
  };
}

export default function Margin() {
  const [phase, setPhase] = useState(isSupabaseReady ? "loading" : "demo");
  const [initial, setInitial] = useState(null);
  const [email, setEmail] = useState("");

  const loadSession = async () => {
    try {
      const user = await db.getUser();
      if (!user) {
        setPhase("login");
        return;
      }
      const data = await db.loadAll();
      setInitial(buildState(data));
      setEmail(user.email || "");
      setPhase("app");
    } catch (e) {
      console.error(e);
      setPhase("login");
    }
  };

  useEffect(() => {
    if (isSupabaseReady) loadSession();
  }, []);

  const handleSignOut = async () => {
    await db.signOut();
    setInitial(null);
    setPhase("login");
  };

  if (phase === "demo") return <MarginApp initialState={seed} persist={false} />;
  if (phase === "loading") return <Splash />;
  if (phase === "login")
    return (
      <Login
        onAuthed={async () => {
          setPhase("loading");
          await loadSession();
        }}
      />
    );
  return (
    <MarginApp
      initialState={initial}
      persist={true}
      userEmail={email}
      onSignOut={handleSignOut}
    />
  );
}

function Splash() {
  return (
    <div style={st.splash}>
      <span style={st.splashMark}>◣</span>
      <span style={st.splashText}>Loading…</span>
    </div>
  );
}

function Login({ onAuthed }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    if (!email.trim() || !password) {
      setErr("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") await db.signIn(email.trim(), password);
      else await db.signUp(email.trim(), password);
      await onAuthed();
    } catch (e) {
      setErr(e.message || "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <div style={st.authPage}>
      <div style={st.authCard}>
        <div style={st.brand}>
          <span style={st.brandMark}>◣</span>
          <span style={st.brandName}>Margin</span>
        </div>
        <h1 style={st.authTitle}>
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p style={st.authSub}>Budgeting that remembers everything you enter.</p>

        <label style={st.field}>
          <span style={st.fieldLabel}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={st.input}
            placeholder="you@email.com"
          />
        </label>
        <label style={st.field}>
          <span style={st.fieldLabel}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            style={st.input}
            placeholder="••••••••"
          />
        </label>

        {err && <div style={st.authErr}>{err}</div>}

        <button style={st.primary} onClick={submit} disabled={busy}>
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        <button
          style={st.authToggle}
          onClick={() => {
            setErr("");
            setMode(mode === "signin" ? "signup" : "signin");
          }}
        >
          {mode === "signin"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

function MarginApp({ initialState, persist, userEmail, onSignOut }) {
  const [state, rawDispatch] = useReducer(reducer, initialState);
  const [view, setView] = useState("dashboard");

  // Wrap dispatch: update the UI immediately, then persist to Supabase
  // (only when persist is true — demo mode stays purely in-memory).
  const dispatch = (action) => {
    rawDispatch(action);
    if (!persist) return;
    try {
      switch (action.type) {
        case "addJob":
          db.upsertJob(action.job);
          break;
        case "updateJobCost": {
          const j = state.jobs.find((x) => x.id === action.id);
          if (j) db.upsertJob({ ...j, costs: { ...j.costs, [action.key]: action.value } });
          break;
        }
        case "setDeposit": {
          const j = state.jobs.find((x) => x.id === action.id);
          if (j) db.upsertJob({ ...j, deposit: action.value });
          break;
        }
        case "addExpense":
          db.upsertExpense(action.exp);
          break;
        case "payInvoice":
          db.updateInvoice(action.id, { status: "paid", age: 0 });
          break;
        case "setSetting": {
          const col = action.key === "laborRate" ? "labor_rate"
            : action.key === "reservePct" ? "reserve_pct" : action.key;
          db.upsertSettings({ [col]: action.value });
          break;
        }
        case "setOverhead":
          db.upsertOverhead(action.value);
          break;
        default:
          break;
      }
    } catch (e) {
      console.error("persist failed", e);
    }
  };

  const overheadTotal = state.settings.overhead.reduce((s, o) => s + o.amount, 0);

  const nav = [
    ["dashboard", "Home", LayoutDashboard],
    ["jobs", "Jobs", Hammer],
    ["bid", "Bid", Calculator],
    ["money", "Money", Wallet],
    ["settings", "Setup", Cog],
  ];

  return (
    <div style={st.app}>
      <header style={st.topbar}>
        <div style={st.brand}>
          <span style={st.brandMark}>◣</span>
          <span style={st.brandName}>{state.settings.company}</span>
        </div>
        {persist ? (
          <button onClick={onSignOut} style={st.signout} title={userEmail}>
            <LogOut size={14} /> Sign out
          </button>
        ) : (
          <span style={st.brandTag}>Budgeting for trades</span>
        )}
      </header>

      <main style={st.main}>
        {view === "dashboard" && (
          <Dashboard state={state} overheadTotal={overheadTotal} go={setView} />
        )}
        {view === "jobs" && <Jobs state={state} dispatch={dispatch} />}
        {view === "bid" && (
          <BidCalc settings={state.settings} overheadTotal={overheadTotal} />
        )}
        {view === "money" && <Money state={state} dispatch={dispatch} />}
        {view === "settings" && (
          <SettingsView state={state} dispatch={dispatch} overheadTotal={overheadTotal} />
        )}
      </main>

      <nav style={st.bottomnav}>
        {nav.map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            style={{ ...st.navBtn, ...(view === k ? st.navOn : {}) }}
          >
            <Icon size={20} strokeWidth={view === k ? 2.4 : 2} />
            <span style={st.navLabel}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ===================== DASHBOARD ===================== */
function Dashboard({ state, overheadTotal, go }) {
  const closed = state.jobs.filter((j) => j.status === "closed");
  const revenue = closed.reduce((s, j) => s + j.quoted, 0);
  const directCost = closed.reduce((s, j) => s + jobCost(j), 0);
  const grossProfit = revenue - directCost;
  const net = grossProfit - overheadTotal;
  const grossMargin = revenue ? grossProfit / revenue : 0;

  const paid = state.invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const ar = state.invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount, 0);
  const deposits = state.jobs.reduce((s, j) => s + jobDeposit(j), 0);
  const cash = deposits + paid - state.expenses.reduce((s, e) => s + e.amount, 0);

  const ranked = [...state.jobs].sort((a, b) => jobMargin(b) - jobMargin(a));

  return (
    <div>
      <QuoteTicker />
      <SectionHead title="This month" sub="Closed jobs, money in, money out." />

      <div style={st.panel}>
        <div style={st.panelTop}>
          <span style={st.panelLabel}>Net profit</span>
          <span
            style={{
              ...st.tag,
              color: net > 0 ? C.greenSoft : net < 0 ? C.redSoft : C.stoneSoft,
            }}
          >
            {net > 0 ? "In the green" : net < 0 ? "In the red" : "Break even"}
          </span>
        </div>
        <div
          style={{
            ...st.big,
            color: net > 0 ? C.greenSoft : net < 0 ? C.redSoft : C.stoneSoft,
          }}
        >
          {money(net)}
        </div>
        <div style={st.pnlRow}>
          <Pnl label="Revenue" v={money(revenue)} light />
          <Pnl label="Direct cost" v={money(-directCost)} light />
          <Pnl label="Overhead" v={money(-overheadTotal)} light />
        </div>
      </div>

      <div style={st.kpis}>
        <Kpi label="Gross margin" v={pct(grossMargin)} accent={C.clay} />
        <Kpi label="Cash on hand" v={money(cash)} accent={C.ink} />
        <Kpi label="Owed to you" v={money(ar)} accent={C.ochre} />
      </div>

      <div style={{ ...st.card, marginTop: 14 }}>
        <div style={st.rowBetween}>
          <span style={st.cardTitle}>Profit by job</span>
          <button style={st.linkBtn} onClick={() => go("jobs")}>
            View all
          </button>
        </div>
        {ranked.slice(0, 4).map((j) => (
          <div key={j.id} style={st.jobLine}>
            <div>
              <div style={st.jobName}>{j.client}</div>
              <div style={st.jobMeta}>
                {j.type} · {j.status}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ ...st.jobProfit, color: jobProfit(j) > 0 ? C.green : jobProfit(j) < 0 ? C.red : C.ink }}>
                {money(jobProfit(j))}
              </div>
              <div style={st.jobMeta}>{pct(jobMargin(j))} margin</div>
            </div>
          </div>
        ))}
      </div>

      <div style={st.callout}>
        <TrendingUp size={16} color={C.clay} />
        <span>
          {ranked.length > 0
            ? `Revenue isn't profit. ${ranked[0].type} jobs are carrying your margin right now — price more like them.`
            : "Add your first job to start tracking what each one actually makes."}
        </span>
      </div>
    </div>
  );
}

/* ===================== JOBS / JOB COSTING ===================== */
function Jobs({ state, dispatch }) {
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div style={st.rowBetween}>
        <SectionHead title="Jobs" sub="Quoted vs what it actually cost." />
        <button style={st.addBtn} onClick={() => setAdding(true)}>
          <Plus size={16} /> Job
        </button>
      </div>

      {adding && <AddJob dispatch={dispatch} close={() => setAdding(false)} />}

      {state.jobs.map((j) => {
        const isOpen = open === j.id;
        const cost = jobCost(j);
        const profit = jobProfit(j);
        const over = cost > j.quoted * 0.8;
        return (
          <div key={j.id} style={st.card}>
            <button style={st.jobHeader} onClick={() => setOpen(isOpen ? null : j.id)}>
              <div>
                <div style={st.jobName}>{j.client}</div>
                <div style={st.jobMeta}>{j.type} · {j.status}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...st.jobProfit, color: profit > 0 ? C.green : profit < 0 ? C.red : C.ink }}>
                  {money(profit)}
                </div>
                <div style={st.jobMeta}>{pct(jobMargin(j))}</div>
              </div>
            </button>

            <div style={st.estBar}>
              <div
                className="bar-fill"
                style={{
                  width: `${Math.min((cost / j.quoted) * 100, 100)}%`,
                  background: over ? C.red : C.clay,
                }}
              />
            </div>
            <div style={st.estMeta}>
              <span>Cost {money(cost)}</span>
              <span>
                {jobBalance(j) > 0
                  ? `Balance ${money(jobBalance(j))}`
                  : "Paid in full"}
              </span>
              <span>Quoted {money(j.quoted)}</span>
            </div>

            {isOpen && (
              <div style={st.costEditor}>
                <div style={st.payBlock}>
                  <div style={st.rowBetween}>
                    <span style={st.payTitle}>Collected upfront</span>
                    <span style={st.payPct}>{pct(collectedPct(j))} of quote</span>
                  </div>
                  <div style={st.payBar}>
                    <div className="bar-fill"
                      style={{ width: `${collectedPct(j) * 100}%`, background: C.gold }} />
                  </div>
                  <div style={st.payGrid}>
                    <div style={st.payCell}>
                      <span style={st.payCellLabel}>Quoted</span>
                      <span style={st.payCellVal}>{money(j.quoted)}</span>
                    </div>
                    <label style={st.payCell}>
                      <span style={st.payCellLabel}>Deposit</span>
                      <div style={st.depWrap}>
                        <span style={st.miniPrefix}>$</span>
                        <input inputMode="decimal" value={jobDeposit(j)}
                          onChange={(e) => dispatch({ type: "setDeposit", id: j.id, value: num(e.target.value) })}
                          style={st.depInput} />
                      </div>
                    </label>
                    <div style={st.payCell}>
                      <span style={st.payCellLabel}>Balance due</span>
                      <span style={{ ...st.payCellVal, color: jobBalance(j) > 0 ? C.clay : C.gold }}>
                        {money(jobBalance(j))}
                      </span>
                    </div>
                  </div>
                  <div style={st.varNote}>
                    Deposit is money in the bank now — it covers part of the
                    quote, not extra profit. The balance is what's still owed.
                  </div>
                </div>

                <div style={st.costEditorTitle}>Job costs</div>
                {["materials", "labor", "equipment", "subs"].map((k) => (
                  <label key={k} style={st.costRow}>
                    <span style={st.costLabel}>{k}</span>
                    <div style={st.miniWrap}>
                      <span style={st.miniPrefix}>$</span>
                      <input
                        inputMode="decimal"
                        value={j.costs[k]}
                        onChange={(e) =>
                          dispatch({
                            type: "updateJobCost",
                            id: j.id,
                            key: k,
                            value: num(e.target.value),
                          })
                        }
                        style={st.miniInput}
                      />
                    </div>
                  </label>
                ))}
                <div style={st.varNote}>
                  Log real costs as they hit. Watch the bar — it turns red past
                  80% of the quote so overruns surface before the job closes.
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AddJob({ dispatch, close }) {
  const [client, setClient] = useState("");
  const [type, setType] = useState("Concrete");
  const [quoted, setQuoted] = useState("");
  const [deposit, setDeposit] = useState("");
  return (
    <div style={st.addCard}>
      <div style={st.rowBetween}>
        <span style={st.cardTitle}>New job</span>
        <button style={st.iconBtn} onClick={close}><X size={16} /></button>
      </div>
      <Field label="Client / job name" value={client} setter={setClient} prefix="" />
      <label style={st.field}>
        <span style={st.fieldLabel}>Trade</span>
        <select value={type} onChange={(e) => setType(e.target.value)} style={st.select}>
          {["Concrete", "HVAC", "Turf", "Decking", "Hardscape", "Roofing", "Other"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <div style={st.two}>
        <Field label="Quoted price" value={quoted} setter={setQuoted} />
        <Field label="Deposit collected" value={deposit} setter={setDeposit} />
      </div>
      <button
        style={st.primary}
        onClick={() => {
          if (!client) return;
          dispatch({
            type: "addJob",
            job: {
              id: crypto.randomUUID(),
              client,
              type,
              quoted: num(quoted),
              deposit: num(deposit),
              status: "active",
              costs: { materials: 0, labor: 0, equipment: 0, subs: 0 },
            },
          });
          close();
        }}
      >
        Add job
      </button>
    </div>
  );
}

/* ===================== BID CALCULATOR ===================== */
function BidCalc({ settings, overheadTotal }) {
  const [materials, setMaterials] = useState("2800");
  const [hours, setHours] = useState("32");
  const [rate, setRate] = useState(String(settings.laborRate));
  const [equipment, setEquipment] = useState("250");
  const [subs, setSubs] = useState("0");
  const [ohJob, setOhJob] = useState("400");
  const [reservePct] = useState(String(settings.reservePct));
  const [mode, setMode] = useState("forward");
  const [price, setPrice] = useState("7770");
  const [targetType, setTargetType] = useState("profit");
  const [targetVal, setTargetVal] = useState("3000");

  const labor = num(hours) * num(rate);
  const total = num(materials) + labor + num(equipment) + num(subs) + num(ohJob);
  const reserve = num(reservePct) / 100;

  const fwd = useMemo(() => {
    const p = num(price);
    const profit = p - total;
    return { p, profit, margin: p ? profit / p : 0, take: profit > 0 ? profit * (1 - reserve) : profit };
  }, [price, total, reserve]);

  const rev = useMemo(() => {
    const t = num(targetVal);
    let p = total;
    if (targetType === "profit") p = total + t;
    else if (targetType === "margin") { const m = Math.min(t, 99) / 100; p = m < 1 ? total / (1 - m) : total; }
    else if (targetType === "takehome") p = total + (reserve < 1 ? t / (1 - reserve) : t);
    const profit = p - total;
    return { p, profit, margin: p ? profit / p : 0, take: profit > 0 ? profit * (1 - reserve) : profit };
  }, [targetType, targetVal, total, reserve]);

  const A = mode === "forward" ? fwd : rev;
  const status = A.p <= 0 ? { l: "Enter a price", c: C.stoneSoft, f: 0 }
    : A.profit < 0 ? { l: "Below break-even", c: C.redSoft, f: 6 }
    : A.margin < 0.15 ? { l: "Thin", c: C.ochre, f: (A.margin / 0.5) * 100 }
    : A.margin < 0.3 ? { l: "Okay", c: C.goldSoft, f: (A.margin / 0.5) * 100 }
    : { l: "Healthy", c: C.greenSoft, f: Math.min((A.margin / 0.5) * 100, 100) };

  return (
    <div>
      <SectionHead title="Bid calculator" sub="What you'll make — or what to charge to hit a target." />

      <div style={st.seg}>
        <button onClick={() => setMode("forward")} style={{ ...st.segBtn, ...(mode === "forward" ? st.segOn : {}) }}>What I'll make</button>
        <button onClick={() => setMode("reverse")} style={{ ...st.segBtn, ...(mode === "reverse" ? st.segOn : {}) }}>Price to hit a target</button>
      </div>

      <div style={st.card}>
        <div style={st.cardTitle}>Job costs</div>
        <Field label="Materials" value={materials} setter={setMaterials} />
        <div style={st.two}>
          <Field label="Labor hours" value={hours} setter={setHours} prefix="" />
          <Field label="Rate / hr" value={rate} setter={setRate} />
        </div>
        <Field label="Equipment / rental" value={equipment} setter={setEquipment} />
        <Field label="Subcontractors" value={subs} setter={setSubs} />
        <Field label="Overhead this job" value={ohJob} setter={setOhJob} hint="Monthly overhead ÷ jobs/month" />
        <div style={st.costStrip}>
          <span style={st.stripLabel}>Break-even</span>
          <span style={st.stripStrong}>{money(total)}</span>
        </div>
      </div>

      {mode === "forward" ? (
        <div style={st.card}>
          <div style={st.cardTitle}>Your price</div>
          <Field label="Quote price" value={price} setter={setPrice} />
          <input type="range" min={Math.max(0, Math.round(total * 0.6))}
            max={Math.round(Math.max(total * 2.2, 1000))} step={10}
            value={num(price)} onChange={(e) => setPrice(e.target.value)} className="tbl-range" />
        </div>
      ) : (
        <div style={st.card}>
          <div style={st.cardTitle}>Your target</div>
          <div style={st.seg3}>
            {[["profit", "Profit $"], ["margin", "Margin %"], ["takehome", "Take-home $"]].map(([k, l]) => (
              <button key={k} onClick={() => setTargetType(k)} style={{ ...st.seg3Btn, ...(targetType === k ? st.seg3On : {}) }}>{l}</button>
            ))}
          </div>
          <Field label={targetType === "margin" ? "Target margin" : "Target amount"}
            value={targetVal} setter={setTargetVal} prefix={targetType === "margin" ? "" : "$"} />
        </div>
      )}

      <div style={st.panel}>
        <div style={st.panelTop}>
          <span style={st.panelLabel}>{mode === "forward" ? "You keep (profit)" : "Quote this price"}</span>
          <span style={{ ...st.tag, color: status.c }}>{status.l}</span>
        </div>
        <div style={{ ...st.big, color: mode === "forward" ? status.c : C.goldSoft }}>
          {mode === "forward" ? money(fwd.profit) : money(rev.p)}
        </div>
        <div style={st.meterTrack}>
          <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(status.f, 100))}%`, background: status.c }} />
        </div>
        <div style={st.pnlRow}>
          <Pnl label="Margin" v={pct(A.margin)} light />
          <Pnl label={mode === "forward" ? "Price" : "Profit"} v={money(mode === "forward" ? fwd.p : rev.profit)} light />
          <Pnl label="Take-home" v={money(A.take)} light />
        </div>
      </div>

      <p style={st.fineprint}>
        Reserve ({num(reservePct)}%) comes off profit, not revenue — set it under Setup.
      </p>
    </div>
  );
}

/* ===================== MONEY (expenses / invoices / cash flow) ===================== */
function Money({ state, dispatch }) {
  const [tab, setTab] = useState("invoices");
  return (
    <div>
      <SectionHead title="Money" sub="Who owes you, what you've spent, what's coming." />
      <div style={st.seg3}>
        {[["invoices", "Invoices"], ["expenses", "Expenses"], ["cash", "Cash flow"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...st.seg3Btn, ...(tab === k ? st.seg3On : {}) }}>{l}</button>
        ))}
      </div>
      {tab === "invoices" && <Invoices state={state} dispatch={dispatch} />}
      {tab === "expenses" && <Expenses state={state} dispatch={dispatch} />}
      {tab === "cash" && <CashFlow state={state} />}
    </div>
  );
}

function Invoices({ state, dispatch }) {
  const buckets = { current: 0, "30+": 0, "60+": 0 };
  state.invoices.forEach((i) => {
    if (i.status === "paid") return;
    if (i.age >= 60) buckets["60+"] += i.amount;
    else if (i.age >= 30) buckets["30+"] += i.amount;
    else buckets.current += i.amount;
  });
  return (
    <div>
      <div style={st.agingRow}>
        <Aging label="Current" v={buckets.current} c={C.ink} />
        <Aging label="30+ days" v={buckets["30+"]} c={C.ochre} />
        <Aging label="60+ days" v={buckets["60+"]} c={C.red} />
      </div>
      {state.invoices.map((i) => (
        <div key={i.id} style={st.card}>
          <div style={st.rowBetween}>
            <div>
              <div style={st.jobName}>{i.client}</div>
              <div style={st.jobMeta}>
                {i.status === "paid" ? "Paid" : i.status === "overdue" ? `Overdue · ${i.age}d` : `Due · ${i.age}d`}
              </div>
            </div>
            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <span style={st.jobProfit}>{money(i.amount)}</span>
              {i.status !== "paid" && (
                <button style={st.smallBtn} onClick={() => dispatch({ type: "payInvoice", id: i.id })}>
                  Mark paid
                </button>
              )}
              {i.status === "paid" && <span style={{ ...st.tag, color: C.gold }}>Collected</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Expenses({ state, dispatch }) {
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("Materials");
  const [jobId, setJobId] = useState("");
  return (
    <div>
      <div style={st.addCard}>
        <span style={st.cardTitle}>Log expense</span>
        <Field label="What for" value={desc} setter={setDesc} prefix="" />
        <div style={st.two}>
          <Field label="Amount" value={amount} setter={setAmount} />
          <label style={st.field}>
            <span style={st.fieldLabel}>Category</span>
            <select value={cat} onChange={(e) => setCat(e.target.value)} style={st.select}>
              {["Materials", "Labor", "Equipment", "Fuel", "Overhead", "Other"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label style={st.field}>
          <span style={st.fieldLabel}>Assign to</span>
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} style={st.select}>
            <option value="">Overhead (no job)</option>
            {state.jobs.map((j) => <option key={j.id} value={j.id}>{j.client}</option>)}
          </select>
        </label>
        <button style={st.primary} onClick={() => {
          if (!desc || !num(amount)) return;
          dispatch({ type: "addExpense", exp: {
            id: crypto.randomUUID(), date: "Today", desc, category: cat,
            amount: num(amount), jobId: jobId ? Number(jobId) : null,
          }});
          setDesc(""); setAmount("");
        }}>Add expense</button>
      </div>
      {state.expenses.map((e) => {
        const job = state.jobs.find((j) => j.id === e.jobId);
        return (
          <div key={e.id} style={st.expRow}>
            <div>
              <div style={st.jobName}>{e.desc}</div>
              <div style={st.jobMeta}>{e.date} · {e.category} · {job ? job.client : "Overhead"}</div>
            </div>
            <span style={st.jobProfit}>{money(-e.amount)}</span>
          </div>
        );
      })}
    </div>
  );
}

function CashFlow({ state }) {
  const overhead = state.settings.overhead.reduce((s, o) => s + o.amount, 0);
  const incoming = state.invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount, 0);
  const startCash = state.invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0)
    + state.jobs.reduce((s, j) => s + jobDeposit(j), 0)
    - state.expenses.reduce((s, e) => s + e.amount, 0);

  const months = ["Now", "Month 2", "Month 3", "Month 4"];
  let bal = startCash;
  const rows = months.map((m, i) => {
    const inFlow = i === 0 ? incoming : incoming * 0.5; // taper assumption
    const outFlow = overhead + (i === 0 ? 0 : 2200);
    bal = bal + inFlow - outFlow;
    return { m, inFlow, outFlow, bal };
  });
  const low = Math.min(...rows.map((r) => r.bal));

  return (
    <div>
      <div style={st.card}>
        <div style={st.cardTitle}>Projected balance</div>
        {rows.map((r) => (
          <div key={r.m} style={st.cashRow}>
            <span style={st.cashMonth}>{r.m}</span>
            <div style={st.cashBars}>
              <span style={st.cashIn}>+{money(r.inFlow)}</span>
              <span style={st.cashOut}>−{money(r.outFlow)}</span>
            </div>
            <span style={{ ...st.cashBal, color: r.bal < 0 ? C.red : C.ink }}>{money(r.bal)}</span>
          </div>
        ))}
      </div>
      <div style={{ ...st.callout, background: low < 0 ? "#F6E2DC" : C.card }}>
        <TrendingUp size={16} color={low < 0 ? C.red : C.clay} />
        <span>
          {low < 0
            ? `Tight month ahead — balance dips to ${money(low)}. Bank a cushion now or pull in collections.`
            : `Lowest projected balance is ${money(low)} — you're covered through the slow stretch.`}
        </span>
      </div>
    </div>
  );
}

/* ===================== SETTINGS ===================== */
function SettingsView({ state, dispatch, overheadTotal }) {
  const s = state.settings;
  return (
    <div>
      <SectionHead title="Setup" sub="The numbers that drive every calculation." />
      <div style={st.card}>
        <div style={st.cardTitle}>Defaults</div>
        <label style={st.field}>
          <span style={st.fieldLabel}>Default labor rate / hr</span>
          <div style={st.inputWrap}>
            <span style={st.prefix}>$</span>
            <input value={s.laborRate} inputMode="decimal" style={{ ...st.input, paddingLeft: 22 }}
              onChange={(e) => dispatch({ type: "setSetting", key: "laborRate", value: num(e.target.value) })} />
          </div>
        </label>
        <label style={st.field}>
          <span style={st.fieldLabel}>Tax reserve (% of profit)</span>
          <input value={s.reservePct} inputMode="decimal" style={st.input}
            onChange={(e) => dispatch({ type: "setSetting", key: "reservePct", value: num(e.target.value) })} />
          <span style={st.hint}>Taken on profit, not revenue. NV has no state income tax — federal only. Confirm with your accountant.</span>
        </label>
      </div>

      <div style={st.card}>
        <div style={st.rowBetween}>
          <span style={st.cardTitle}>Monthly overhead</span>
          <span style={st.ohTotal}>{money(overheadTotal)}/mo</span>
        </div>
        {s.overhead.map((o, i) => (
          <div key={o.id} style={st.ohRow}>
            <input value={o.label} style={st.ohLabel}
              onChange={(e) => {
                const next = [...s.overhead]; next[i] = { ...o, label: e.target.value };
                dispatch({ type: "setOverhead", value: next });
              }} />
            <div style={st.miniWrap}>
              <span style={st.miniPrefix}>$</span>
              <input value={o.amount} inputMode="decimal" style={st.miniInput}
                onChange={(e) => {
                  const next = [...s.overhead]; next[i] = { ...o, amount: num(e.target.value) };
                  dispatch({ type: "setOverhead", value: next });
                }} />
            </div>
          </div>
        ))}
        <button style={st.ghost} onClick={() => dispatch({
          type: "setOverhead",
          value: [...s.overhead, { id: crypto.randomUUID(), label: "New cost", amount: 0 }],
        })}>+ Add line</button>
      </div>

      <p style={st.fineprint}>
        Demo data lives in memory. In the live app this is one Supabase backend
        per contractor — sign-in, saved jobs, real invoices.
      </p>
    </div>
  );
}

/* ===================== shared bits ===================== */
function QuoteTicker() {
  const order = useMemo(() => shuffle([...Array(QUOTES.length).keys()]), []);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % order.length), 9000);
    return () => clearInterval(t);
  }, [order.length]);
  const next = () => setI((p) => (p + 1) % order.length);
  return (
    <button onClick={next} style={st.quoteBar} aria-label="Next quote">
      <span style={st.quoteMark}>“</span>
      <span key={i} className="quote-fade" style={st.quoteText}>
        {QUOTES[order[i]]}
      </span>
    </button>
  );
}

function SectionHead({ title, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={st.h2}>{title}</h2>
      <p style={st.h2sub}>{sub}</p>
    </div>
  );
}
function Field({ label, value, setter, prefix = "$", hint }) {
  return (
    <label style={st.field}>
      <span style={st.fieldLabel}>{label}</span>
      <div style={st.inputWrap}>
        {prefix && <span style={st.prefix}>{prefix}</span>}
        <input inputMode="decimal" value={value} onChange={(e) => setter(e.target.value)}
          style={{ ...st.input, paddingLeft: prefix ? 22 : 12 }} />
      </div>
      {hint && <span style={st.hint}>{hint}</span>}
    </label>
  );
}
function Pnl({ label, v, light }) {
  return (
    <div style={st.pnl}>
      <span style={{ ...st.pnlLabel, color: light ? C.stoneSoft : C.stone }}>{label}</span>
      <span style={{ ...st.pnlVal, color: light ? C.bg : C.ink }}>{v}</span>
    </div>
  );
}
function Kpi({ label, v, accent }) {
  return (
    <div style={st.kpi}>
      <span style={st.kpiLabel}>{label}</span>
      <span style={{ ...st.kpiVal, color: accent }}>{v}</span>
    </div>
  );
}
function Aging({ label, v, c }) {
  return (
    <div style={st.aging}>
      <span style={st.agingLabel}>{label}</span>
      <span style={{ ...st.agingVal, color: c }}>{money(v)}</span>
    </div>
  );
}

const st = {
  app: { minHeight: "100vh", background: "rgba(232,236,236,0.92)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", fontFamily: B, color: C.ink, maxWidth: 480, margin: "0 auto", paddingBottom: 78, position: "relative", boxShadow: "0 0 80px rgba(8,26,38,0.45)" },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 10px", position: "sticky", top: 0, background: "rgba(232,236,236,0.85)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 5 },
  brand: { display: "flex", alignItems: "center", gap: 8 },
  brandMark: { color: C.clay, fontSize: 18 },
  brandName: { fontFamily: D, fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em" },
  brandTag: { fontSize: 11.5, color: C.stone, fontWeight: 500 },
  signout: { display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${C.cardEdge}`, background: C.card, color: C.stone, padding: "6px 10px", borderRadius: 9, fontFamily: D, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  splash: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 },
  splashMark: { color: C.clay, fontSize: 34 },
  splashText: { fontFamily: D, fontSize: 14, fontWeight: 600, color: C.stone },
  authPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 },
  authCard: { width: "100%", maxWidth: 380, background: C.card, border: `1px solid ${C.cardEdge}`, borderRadius: 18, padding: 22 },
  authTitle: { fontFamily: D, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: "16px 0 4px" },
  authSub: { fontSize: 13.5, color: C.stone, margin: "0 0 18px" },
  authErr: { background: "#F6E2DC", color: C.red, fontSize: 12.5, fontWeight: 500, padding: "9px 11px", borderRadius: 9, marginBottom: 10 },
  authToggle: { width: "100%", border: "none", background: "none", color: C.clay, fontFamily: D, fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 12, padding: 6 },
  main: { padding: "6px 14px 0" },

  quoteBar: { width: "100%", display: "flex", gap: 10, alignItems: "flex-start", textAlign: "left", background: C.ink, border: "none", borderRadius: 14, padding: "14px 16px", marginBottom: 16, cursor: "pointer", color: C.bg, minHeight: 58 },
  quoteMark: { fontFamily: D, fontSize: 30, fontWeight: 700, color: C.clay, lineHeight: 0.8, marginTop: 6, flexShrink: 0 },
  quoteText: { fontFamily: D, fontSize: 15, fontWeight: 500, lineHeight: 1.35, alignSelf: "center" },

  h2: { fontFamily: D, fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" },
  h2sub: { fontSize: 13, color: C.stone, margin: "3px 0 0" },

  panel: { background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 18, padding: "16px 16px 14px", boxShadow: "0 12px 30px -14px rgba(0,0,0,.5)" },
  panelTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  panelLabel: { fontFamily: D, fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: C.stoneSoft },
  tag: { fontFamily: D, fontSize: 12, fontWeight: 600 },
  big: { fontFamily: D, fontSize: 42, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05, margin: "8px 0 14px", fontVariantNumeric: "tabular-nums" },

  pnlRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, borderTop: `1px solid ${C.panelEdge}`, paddingTop: 12 },
  pnl: { display: "flex", flexDirection: "column", gap: 2 },
  pnlLabel: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" },
  pnlVal: { fontFamily: D, fontSize: 16, fontWeight: 600, fontVariantNumeric: "tabular-nums" },

  kpis: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 },
  kpi: { background: C.card, border: `1px solid ${C.cardEdge}`, borderRadius: 14, padding: "12px 12px" },
  kpiLabel: { display: "block", fontSize: 11, color: C.stone, marginBottom: 5 },
  kpiVal: { fontFamily: D, fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" },

  card: { background: C.card, border: `1px solid ${C.cardEdge}`, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTitle: { fontFamily: D, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.stone },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  linkBtn: { border: "none", background: "none", color: C.clay, fontFamily: D, fontWeight: 600, fontSize: 12.5, cursor: "pointer" },

  jobLine: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: `1px solid ${C.line}` },
  jobHeader: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", border: "none", background: "none", cursor: "pointer", padding: 0, textAlign: "left" },
  jobName: { fontFamily: D, fontSize: 15, fontWeight: 600 },
  jobMeta: { fontSize: 12, color: C.stone, marginTop: 2, textTransform: "capitalize" },
  jobProfit: { fontFamily: D, fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" },

  estBar: { height: 6, background: C.line, borderRadius: 99, overflow: "hidden", marginTop: 12 },
  estMeta: { display: "flex", justifyContent: "space-between", fontSize: 11.5, color: C.stone, marginTop: 6, fontVariantNumeric: "tabular-nums" },

  costEditor: { marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 10 },
  costEditorTitle: { fontFamily: D, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.stone, marginTop: 4 },
  payBlock: { background: C.bg, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 },
  payTitle: { fontFamily: D, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.stone },
  payPct: { fontFamily: D, fontSize: 12, fontWeight: 600, color: C.gold },
  payBar: { height: 6, background: C.line, borderRadius: 99, overflow: "hidden" },
  payGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignItems: "end" },
  payCell: { display: "flex", flexDirection: "column", gap: 4 },
  payCellLabel: { fontSize: 11, color: C.stone },
  payCellVal: { fontFamily: D, fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  depWrap: { position: "relative" },
  depInput: { width: "100%", boxSizing: "border-box", padding: "7px 8px 7px 20px", borderRadius: 9, border: `1px solid ${C.cardEdge}`, background: "#fff", fontFamily: D, fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", outline: "none" },
  costRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  costLabel: { fontSize: 13, fontWeight: 500, textTransform: "capitalize" },
  varNote: { fontSize: 11.5, color: C.stoneSoft, lineHeight: 1.4 },

  miniWrap: { position: "relative", width: 120 },
  miniPrefix: { position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: C.stoneSoft, fontSize: 13, fontFamily: D },
  miniInput: { width: "100%", boxSizing: "border-box", padding: "8px 10px 8px 20px", borderRadius: 9, border: `1px solid ${C.cardEdge}`, background: "#fff", fontFamily: D, fontSize: 14, fontWeight: 500, fontVariantNumeric: "tabular-nums", outline: "none", textAlign: "right" },

  field: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 },
  fieldLabel: { fontSize: 12.5, fontWeight: 500 },
  inputWrap: { position: "relative" },
  prefix: { position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: C.stoneSoft, fontSize: 14, fontFamily: D },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.cardEdge}`, background: "#fff", fontFamily: D, fontSize: 16, fontWeight: 500, color: C.ink, fontVariantNumeric: "tabular-nums", outline: "none" },
  select: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.cardEdge}`, background: "#fff", fontFamily: D, fontSize: 15, fontWeight: 500, color: C.ink, outline: "none" },
  hint: { fontSize: 11.5, color: C.stoneSoft, lineHeight: 1.35 },
  two: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },

  costStrip: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6, paddingTop: 12, borderTop: `1px solid ${C.line}` },
  stripLabel: { fontSize: 12, color: C.stone },
  stripStrong: { fontFamily: D, fontSize: 18, fontWeight: 700, color: C.clay, fontVariantNumeric: "tabular-nums" },

  seg: { display: "flex", background: C.card, border: `1px solid ${C.cardEdge}`, borderRadius: 12, padding: 4, gap: 4, marginBottom: 12 },
  segBtn: { flex: 1, border: "none", background: "transparent", padding: "10px 6px", borderRadius: 9, fontFamily: D, fontSize: 13, fontWeight: 600, color: C.stone, cursor: "pointer" },
  segOn: { background: C.ink, color: C.bg },
  seg3: { display: "flex", gap: 6, marginBottom: 12 },
  seg3Btn: { flex: 1, border: `1px solid ${C.cardEdge}`, background: "#fff", padding: "9px 4px", borderRadius: 9, fontFamily: D, fontSize: 12.5, fontWeight: 600, color: C.stone, cursor: "pointer" },
  seg3On: { background: C.clay, borderColor: C.clay, color: "#fff" },

  meterTrack: { height: 6, borderRadius: 99, background: "#2C313C", overflow: "hidden", marginBottom: 16 },
  fineprint: { fontSize: 11.5, color: C.stone, textAlign: "center", lineHeight: 1.5, padding: "2px 10px 8px" },

  callout: { display: "flex", gap: 10, alignItems: "flex-start", background: C.card, border: `1px solid ${C.cardEdge}`, borderRadius: 14, padding: 14, marginTop: 14, fontSize: 13, lineHeight: 1.45, color: C.ink },

  addBtn: { display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: C.ink, color: C.bg, padding: "8px 12px", borderRadius: 10, fontFamily: D, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  addCard: { background: C.card, border: `1px solid ${C.cardEdge}`, borderRadius: 16, padding: 16, marginBottom: 14 },
  iconBtn: { border: "none", background: "none", cursor: "pointer", color: C.stone, padding: 4 },
  primary: { width: "100%", border: "none", background: C.clay, color: "#fff", padding: "12px", borderRadius: 11, fontFamily: D, fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  ghost: { width: "100%", border: `1px dashed ${C.cardEdge}`, background: "transparent", color: C.stone, padding: "10px", borderRadius: 10, fontFamily: D, fontSize: 13, fontWeight: 500, cursor: "pointer", marginTop: 6 },
  smallBtn: { border: `1px solid ${C.clay}`, background: "transparent", color: C.clay, padding: "5px 10px", borderRadius: 8, fontFamily: D, fontSize: 12, fontWeight: 600, cursor: "pointer" },

  agingRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 },
  aging: { background: C.card, border: `1px solid ${C.cardEdge}`, borderRadius: 14, padding: "11px 12px" },
  agingLabel: { display: "block", fontSize: 11, color: C.stone, marginBottom: 4 },
  agingVal: { fontFamily: D, fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" },

  expRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: C.card, border: `1px solid ${C.cardEdge}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 },

  cashRow: { display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 10, padding: "10px 0", borderTop: `1px solid ${C.line}` },
  cashMonth: { fontFamily: D, fontSize: 13, fontWeight: 600, width: 64 },
  cashBars: { display: "flex", gap: 10, fontSize: 12, fontVariantNumeric: "tabular-nums" },
  cashIn: { color: C.ochre },
  cashOut: { color: C.stone },
  cashBal: { fontFamily: D, fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" },

  ohTotal: { fontFamily: D, fontSize: 14, fontWeight: 700, color: C.clay },
  ohRow: { display: "flex", gap: 10, alignItems: "center", marginTop: 10 },
  ohLabel: { flex: 1, padding: "8px 10px", borderRadius: 9, border: `1px solid ${C.cardEdge}`, background: "#fff", fontFamily: B, fontSize: 13.5, outline: "none" },

  bottomnav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, display: "flex", background: C.card, borderTop: `1px solid ${C.cardEdge}`, padding: "8px 6px 10px", zIndex: 10 },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, border: "none", background: "none", color: C.stone, cursor: "pointer", padding: "4px 0" },
  navOn: { color: C.clay },
  navLabel: { fontFamily: D, fontSize: 10.5, fontWeight: 600 },
};
