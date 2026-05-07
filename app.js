'use strict';
/* ============================================================
   Hive Dashboard — app.js
   Talks to the Hive JSON-RPC API (api.hive.blog)
   ============================================================ */

const API_URL = 'https://api.hive.blog';

// ── API helpers ──────────────────────────────────────────────

async function rpc(method, params) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'API error');
  return data.result;
}

async function getAccount(username) {
  const result = await rpc('condenser_api.get_accounts', [[username]]);
  if (!result || result.length === 0) throw new Error(`Account "@${username}" not found`);
  return result[0];
}

async function getBlog(username, limit = 12) {
  return rpc('condenser_api.get_blog', [username, 0, limit]);
}

async function getFollowCount(username) {
  return rpc('condenser_api.get_follow_count', [username]);
}

// ── Maths & formatting ──────────────────────────────────────

function parseAsset(str) {
  return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
}

function fmt(num, decimals = 3) {
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function vestingToHP(vests, totalVestingFund, totalVestingShares) {
  return (parseAsset(vests) * parseAsset(totalVestingFund)) / parseAsset(totalVestingShares);
}

function calcVotingPower(account) {
  const last     = account.voting_manabar.last_update_time;
  const current  = account.voting_manabar.current_mana;
  const max      = parseInt(account.post_voting_power) || 0;
  const now      = Math.floor(Date.now() / 1000);
  const elapsed  = now - last;
  const regen    = (elapsed * max) / 432000;
  const vp       = Math.min(current + regen, max);
  return max > 0 ? Math.min(100, (vp / max) * 100) : 100;
}

function ago(dateStr) {
  const diff = Date.now() - new Date(dateStr + 'Z').getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m/60)}h ago`;
  return `${Math.floor(m/1440)}d ago`;
}

// ── DOM helpers ─────────────────────────────────────────────

const $  = id => document.getElementById(id);
const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };

function showScreen(name) {
  ['idle', 'loading', 'error'].forEach(s => {
    $(`screen-${s}`)?.classList.toggle('hidden', s !== name);
  });
  $('dashboard')?.classList.toggle('hidden', name !== 'dashboard');
}

function setError(msg) {
  set('error-message', msg);
  showScreen('error');
}

// ── Render ──────────────────────────────────────────────────

function renderProfile(account, followCount) {
  const meta   = account.json_metadata ? JSON.parse(account.json_metadata || '{}') : {};
  const profile = meta.profile || {};
  const avatar  = profile.profile_image || `https://images.hive.blog/u/${account.name}/avatar/small`;

  $('profile-avatar').src = avatar;
  $('profile-avatar').onerror = () => { $('profile-avatar').src = 'https://images.hive.blog/DQmb2DQKM1UJpBxkAtkDrRK2gGSBkBJYBR7MFRmz1PEeE7s/default.png'; };
  set('profile-name',     profile.name || account.name);
  set('profile-username', `@${account.name}`);
  set('profile-bio',      profile.about || '');
  set('meta-followers',   followCount.follower_count?.toLocaleString() || '—');
  set('meta-following',   followCount.following_count?.toLocaleString() || '—');
  set('meta-posts',       account.post_count?.toLocaleString() || '—');
}

function renderBalances(account, globalProps) {
  const hive  = parseAsset(account.balance);
  const hbd   = parseAsset(account.hbd_balance);
  const hp    = vestingToHP(
    account.vesting_shares,
    globalProps.total_vesting_fund_hive,
    globalProps.total_vesting_shares
  );
  const vp    = calcVotingPower(account);

  set('bal-hive', `${fmt(hive, 3)} HIVE`);
  set('bal-hp',   `${fmt(hp,   3)} HP`);
  set('bal-hbd',  `${fmt(hbd,  3)} HBD`);
  set('bal-vp',   `${vp.toFixed(1)}%`);

  setTimeout(() => {
    const bar = $('vp-bar-fill');
    if (bar) {
      bar.style.width = vp + '%';
      bar.style.background = vp > 80
        ? 'linear-gradient(90deg,#3dc97a,#86efac)'
        : vp > 40
          ? 'linear-gradient(90deg,#e2b714,#fde68a)'
          : 'linear-gradient(90deg,#ff4d4d,#fca5a5)';
    }
  }, 100);
}

function renderPosts(blogEntries) {
  const grid   = $('posts-grid');
  const count  = $('posts-count');
  grid.innerHTML = '';

  // Filter out reblogs
  const own = blogEntries
    .filter(e => e.blog === e.comment.author)
    .map(e => e.comment)
    .slice(0, 9);

  if (count) count.textContent = `${own.length} recent`;

  if (own.length === 0) {
    grid.innerHTML = '<p style="color:var(--muted);font-size:14px;">No recent posts found.</p>';
    return;
  }

  own.forEach(post => {
    let meta = {};
    try { meta = JSON.parse(post.json_metadata || '{}'); } catch (_) {}
    const tags    = meta.tags || [];
    const payout  = (parseAsset(post.pending_payout_value) + parseAsset(post.total_payout_value)).toFixed(2);
    const link    = `https://hive.blog/@${post.author}/${post.permlink}`;

    const card = document.createElement('a');
    card.href  = link;
    card.target = '_blank';
    card.rel   = 'noopener noreferrer';
    card.className = 'post-card';
    card.innerHTML = `
      <div class="post-tag">${tags[0] || 'hive'}</div>
      <div class="post-title">${escHtml(post.title || '(Untitled)')}</div>
      <div class="post-body">${escHtml(truncate(post.body || '', 120))}</div>
      <div class="post-meta">
        <span>${ago(post.created)}</span>
        <span class="post-payout">$${payout}</span>
      </div>`;
    grid.appendChild(card);
  });
}

// ── Main load ────────────────────────────────────────────────

async function loadAccount(username) {
  if (!username.trim()) return;
  username = username.trim().toLowerCase().replace(/^@/, '');

  showScreen('loading');

  try {
    set('loading-text', `Fetching @${username}...`);

    const [account, globalProps, followCount, blog] = await Promise.all([
      getAccount(username),
      rpc('condenser_api.get_dynamic_global_properties', []),
      getFollowCount(username),
      getBlog(username, 12),
    ]);

    renderProfile(account, followCount);
    renderBalances(account, globalProps);
    renderPosts(blog);

    set('last-updated', `Updated ${new Date().toLocaleTimeString()}`);
    showScreen('dashboard');

  } catch (err) {
    setError(err.message || 'Failed to load account.');
  }
}

// ── Utilities ────────────────────────────────────────────────

function truncate(str, n) {
  const plain = str.replace(/[#*_`[\]()>!~\-]/g, '').replace(/\n/g, ' ');
  return plain.length > n ? plain.slice(0, n) + '…' : plain;
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Events ──────────────────────────────────────────────────

$('search-form').addEventListener('submit', e => {
  e.preventDefault();
  loadAccount($('username-input').value);
});

document.querySelectorAll('.example-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const user = btn.dataset.user;
    $('username-input').value = user;
    loadAccount(user);
  });
});

function resetUI() {
  $('username-input').value = '';
  showScreen('idle');
}

// ── Boot ─────────────────────────────────────────────────────

// Auto-load from URL param: ?user=missquibble
const urlUser = new URLSearchParams(location.search).get('user');
if (urlUser) {
  $('username-input').value = urlUser;
  loadAccount(urlUser);
}
