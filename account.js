(() => {
  const client = window.ARA_SUPABASE_CLIENT;
  const $ = (id) => document.getElementById(id);
  const emailForm = $('emailForm');
  let pendingEmail = '';
  const say = (message, error = false) => {
    $('authMessage').textContent = message;
    $('authMessage').style.color = error ? '#a33b2f' : '#55735b';
  };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  if (!client) {
    say('Authentication is not configured. Check supabase-config.js and ensure the Supabase client script loads.', true);
    $('sendCode').disabled = true;
    return;
  }

  async function sendMagicLink(email) {
    pendingEmail = email.trim().toLowerCase();
    if (!pendingEmail) return;
    say('Sending your sign-in link…');
    $('sendCode').disabled = true;
    try {
      const redirectTo = `${location.origin}${location.pathname}`;
      const { error } = await client.auth.signInWithOtp({
        email: pendingEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo
        }
      });
      if (error) throw error;
      say(`We sent a sign-in link to ${pendingEmail}. Open the email and click the link to finish signing in. Check spam if it doesn't arrive.`);
    } catch (error) {
      say(error.message || 'Could not send the sign-in link. Please try again.', true);
    } finally {
      $('sendCode').disabled = false;
    }
  }

  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await sendMagicLink($('emailInput').value);
  });

  async function loadOrders(user) {
    const host = $('myOrders');
    host.innerHTML = '<p class="account-note">Loading orders…</p>';
    const { data, error } = await client.from('orders')
      .select('id,order_number,created_at,total_amount,order_status,payment_status,tracking_number')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (error) {
      host.innerHTML = `<p class="account-note">Order history is not enabled yet. Apply the account-orders SQL migration and ensure checkout links signed-in orders. (${esc(error.message)})</p>`;
      return;
    }
    if (!data?.length) {
      host.innerHTML = '<p class="account-note">No orders linked to this account yet. Orders placed as a guest are not automatically linked.</p>';
      return;
    }
    host.innerHTML = data.map(o => `<article class="account-order"><h3>${esc(o.order_number || 'Order')}</h3><p>Placed ${o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : '—'} · <strong>₹${Number(o.total_amount || 0).toLocaleString('en-IN')}</strong></p><p>Status: <strong>${esc(o.order_status || 'pending')}</strong> · Payment: ${esc(o.payment_status || 'pending')}</p>${o.tracking_number ? `<p>Tracking number: ${esc(o.tracking_number)}</p>` : ''}</article>`).join('');
  }

  async function refreshSession() {
    const { data, error } = await client.auth.getSession();
    if (error) say(error.message, true);
    const session = data?.session;
    if (!session?.user) {
      $('authPanel').classList.remove('account-hidden');
      $('signedInPanel').classList.add('account-hidden');
      return;
    }
    $('authPanel').classList.add('account-hidden');
    $('signedInPanel').classList.remove('account-hidden');
    $('pageTitle').textContent = 'Your ARA account';
    $('introText').textContent = 'You are signed in. View your order history and manage your shopping experience.';
    $('signedInEmail').textContent = `Signed in as ${session.user.email || ''}`;
    await loadOrders(session.user);
  }

  // Support the PKCE callback format if Supabase returns ?code=... . The standard
  // Supabase JS client also processes supported auth URL fragments automatically.
  async function handleAuthCallback() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code) {
      say('Finishing sign-in…');
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) {
        say(`This sign-in link may have expired or already been used. Request a new one. (${error.message})`, true);
        return;
      }
      history.replaceState({}, document.title, location.pathname);
      say('You are signed in successfully.');
    } else if (location.hash.includes('error=')) {
      const hashParams = new URLSearchParams(location.hash.slice(1));
      say(hashParams.get('error_description') || 'The sign-in link could not be verified. Request a new one.', true);
    }
    await refreshSession();
  }

  $('refreshOrders').addEventListener('click', refreshSession);
  $('signOut').addEventListener('click', async () => {
    const { error } = await client.auth.signOut();
    if (error) say(error.message, true);
    else {
      $('pageTitle').textContent = 'Sign in or create an account';
      $('introText').textContent = "Enter your email and we'll send you a secure sign-in link. No password required.";
      $('emailInput').value = '';
      say('You have signed out.');
      await refreshSession();
    }
  });
  client.auth.onAuthStateChange(() => { setTimeout(refreshSession, 0); });
  handleAuthCallback().catch(error => say(error.message || 'Could not complete sign-in.', true));
})();
