/**
 * Portal Authentication Gate for Stage, Admin & Voting Pages
 * Password Protected with "y26freshers"
 */
(function() {
  const AUTH_KEY = 'portal_access_auth_y26';
  const SECRET = 'y26freshers';

  // If already authenticated in this session, allow instant access
  if (sessionStorage.getItem(AUTH_KEY) === SECRET) {
    return;
  }

  // Hide page contents immediately until unlocked
  const lockStyle = document.createElement('style');
  lockStyle.id = 'authLockStyle';
  lockStyle.textContent = `
    body.auth-locked > *:not(#authGuardOverlay) {
      display: none !important;
    }
  `;
  document.head.appendChild(lockStyle);
  document.documentElement.classList.add('auth-locked');
  if (document.body) document.body.classList.add('auth-locked');

  function initAuthGuard() {
    if (sessionStorage.getItem(AUTH_KEY) === SECRET) {
      unlockPage();
      return;
    }

    if (document.body) document.body.classList.add('auth-locked');

    // Create Modal Overlay
    const overlay = document.createElement('div');
    overlay.id = 'authGuardOverlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: radial-gradient(circle at 50% 30%, #1e1b4b 0%, #090814 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      box-sizing: border-box;
    `;

    overlay.innerHTML = `
      <div style="
        background: rgba(22, 18, 52, 0.88);
        border: 1px solid rgba(245, 158, 11, 0.4);
        border-radius: 20px;
        padding: 2.5rem 2rem;
        width: 100%;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 35px rgba(245, 158, 11, 0.15);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      ">
        <div style="font-size: 2.8rem; margin-bottom: 0.75rem;">🔒</div>
        <h2 style="color: #ffffff; font-size: 1.4rem; font-weight: 800; margin: 0 0 0.4rem; font-family: 'Outfit', sans-serif;">
          Restricted Console Access
        </h2>
        <p style="color: #94a3b8; font-size: 0.88rem; margin: 0 0 1.75rem;">
          Enter host authorization password to continue
        </p>

        <form id="authGuardForm" style="display: flex; flex-direction: column; gap: 0.85rem;">
          <input 
            type="password" 
            id="authPasswordInput" 
            autocomplete="current-password"
            placeholder="Enter password..." 
            style="
              width: 100%;
              padding: 0.9rem 1.1rem;
              background: rgba(10, 8, 26, 0.85);
              border: 1px solid rgba(255, 255, 255, 0.18);
              border-radius: 12px;
              color: #ffffff;
              font-size: 1rem;
              outline: none;
              text-align: center;
              box-sizing: border-box;
              transition: border-color 0.2s;
            "
          />
          <div id="authErrorMessage" style="color: #f87171; font-size: 0.82rem; font-weight: 600; min-height: 18px; display: none;"></div>
          <button 
            type="submit" 
            id="btnUnlockConsole"
            style="
              width: 100%;
              padding: 0.9rem;
              background: linear-gradient(135deg, #f59e0b, #d97706);
              border: none;
              border-radius: 12px;
              color: #000000;
              font-weight: 800;
              font-size: 1rem;
              cursor: pointer;
              transition: transform 0.15s ease, box-shadow 0.15s ease;
              box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);
            "
          >
            Unlock Console &rarr;
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const form = document.getElementById('authGuardForm');
    const input = document.getElementById('authPasswordInput');
    const errorMsg = document.getElementById('authErrorMessage');

    setTimeout(() => { if (input) input.focus(); }, 150);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = (input.value || '').trim();
      if (val === SECRET) {
        sessionStorage.setItem(AUTH_KEY, SECRET);
        unlockPage();
      } else {
        errorMsg.style.display = 'block';
        errorMsg.textContent = '✕ Incorrect password. Access denied.';
        input.style.borderColor = '#ef4444';
        input.value = '';
        input.focus();
      }
    });
  }

  function unlockPage() {
    const overlay = document.getElementById('authGuardOverlay');
    if (overlay) {
      overlay.style.transition = 'opacity 0.25s ease';
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.remove(); }, 250);
    }
    const style = document.getElementById('authLockStyle');
    if (style) style.remove();
    document.documentElement.classList.remove('auth-locked');
    if (document.body) document.body.classList.remove('auth-locked');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthGuard);
  } else {
    initAuthGuard();
  }
})();
