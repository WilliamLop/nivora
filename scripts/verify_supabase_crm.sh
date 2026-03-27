#!/usr/bin/env bash
set -euo pipefail

read -r -d '' JS <<'EOF' || true
const { createClient } = require("@supabase/supabase-js");

function getPublicAuthKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ""
  );
}

function getServerKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function logCheck(label, ok, detail) {
  const status = ok ? "OK" : "FAIL";
  console.log(`[${status}] ${label}${detail ? ` - ${detail}` : ""}`);
}

async function verifyTable(url, key, table, selectClause) {
  const client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await client.from(table).select(selectClause).limit(1);

  if (error) {
    return { ok: false, detail: error.message };
  }

  return { ok: true, detail: `query ok (${Array.isArray(data) ? data.length : 0} row sample)` };
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const publicAuthKey = getPublicAuthKey();
  const serverKey = getServerKey();

  const envChecks = [
    {
      label: "SUPABASE_URL",
      ok: Boolean(supabaseUrl),
      detail: supabaseUrl ? "configured" : "missing",
    },
    {
      label: "Public auth key",
      ok: Boolean(publicAuthKey),
      detail: publicAuthKey
        ? "configured"
        : "missing NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY)",
    },
    {
      label: "Server key",
      ok: Boolean(serverKey),
      detail: serverKey ? "configured" : "missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
    },
  ];

  envChecks.forEach((check) => logCheck(check.label, check.ok, check.detail));

  if (!supabaseUrl || !serverKey) {
    process.exit(1);
  }

  const tableChecks = [
    ["workspace_settings", "id,market_id,segment_id,batch_id,batch_name,offer_base_id,offer_addons"],
    [
      "leads",
      "id,stage,ops_status,assigned_user_id,assigned_at,assigned_by_user_id,next_follow_up_at,last_activity_at,last_activity_summary",
    ],
    ["team_members", "id,email,full_name,role,is_active,must_change_password"],
    ["segment_assignments", "id,user_id,market_id,segment_id,is_active"],
    ["lead_activities", "id,lead_id,user_id,user_name,activity_type,outcome,summary,next_follow_up_at"],
  ];

  let failed = envChecks.some((check) => !check.ok);

  for (const [table, selectClause] of tableChecks) {
    const result = await verifyTable(supabaseUrl, serverKey, table, selectClause);
    logCheck(`Table ${table}`, result.ok, result.detail);
    if (!result.ok) {
      failed = true;
    }
  }

  if (failed) {
    console.error("\\nVerification failed. Review env vars and run supabase/schema.sql in your Supabase project.");
    process.exit(1);
  }

  console.log(
    "\\nSupabase CRM verification passed. You can now start the app, visit /login, and sign in with your first admin user."
  );
}

main().catch((error) => {
  console.error(`[FAIL] Unexpected error - ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
EOF

node --env-file=.env.local -e "$JS"
