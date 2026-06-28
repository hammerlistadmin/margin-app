import { supabase } from "./supabaseClient";

/*
  Margin data layer (Supabase).
  Client-generated UUIDs let every write be a simple upsert (no waiting on
  the DB to hand an id back). RLS scopes every row to the signed-in user.
*/

// ---------- auth ----------
export async function getUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}
export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signUp(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}
export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

// ---------- shape mappers ----------
const toJobRow = (j) => ({
  id: j.id,
  client: j.client,
  type: j.type,
  quoted: j.quoted,
  deposit: j.deposit || 0,
  status: j.status,
  materials: j.costs.materials,
  labor: j.costs.labor,
  equipment: j.costs.equipment,
  subs: j.costs.subs,
});
const fromJobRow = (r) => ({
  id: r.id,
  client: r.client,
  type: r.type,
  quoted: Number(r.quoted),
  deposit: Number(r.deposit),
  status: r.status,
  costs: {
    materials: Number(r.materials),
    labor: Number(r.labor),
    equipment: Number(r.equipment),
    subs: Number(r.subs),
  },
});
const fromExpenseRow = (r) => ({
  id: r.id,
  date: r.date,
  desc: r.description,
  category: r.category,
  amount: Number(r.amount),
  jobId: r.job_id,
});
const fromInvoiceRow = (r) => ({
  id: r.id,
  jobId: r.job_id,
  client: r.client,
  amount: Number(r.amount),
  status: r.status,
  age: r.age,
});

// ---------- load everything for the signed-in user ----------
export async function loadAll() {
  const [jobs, expenses, invoices, settings, overhead] = await Promise.all([
    supabase.from("jobs").select("*").order("created_at", { ascending: false }),
    supabase.from("expenses").select("*").order("created_at", { ascending: false }),
    supabase.from("invoices").select("*").order("created_at", { ascending: false }),
    supabase.from("settings").select("*").maybeSingle(),
    supabase.from("overhead_items").select("*"),
  ]);
  return {
    jobs: (jobs.data || []).map(fromJobRow),
    expenses: (expenses.data || []).map(fromExpenseRow),
    invoices: (invoices.data || []).map(fromInvoiceRow),
    settings: settings.data || null,
    overhead: (overhead.data || []).map((o) => ({
      id: o.id,
      label: o.label,
      amount: Number(o.amount),
    })),
  };
}

// ---------- writes ----------
export async function upsertJob(job) {
  const { error } = await supabase.from("jobs").upsert(toJobRow(job));
  if (error) console.error("upsertJob", error);
}
export async function upsertExpense(exp) {
  const { error } = await supabase.from("expenses").upsert({
    id: exp.id,
    date: exp.date,
    description: exp.desc,
    category: exp.category,
    amount: exp.amount,
    job_id: exp.jobId,
  });
  if (error) console.error("upsertExpense", error);
}
export async function updateInvoice(id, patch) {
  const { error } = await supabase.from("invoices").update(patch).eq("id", id);
  if (error) console.error("updateInvoice", error);
}
export async function upsertSettings(patch) {
  const { data } = await supabase.auth.getUser();
  const owner = data?.user?.id;
  if (!owner) return;
  const { error } = await supabase
    .from("settings")
    .upsert({ owner, ...patch }, { onConflict: "owner" });
  if (error) console.error("upsertSettings", error);
}
export async function upsertOverhead(items) {
  if (!items.length) return;
  const { error } = await supabase.from("overhead_items").upsert(
    items.map((o) => ({ id: o.id, label: o.label, amount: o.amount }))
  );
  if (error) console.error("upsertOverhead", error);
}
