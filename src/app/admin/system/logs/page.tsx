import { supabaseServer } from '@/lib/supabase/server';
import { SystemLogsView } from './SystemLogsView';

export const metadata = {
  title: 'System Logs | Admin',
};

async function getSystemLogs() {
  // Fetch last 200 activity_log entries
  const { data: activityLogs, error: activityError } = await supabaseServer
    .from('activity_log')
    .select('*, orders(order_title, token)')
    .order('created_at', { ascending: false })
    .limit(200);

  // Fetch last 200 email_attempts entries
  const { data: emailAttempts, error: emailError } = await supabaseServer
    .from('email_attempts')
    .select('*, orders(order_title, token)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (activityError) {
    console.error('Failed to fetch activity logs:', activityError);
  }

  if (emailError) {
    console.error('Failed to fetch email attempts:', emailError);
  }

  return {
    activityLogs: activityLogs || [],
    emailAttempts: emailAttempts || [],
  };
}

export default async function SystemLogsPage() {
  const { activityLogs, emailAttempts } = await getSystemLogs();

  return (
    <SystemLogsView
      activityLogs={activityLogs}
      emailAttempts={emailAttempts}
    />
  );
}
