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
const fullName = process.env.BOOTSTRAP_ADMIN_FULL_NAME;
const position = process.env.BOOTSTRAP_ADMIN_POSITION || null;
const departmentId = process.env.BOOTSTRAP_ADMIN_DEPARTMENT_ID || null;
const email = internalEmailForUsername(username);
if (!/^\d{7}$/.test(username)) throw new Error("BOOTSTRAP_ADMIN_USERNAME must contain exactly 7 digits.");
if (password.length < 16 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 16 characters and include uppercase, lowercase, a number, and a symbol.");
}
if (password === username) throw new Error("Admin password must never match the username.");

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function verifyAdmin(userId) {
  const [authResult, profileResult, roleResult] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase
      .from("profiles")
      .select("username, full_name, position, department_id, must_change_password, is_active")
      .eq("user_id", userId)
      .single(),
    supabase
      .from("user_roles")
      .select("role, scoped_department_id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single(),
  ]);
  if (authResult.error || profileResult.error || roleResult.error) {
    throw authResult.error ?? profileResult.error ?? roleResult.error;
  }

  const authUser = authResult.data.user;
  const profile = profileResult.data;
  const role = roleResult.data;
  if (
    authUser.email !== email
    || authUser.app_metadata?.account_type !== "work_reporting"
    || profile.username !== username
    || profile.full_name !== fullName
    || profile.position !== position
    || profile.department_id !== departmentId
    || profile.must_change_password !== true
    || profile.is_active !== true
    || role.role !== "admin"
    || role.scoped_department_id !== departmentId
  ) {
    throw new Error("Bootstrap Admin verification failed.");
  }
}

const { data: existingProfile, error: existingProfileError } = await supabase
  .from("profiles")
  .select("user_id")
  .eq("username", username)
  .maybeSingle();
if (existingProfileError) throw existingProfileError;
if (existingProfile) {
  await verifyAdmin(existingProfile.user_id);
  process.stdout.write(`Bootstrap Admin already exists and was verified: ${username} (admin, password change required)\n`);
  process.exit(0);
}

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { account_type: "work_reporting", bootstrap_admin: true },
});
if (error || !data.user) throw error ?? new Error("Auth user was not created.");

const userId = data.user.id;
const { error: profileError } = await supabase.from("profiles").insert({
  user_id: userId,
  username,
  full_name: fullName,
  position,
  department_id: departmentId,
  must_change_password: true,
  is_active: true,
});
const { error: roleError } = profileError ? { error: null } : await supabase.from("user_roles").insert({
  user_id: userId,
  role: "admin",
  scoped_department_id: departmentId,
});
if (profileError || roleError) {
  await supabase.auth.admin.deleteUser(userId);
  throw profileError ?? roleError;
}

await verifyAdmin(userId);

process.stdout.write(`Bootstrap Admin created and verified: ${username} (admin, password change required)\n`);
