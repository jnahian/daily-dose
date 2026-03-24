export default function AdminLogin() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');

  const errorMessages: Record<string, string> = {
    not_authorized: 'Your Slack account does not have admin access.',
    not_registered: 'Your Slack account is not registered in this workspace.',
    oauth_failed: 'Slack authentication failed. Please try again.',
    invalid_state: 'Invalid OAuth state. Please try again.',
    oauth_denied: 'Slack OAuth was denied. Please try again.',
  };

  return (
    <div className="min-h-screen bg-[#0a0f16] flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-white/10 rounded-2xl p-8 w-full max-w-sm text-center">
        <div className="mb-6">
          <img src="/logo.png" alt="Daily Dose" className="w-16 h-16 mx-auto mb-3 rounded-2xl" />
          <span className="text-[#00CFFF] font-bold text-2xl">Daily Dose</span>
          <p className="text-white/40 text-sm mt-1">Admin Dashboard</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {errorMessages[error] || 'An error occurred. Please try again.'}
          </div>
        )}

        <a
          href="/api/admin/auth/slack"
          className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-black font-semibold rounded-xl transition-colors text-sm"
        >
          Sign in with Slack
        </a>

        <p className="mt-4 text-xs text-white/20">
          Only organization admins and super admins can access this dashboard.
        </p>
      </div>
    </div>
  );
}
