(() => {
  const client = window.ARA_SUPABASE_CLIENT;
  const $ = (id) => document.getElementById(id);
  const emailForm = $('emailForm'), verifyForm = $('verifyForm');
  let pendingEmail = '';
  const say = (message, error = false) => { $('authMessage').textContent = message; $('authMessage').style.color = error ? '#a33b2f' : '#55735b'; };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if (!client) { say('Authentication is not configured. Check supabase-config.js and ensure the Supabase client script loads.', true); $('sendCode').disabled = true; return; }

  async function sendCode(email) {
    pendingEmail = email.trim().toLowerCase();
    say('Sending verification email…'); $('sendCode').disabled = true;
    const { error } = await client.auth.signInWithOtp({ email: pendingEmail, options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}${location.pathname}` } });
    $('sendCode').disabled = false;
    if (error) { say(error.message, true); return; }
    emailForm.classList.add('account-hidden'); verifyForm.classList.remove('account-hidden');
    say(`A verification code has been sent to ${pendingEmail}. Check your inbox and spam folder.`);
  }
  emailForm.addEventListener('submit', async e => { e.preventDefault(); await sendCode($('emailInput').value); });
  $('resendCode').addEventListener('click', () => sendCode(pendingEmail || $('emailInput').value));
  verifyForm.addEventListener('submit', async e => {
    e.preventDefault(); const token = $('otpInput').value.trim(); if (!pendingEmail || !token) return;
    say('Verifying code…');
    const { error } = await client.auth.verifyOtp({ email: pendingEmail, token, type: 'email' });
    if (error) { say(error.message, true); return; }
    say('Email verified. You are signed in.'); await refreshSession();
  });
  async function loadOrders(user) {
    const host = $('myOrders'); host.innerHTML = '<p class="account-note">Loading orders…</p>';
    // Only orders linked to this authenticated user are queried. Existing guest orders are not exposed.
    const { data, error } = await client.from('orders').select('id,order_number,created_at,total_amount,order_status,payment_status,tracking_number').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (error) { host.innerHTML = `<p class="account-note">Order history is not enabled yet. Apply the account-orders SQL migration included with this project. (${esc(error.message)})</p>`; return; }
    if (!data?.length) { host.innerHTML = '<p class="account-note">No orders linked to this account yet. Place an order while signed in to see it here.</p>'; return; }
    host.innerHTML = data.map(o => `<article class="account-order"><h3>${esc(o.order_number || 'Order')}</h3><p>Placed ${o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : '—'} · <strong>₹${Number(o.total_amount || 0).toLocaleString('en-IN')}</strong></p><p>Status: <strong>${esc(o.order_status || 'pending')}</strong> · Payment: ${esc(o.payment_status || 'pending')}</p>${o.tracking_number ? `<p>Tracking number: ${esc(o.tracking_number)}</p>` : ''}</article>`).join('');
  }
  async function refreshSession() {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) { $('authPanel').classList.remove('account-hidden'); $('signedInPanel').classList.add('account-hidden'); return; }
    $('authPanel').classList.add('account-hidden'); $('signedInPanel').classList.remove('account-hidden');
    $('pageTitle').textContent = 'Your ARA account'; $('introText').textContent = 'You are signed in. View your order history and manage your shopping experience.'; $('signedInEmail').textContent = `Signed in as ${session.user.email || ''}`;
    await loadOrders(session.user);
  }
  $('refreshOrders').addEventListener('click', refreshSession);
  $('signOut').addEventListener('click', async () => { const { error } = await client.auth.signOut(); if (error) say(error.message, true); else { $('pageTitle').textContent = 'Sign in or create an account'; $('introText').textContent = "Enter your email and we'll send you a one-time verification code. No password required."; emailForm.classList.remove('account-hidden'); verifyForm.classList.add('account-hidden'); $('otpInput').value = ''; say('You have signed out.'); await refreshSession(); } });
  client.auth.onAuthStateChange((_event, _session) => { setTimeout(refreshSession, 0); });
  refreshSession();
})();
