import { createClient } from "@supabase/supabase-js";
import { internalEmailForUsername } from "../src/lib/auth/internal-identifier.ts";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "BOOTSTRAP_ADMIN_USERNAME",
  "BOOTSTRAP_ADMIN_FULL_NAME",
  "BOOTSTRAP_ADMIN_PASSWORD",
];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);

const username = process.env.BOOTSTRAP_ADMIN_USERNAME;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!/^\d{7}$/.test(username)) throw new Error("BOOTSTRAP_ADMIN_USERNAME must contain exactly 7 digits.");
if (password.length < 16 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 16 characters and include uppercase, lowercase, a number, and a symbol.");
}
if (password === username) throw new Error("Admin password must never match the username.");

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data, error } = await supabase.auth.admin.createUser({
  email: internalEmailForUsername(username),
  password,
  email_confirm: true,
  app_metadata: { account_type: "work_reporting", bootstrap_admin: true },
});
if (error || !data.user) throw error ?? new Error("Auth user was not created.");

const userId = data.user.id;
const { error: profileError } = await supabase.from("profiles").insert({
  user_id: userId,
  username,
  full_name: process.env.BOOTSTRAP_ADMIN_FULL_NAME,
  position: process.env.BOOTSTRAP_ADMIN_POSITION || null,
  department_id: process.env.BOOTSTRAP_ADMIN_DEPARTMENT_ID || null,
  must_change_password: false,
  is_active: true,
});
const { error: roleError } = profileError ? { error: null } : await supabase.from("user_roles").insert({
  user_id: userId,
  role: "admin",
  scoped_department_id: process.env.BOOTSTRAP_ADMIN_DEPARTMENT_ID || null,
});
if (profileError || roleError) {
  await supabase.auth.admin.deleteUser(userId);
  throw profileError ?? roleError;
}

process.stdout.write(`Bootstrap Admin created: ${username}\n`);
