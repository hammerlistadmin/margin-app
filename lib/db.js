import { supabase } from "./supabaseClient";

/*
  Data layer for Margin.

  The app currently runs on in-memory demo data (see the seed object in
  components/Margin.jsx). These functions are the drop-in replacement that
  read/write the same shapes against Supabase once you:

    1. Run supabase/schema.sql in your Supabase SQL editor.
    2. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
    3. Add auth (email/password or magic link) so auth.uid() exists.

  Every row is owned by auth.uid() and protected by Row Level Security,
  so each contractor only ever sees their own data.

  To go live: replace the useReducer(seed) in Margin.jsx with a load from
  loadAll() on mount, and dispatch each mutation through the matching
  function below. Kept intentionally simple and framework-agnostic.
*/

const guard = () => {
  if (!supabase) throw new Error("Supabase not configured — running on demo data.");
};

export async function loadAll() {
  guard();
  const [jobs, expenses, invoices, settings] = await Promise.all([
    supabase.from("jobs").select("*").order("created_at", { ascending: false }),
    supabase.from("expenses").select("*").order("created_at", { ascending: false }),
    supabase.from("invoices").select("*").order("created_at", { ascending: false }),
    supabase.from("settings").select("*").maybeSingle(),
  ]);
  return {
    jobs: (jobs.data || []).map(fromJobRow),
    expenses: expenses.data || [],
    invoices: invoices.data || [],
    settings: settings.data || null,
  };
}

// jobs ----------------------------------------------------------------
const toJobRow = (j) => ({
  client: j.client,
  type: j.type,
  quoted: j.quoted,
  deposit: j.deposit,
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

export async function addJob(job) {
  guard();
  const { data, error } = await supabase.from("jobs").insert(toJobRow(job)).select().single();
  if (error) throw error;
  return fromJobRow(data);
}
export async function updateJob(id, patch) {
  guard();
  const { error } = await supabase.from("jobs").update(patch).eq("id", id);
  if (error) throw error;
}
export async function setDeposit(id, deposit) {
  return updateJob(id, { deposit });
}
export async function updateJobCost(id, key, value) {
  return updateJob(id, { [key]: value });
}

// expenses ------------------------------------------------------------
export async function addExpense(exp) {
  guard();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      date: exp.date,
      description: exp.desc,
      category: exp.category,
      amount: exp.amount,
      job_id: exp.jobId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// invoices ------------------------------------------------------------
export async function payInvoice(id) {
  guard();
  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid", age: 0 })
    .eq("id", id);
  if (error) throw error;
}

// settings ------------------------------------------------------------
export async function saveSettings(patch) {
  guard();
  const { error } = await supabase.from("settings").upsert(patch);
  if (error) throw error;
}
