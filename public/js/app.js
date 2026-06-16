// -------------------------------------------------------------------------
// TOP-OF-SCREEN GLASSMORPHIC TOAST NOTIFICATIONS
// -------------------------------------------------------------------------
function showToast(message, type = 'success', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  
  let iconHtml = '';
  if (type === 'success') {
    iconHtml = '<i data-lucide="check-circle-2" style="color: #10b981; width: 18px; height: 18px;"></i>';
  } else if (type === 'error' || type === 'danger') {
    iconHtml = '<i data-lucide="alert-triangle" style="color: #ef4444; width: 18px; height: 18px;"></i>';
  } else if (type === 'warning') {
    iconHtml = '<i data-lucide="alert-circle" style="color: #f59e0b; width: 18px; height: 18px;"></i>';
  } else {
    iconHtml = '<i data-lucide="info" style="color: #3b82f6; width: 18px; height: 18px;"></i>';
  }

  toast.innerHTML = `
    <div class="toast-icon">${iconHtml}</div>
    <div class="toast-content">${message}</div>
    <button class="toast-dismiss" style="background:none; border:none; color:rgba(255,255,255,0.4); font-size:18px; cursor:pointer; line-height:1; padding-left:10px;">&times;</button>
  `;

  container.appendChild(toast);
  
  if (window.lucide) {
    window.lucide.createIcons();
  }

  const dismissToast = () => {
    toast.style.transform = 'translateY(-20px)';
    toast.style.opacity = '0';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => {
      toast.remove();
    }, 250);
  };

  toast.querySelector('.toast-dismiss').onclick = dismissToast;

  if (duration > 0) {
    setTimeout(dismissToast, duration);
  }
}

// -------------------------------------------------------------------------
// BEAUTIFUL GLASSMORPHISM CUSTOM MODAL ALERT & CONFIRM DIALOGS
// -------------------------------------------------------------------------
function showAlert(message, title = "System Notification", type = "info", callback = null) {
  const modalId = 'dynamic-custom-alert';
  let modalEl = document.getElementById(modalId);
  if (modalEl) {
    modalEl.remove();
  }
  
  modalEl = document.createElement('div');
  modalEl.id = modalId;
  modalEl.className = 'modal active';
  modalEl.style.zIndex = '999999';
  modalEl.style.position = 'fixed';
  modalEl.style.top = '0';
  modalEl.style.left = '0';
  modalEl.style.width = '100vw';
  modalEl.style.height = '100vh';
  modalEl.style.background = 'rgba(2, 2, 4, 0.75)';
  modalEl.style.backdropFilter = 'blur(16px)';
  modalEl.style.webkitBackdropFilter = 'blur(16px)';
  modalEl.style.display = 'flex';
  modalEl.style.alignItems = 'center';
  modalEl.style.justifyContent = 'center';
  
  let iconHtml = '<i data-lucide="info" style="color: #3b82f6; width: 32px; height: 32px;"></i>';
  let alertBorderColor = 'rgba(59, 130, 246, 0.25)';
  
  const lowercase = String(message).toLowerCase();
  if (type === 'error' || type === 'danger' || lowercase.includes("failed") || lowercase.includes("out of stock") || lowercase.includes("cannot")) {
    iconHtml = '<i data-lucide="alert-triangle" style="color: #ef4444; width: 32px; height: 32px;"></i>';
    alertBorderColor = 'rgba(239, 68, 68, 0.25)';
    if (title === 'System Notification' || title === 'Notification') title = 'Action Blocked';
  } else if (type === 'success' || lowercase.includes("successful") || lowercase.includes("authorized") || lowercase.includes("complete") || lowercase.includes("created")) {
    iconHtml = '<i data-lucide="check-circle-2" style="color: #10b981; width: 32px; height: 32px;"></i>';
    alertBorderColor = 'rgba(16, 185, 129, 0.25)';
    if (title === 'System Notification' || title === 'Notification') title = 'Transaction Successful';
  } else if (type === 'warning' || type === 'warn') {
    iconHtml = '<i data-lucide="alert-circle" style="color: #f59e0b; width: 32px; height: 32px;"></i>';
    alertBorderColor = 'rgba(245, 158, 11, 0.25)';
    if (title === 'System Notification' || title === 'Notification') title = 'Attention Warn';
  }
  
  modalEl.innerHTML = `
    <div class="modal-content glass" style="max-width: 440px; padding: 32px; border-radius: 20px; text-align: center; border: 1px solid ${alertBorderColor}; box-shadow: 0 24px 60px rgba(0,0,0,0.65); background: rgba(9, 10, 15, 0.85); backdrop-filter: blur(24px); transform: scale(0.9); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 18px;">
        <div style="background: rgba(255,255,255,0.03); padding: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: inset 0 2px 8px rgba(255,255,255,0.05);">
          ${iconHtml}
        </div>
        <h2 class="modal-title" style="font-size: 20px; font-weight: 800; margin: 0; color: #fff; letter-spacing: -0.02em;">${title}</h2>
        <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.55; margin: 0 0 10px 0; word-break: break-word; white-space: pre-wrap;">${message}</p>
      </div>
      <div style="display: flex; gap: 12px; justify-content: center; margin-top: 24px;">
        <button id="custom-alert-ok-btn" class="btn btn-primary" style="padding: 11px 40px; font-weight: 700; min-width: 140px; border-radius: 12px; font-size: 14px; letter-spacing: -0.01em; transition: all 0.2s; box-shadow: 0 8px 24px rgba(59, 130, 246, 0.25);">Dismiss</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalEl);
  
  // Animate scale-in
  setTimeout(() => {
    const dialog = modalEl.querySelector('.modal-content');
    if (dialog) dialog.style.transform = 'scale(1)';
  }, 10);

  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  const okBtn = document.getElementById('custom-alert-ok-btn');
  if (okBtn) okBtn.focus();
  
  const cleanup = () => {
    const dialog = modalEl.querySelector('.modal-content');
    if (dialog) dialog.style.transform = 'scale(0.9)';
    modalEl.style.opacity = '0';
    modalEl.style.transition = 'opacity 0.15s ease-out';
    setTimeout(() => {
      modalEl.remove();
      if (callback) callback();
    }, 150);
  };
  
  okBtn.onclick = cleanup;
  modalEl.onclick = (e) => {
    if (e.target === modalEl) {
      cleanup();
    }
  };
}

function showConfirm(message, onConfirm, onCancel = null, title = "Confirmation Required") {
  const modalId = 'dynamic-custom-confirm';
  let modalEl = document.getElementById(modalId);
  if (modalEl) {
    modalEl.remove();
  }
  
  modalEl = document.createElement('div');
  modalEl.id = modalId;
  modalEl.className = 'modal active';
  modalEl.style.zIndex = '999998';
  modalEl.style.position = 'fixed';
  modalEl.style.top = '0';
  modalEl.style.left = '0';
  modalEl.style.width = '100vw';
  modalEl.style.height = '100vh';
  modalEl.style.background = 'rgba(2, 2, 4, 0.75)';
  modalEl.style.backdropFilter = 'blur(16px)';
  modalEl.style.webkitBackdropFilter = 'blur(16px)';
  modalEl.style.display = 'flex';
  modalEl.style.alignItems = 'center';
  modalEl.style.justifyContent = 'center';
  
  modalEl.innerHTML = `
    <div class="modal-content glass" style="max-width: 440px; padding: 32px; border-radius: 20px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 24px 60px rgba(0,0,0,0.65); background: rgba(9, 10, 15, 0.85); backdrop-filter: blur(24px); transform: scale(0.9); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 18px;">
        <div style="background: rgba(255,255,255,0.03); padding: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: inset 0 2px 8px rgba(255,255,255,0.052);">
          <i data-lucide="help-circle" style="color: #60a5fa; width: 32px; height: 32px;"></i>
        </div>
        <h2 class="modal-title" style="font-size: 20px; font-weight: 800; margin: 0; color: #fff; letter-spacing: -0.02em;">${title}</h2>
        <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.55; margin: 0 0 10px 0; word-break: break-word;">${message}</p>
      </div>
      <div style="display: flex; gap: 14px; justify-content: center; margin-top: 28px;">
        <button id="custom-confirm-cancel" class="btn" style="padding: 11px 28px; min-width: 110px; border-radius: 12px; font-size: 14px; font-weight: 500; font-family: inherit;">Cancel</button>
        <button id="custom-confirm-ok" class="btn btn-primary" style="padding: 11px 28px; min-width: 110px; border-radius: 12px; font-weight: 700; font-size: 14px; letter-spacing: -0.01em; font-family: inherit; box-shadow: 0 8px 24px rgba(59, 130, 246, 0.25);">Confirm</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalEl);
  
  setTimeout(() => {
    const dialog = modalEl.querySelector('.modal-content');
    if (dialog) dialog.style.transform = 'scale(1)';
  }, 10);

  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  const okBtn = document.getElementById('custom-confirm-ok');
  const cancelBtn = document.getElementById('custom-confirm-cancel');
  if (okBtn) okBtn.focus();
  
  const closeConfirm = (confirmed) => {
    const dialog = modalEl.querySelector('.modal-content');
    if (dialog) dialog.style.transform = 'scale(0.9)';
    modalEl.style.opacity = '0';
    modalEl.style.transition = 'opacity 0.15s ease-out';
    setTimeout(() => {
      modalEl.remove();
      if (confirmed) {
        if (onConfirm) onConfirm();
      } else {
        if (onCancel) onCancel();
      }
    }, 150);
  };
  
  okBtn.onclick = () => closeConfirm(true);
  cancelBtn.onclick = () => closeConfirm(false);
}

// Redirect standard window.alert calls to our custom toast notifications
window.alert = function(message) {
  const lowercase = String(message).toLowerCase();
  let type = 'info';
  if (lowercase.includes("failed") || lowercase.includes("error") || lowercase.includes("cannot") || lowercase.includes("limit reaching") || lowercase.includes("out of stock") || lowercase.includes("aborted")) {
    type = 'error';
  } else if (lowercase.includes("success") || lowercase.includes("authorized") || lowercase.includes("complete") || lowercase.includes("created") || lowercase.includes("registered") || lowercase.includes("updated") || lowercase.includes("overwritten") || lowercase.includes("deleted")) {
    type = 'success';
  } else if (lowercase.includes("warning") || lowercase.includes("danger") || lowercase.includes("alert")) {
    type = 'warning';
  }
  showToast(message, type);
};

// Deprecate synchronous confirm blocking prompts
window.confirm = function(message) {
  console.warn("Synchronous confirm() is deprecated in IMSO. Please use showConfirm().");
  showToast(message, "warning");
  return false;
};

// -------------------------------------------------------------------------
// GLOBAL RETRIEVABLE SESSION STATE
// -------------------------------------------------------------------------
let currentUser = null;
let currentPermissions = {};
let activeView = 'dashboard';
let categoriesList = [];
let productsList = [];
let cart = [];
let selectedProductForVariant = null; // helper state for variant modal
let acknowledgedAlerts = new Set(); // store dismissed alert displaySku IDs

// Inactivity and local sliding idle detection globals
let lastActiveTime = Date.now();
let lastHeartbeatTime = 0;
let userActivityTimeoutMinutes = 15; // default synced from settings
let idleCheckInterval = null;

// Password verification policy on client
function validatePasswordStrength(password) {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[0-9]/.test(password) && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return 'Password must contain at least one number or symbol.';
  }
  return null;
}

// Setup global fetch interceptor to catch expired sessions and forced lockouts
const originalFetch = window.fetch;
window.fetch = function(...args) {
  // Check if args[1] options are supplied
  if (args[1] === undefined) {
    args[1] = {};
  }
  if (args[1].headers === undefined) {
    args[1].headers = {};
  }
  
  // Attach x-active-user header if user has been active recently (within last 10 seconds) AND is logged in
  const now = Date.now();
  const isActiveRecently = currentUser && (now - lastActiveTime < 10000);
  if (isActiveRecently) {
    if (args[1].headers instanceof Headers) {
      args[1].headers.set('x-active-user', 'true');
    } else {
      args[1].headers['x-active-user'] = 'true';
    }
  }

  return originalFetch(...args).then(res => {
    if (res.status === 401) {
      currentUser = null;
      currentPermissions = {};
      teardownInactivityListeners();
      showLoginLayout();
      dismissSessionWarningToast();
      const url = args[0];
      if (typeof url === 'string' && !url.includes('/api/auth/session') && !url.includes('/api/auth/login')) {
        showToast('Your session has expired. Please log in again.', 'error');
      }
    } else if (res.status === 403) {
      return res.clone().json().then(data => {
        if (data.error === 'FORCED_PASSWORD_RESET' || data.code === 'PASSWORD_RESET_REQUIRED') {
          showForcedPasswordResetLayout();
        } else {
          showToast(data.error || 'Permission Denied', 'error');
          // Instantly refresh session/permissions to invalidate stale views
          checkSession();
        }
        return res;
      }).catch(() => res);
    }
    return res;
  });
};

function resetInactivityTimer() {
  if (!currentUser) return;
  
  const now = Date.now();
  lastActiveTime = now;
  dismissSessionWarningToast();

  // Throttled heartbeat to server: active-interaction ping at most once every 30 seconds
  if (now - lastHeartbeatTime > 30000) {
    lastHeartbeatTime = now;
    originalFetch('/api/auth/active-interaction', {
      headers: { 'x-active-user': 'true' }
    }).catch(() => {});
  }
}

function showSessionWarningToast(secondsLeft) {
  let existingWarning = document.querySelector('.toast-session-warning');
  const warningMsg = `Your session will expire in ${secondsLeft}s. Move mouse or press any key to stay logged in.`;
  
  if (existingWarning) {
    let content = existingWarning.querySelector('.toast-content');
    if (content) content.innerText = warningMsg;
  } else {
    const container = document.getElementById('toast-container');
    if (container) {
      const toast = document.createElement('div');
      toast.className = 'toast-item toast-warning toast-session-warning';
      toast.innerHTML = `
        <div class="toast-icon">
          <i data-lucide="alert-circle" style="color: #f59e0b; width: 18px; height: 18px;"></i>
        </div>
        <div class="toast-content" style="color: #fff; font-size: 13px; font-weight: 500;">${warningMsg}</div>
      `;
      container.appendChild(toast);
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

function dismissSessionWarningToast() {
  const existingWarning = document.querySelector('.toast-session-warning');
  if (existingWarning) {
    existingWarning.remove();
  }
}

function setupInactivityListeners() {
  lastActiveTime = Date.now();
  lastHeartbeatTime = Date.now();
  dismissSessionWarningToast();

  const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
  events.forEach(evt => {
    window.addEventListener(evt, resetInactivityTimer, { passive: true });
  });

  if (idleCheckInterval) {
    clearInterval(idleCheckInterval);
  }

  // Ticks every second to monitor idle duration and display warnings
  idleCheckInterval = setInterval(() => {
    if (!currentUser) return;

    const remainingMs = (userActivityTimeoutMinutes * 60 * 1000) - (Date.now() - lastActiveTime);
    
    if (remainingMs <= 0) {
      // Session has fully expired locally
      dismissSessionWarningToast();
      teardownInactivityListeners();
      showToast('Session has expired due to inactivity.', 'error');
      performLogout();
    } else if (remainingMs <= 60000) {
      // 1 minute or less remaining, show warning countdown feedback
      const secondsLeft = Math.ceil(remainingMs / 1000);
      showSessionWarningToast(secondsLeft);
    } else {
      // More than 1 minute remaining, keep countdown hidden
      dismissSessionWarningToast();
    }
  }, 1000);
}

function teardownInactivityListeners() {
  const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
  events.forEach(evt => {
    window.removeEventListener(evt, resetInactivityTimer);
  });
  if (idleCheckInterval) {
    clearInterval(idleCheckInterval);
    idleCheckInterval = null;
  }
  dismissSessionWarningToast();
}

// -------------------------------------------------------------------------
// INITIALIZATION ON WINDOW LOAD
// -------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  checkSession();
  
  // Bind form listeners
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('forced-password-form').addEventListener('submit', handleForcedPasswordReset);
  document.getElementById('cat-modal-form').addEventListener('submit', createCategory);
  document.getElementById('prod-modal-form').addEventListener('submit', createProduct);
  document.getElementById('restock-form').addEventListener('submit', saveRestock);
  document.getElementById('adjustment-form').addEventListener('submit', saveAdjustment);
  document.getElementById('edit-product-form').addEventListener('submit', saveEditProduct);
  document.getElementById('checkout-form').addEventListener('submit', handleCheckout);
  document.getElementById('return-request-form').addEventListener('submit', submitReturnRequest);
  document.getElementById('emp-modal-form').addEventListener('submit', createEmployee);
  document.getElementById('emp-reset-form').addEventListener('submit', resetEmployeePassword);
  document.getElementById('profile-form').addEventListener('submit', updateMyProfile);
  document.getElementById('shop-settings-form').addEventListener('submit', updateShopSettings);
  document.getElementById('report-form').addEventListener('submit', generateReport);

  // Global Modal Backdrop Click Handler (Close on backdrop click for non-confirmation modals)
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal') && e.target.classList.contains('active')) {
      const modalId = e.target.id;
      // Do NOT close confirmation or onboarding modals on backdrop click
      if (modalId === 'dynamic-custom-confirm' || modalId === 'modal-onboarding') return;

      // Close if it's a standard modal or the alert overlay (alert allows backdrop close)
      if (modalId === 'dynamic-custom-alert') {
        const okBtn = document.getElementById('custom-alert-ok-btn');
        if (okBtn) okBtn.click();
      } else {
        closeModal(modalId);
      }
    }
  });

  // Auto trigger alerts check every 25 seconds
  setInterval(checkLowStockAlerts, 25000);
});

// -------------------------------------------------------------------------
// SESSION MANAGEMENT
// -------------------------------------------------------------------------
function routeUserToAllowedView() {
  if (currentUser.role_type === 'owner') {
    switchView('dashboard');
    return;
  }
  
  if (currentPermissions.can_view_dashboard === 1) {
    switchView('dashboard');
  } else if (currentPermissions.can_sell === 1) {
    switchView('pos');
  } else if (currentPermissions.can_manage_products === 1 || currentPermissions.can_manage_categories === 1) {
    switchView('inventory');
  } else if (currentPermissions.can_approve_returns === 1 || currentPermissions.can_create_returns === 1) {
    switchView('returns');
  } else if (currentPermissions.can_view_reports === 1) {
    switchView('reports');
  } else if (currentPermissions.can_manage_employees === 1) {
    switchView('employees');
  } else if (currentPermissions.can_view_audit_logs === 1) {
    switchView('audit');
  } else if (currentPermissions.can_manage_backups === 1) {
    switchView('backups');
  } else {
    switchView('settings');
  }
}

function checkSession() {
  fetch('/api/auth/session')
    .then(res => res.json())
    .then(data => {
      if (data.authenticated) {
        currentUser = data.user;
        currentPermissions = data.permissions;
        if (data.sessionTimeoutMinutes) {
          userActivityTimeoutMinutes = data.sessionTimeoutMinutes;
        }
        
        if (currentUser.must_change_password === 1) {
          showForcedPasswordResetLayout();
          return;
        }

        showAppLayout();
        // Load initial data
        loadSettingsData();
        loadCategories();
        checkLowStockAlerts();
        
        checkOnboarding();
        routeUserToAllowedView();
      } else {
        showLoginLayout();
      }
    })
    .catch(err => {
      console.error('Session inquiry failed:', err);
      showLoginLayout();
    });
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');

  errorDiv.style.display = 'none';

  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      errorDiv.innerText = data.error;
      errorDiv.style.display = 'block';
    } else {
      currentUser = data.user;
      currentPermissions = data.permissions;
      if (data.sessionTimeoutMinutes) {
        userActivityTimeoutMinutes = data.sessionTimeoutMinutes;
      }

      if (currentUser.must_change_password === 1) {
        showForcedPasswordResetLayout();
        return;
      }

      showAppLayout();
      loadSettingsData();
      loadCategories();
      checkLowStockAlerts();

      routeUserToAllowedView();
    }
  })
  .catch(err => {
    errorDiv.innerText = 'Failed to connect to local PC backend server.';
    errorDiv.style.display = 'block';
  });
}

function performLogout() {
  fetch('/api/auth/logout', { method: 'POST' })
    .then(() => {
      currentUser = null;
      currentPermissions = {};
      teardownInactivityListeners();
      document.getElementById('forced-password-container').style.display = 'none';
      showLoginLayout();
    })
    .catch(() => {
      currentUser = null;
      currentPermissions = {};
      teardownInactivityListeners();
      document.getElementById('forced-password-container').style.display = 'none';
      showLoginLayout();
    });
}

// -------------------------------------------------------------------------
// LAYOUT TOGGLERS
// -------------------------------------------------------------------------
function showLoginLayout() {
  document.getElementById('login-container').style.display = 'flex';
  document.getElementById('app-layout').classList.remove('active');
  document.getElementById('forced-password-container').style.display = 'none';
  document.getElementById('login-form').reset();
}

function showForcedPasswordResetLayout() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('app-layout').classList.remove('active');
  document.getElementById('forced-password-container').style.display = 'flex';
  document.getElementById('forced-password-form').reset();
  document.getElementById('forced-password-error').style.display = 'none';
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function handleForcedPasswordReset(e) {
  e.preventDefault();
  const newPassword = document.getElementById('forced-new-password').value;
  const confirmPassword = document.getElementById('forced-confirm-password').value;
  const errorDiv = document.getElementById('forced-password-error');

  errorDiv.style.display = 'none';

  if (newPassword !== confirmPassword) {
    errorDiv.innerText = 'Passwords do not match.';
    errorDiv.style.display = 'block';
    return;
  }

  const strengthErr = validatePasswordStrength(newPassword);
  if (strengthErr) {
    errorDiv.innerText = strengthErr;
    errorDiv.style.display = 'block';
    return;
  }

  fetch('/api/auth/change-forced-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: newPassword, confirmPassword })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      errorDiv.innerText = data.error;
      errorDiv.style.display = 'block';
    } else {
      currentUser.must_change_password = 0;
      document.getElementById('forced-password-container').style.display = 'none';
      
      showToast('Password updated successfully. Access granted!', 'success');
      
      showAppLayout();
      loadSettingsData();
      loadCategories();
      checkOnboarding();
      checkLowStockAlerts();

      routeUserToAllowedView();
    }
  })
  .catch(err => {
    errorDiv.innerText = 'Failed to update password. Try again.';
    errorDiv.style.display = 'block';
  });
}

function showAppLayout() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('forced-password-container').style.display = 'none';
  const appLayout = document.getElementById('app-layout');
  appLayout.classList.add('active');

  // Update profile badges
  document.getElementById('display-user-fullname').innerText = currentUser.full_name;
  document.getElementById('display-user-role').innerText = currentUser.role_type;
  
  // Set avatar initials or letters
  const letters = currentUser.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('avatar-letters').innerText = letters;

  // Render navigation buttons according to permission flags
  toggleSidebarLinks();

  // Setup client idle detection and countdown
  setupInactivityListeners();
  resetInactivityTimer();
}

function toggleSidebarLinks() {
  if (!currentUser) return;
  const isOwner = currentUser.role_type === 'owner';
  
  // Simple check helper
  const renderItem = (id, hasAccess) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = hasAccess ? 'block' : 'none';
    }
  };

  renderItem('nav-dashboard', isOwner || currentPermissions.can_view_dashboard === 1);
  renderItem('nav-pos', isOwner || currentPermissions.can_sell === 1);
  renderItem('nav-inventory', isOwner || currentPermissions.can_manage_products === 1 || currentPermissions.can_manage_categories === 1);
  renderItem('nav-returns', isOwner || currentPermissions.can_approve_returns === 1 || currentPermissions.can_create_returns === 1);
  renderItem('nav-employees', isOwner || currentPermissions.can_manage_employees === 1);
  renderItem('nav-reports', isOwner || currentPermissions.can_view_reports === 1);
  renderItem('nav-audit', isOwner || currentPermissions.can_view_audit_logs === 1);
  renderItem('nav-backups', isOwner || currentPermissions.can_manage_backups === 1);
  renderItem('nav-settings', true); // settings is always accessible so they can update their own password

  // Conditionally display creation action buttons on panels based on specific authorities
  renderItem('btn-new-category', isOwner || currentPermissions.can_manage_categories === 1);
  renderItem('btn-new-product', isOwner || currentPermissions.can_manage_products === 1);
  renderItem('btn-new-return', isOwner || currentPermissions.can_create_returns === 1);
  
  const sidebar = document.getElementById('sidebar');
  if (currentUser.role_type === 'employee' && currentPermissions.can_view_dashboard === 0 && currentPermissions.can_sell === 1) {
    sidebar.classList.add('collapsed');
    document.getElementById('display-shop-name').innerText = 'POS';
  } else {
    sidebar.classList.remove('collapsed');
  }
}

// -------------------------------------------------------------------------
// WORKSPACE NAVIGATION SWITCHER
// -------------------------------------------------------------------------
function switchView(viewName) {
  // Client-side permission guard for views to intercept direct dev tools switches
  if (currentUser && currentUser.role_type === 'employee') {
    let allowed = false;
    if (viewName === 'dashboard' && currentPermissions.can_view_dashboard === 1) allowed = true;
    else if (viewName === 'pos' && currentPermissions.can_sell === 1) allowed = true;
    else if (viewName === 'inventory' && (currentPermissions.can_manage_products === 1 || currentPermissions.can_manage_categories === 1)) allowed = true;
    else if (viewName === 'returns' && (currentPermissions.can_create_returns === 1 || currentPermissions.can_approve_returns === 1)) allowed = true;
    else if (viewName === 'employees' && currentPermissions.can_manage_employees === 1) allowed = true;
    else if (viewName === 'reports' && currentPermissions.can_view_reports === 1) allowed = true;
    else if (viewName === 'audit' && currentPermissions.can_view_audit_logs === 1) allowed = true;
    else if (viewName === 'backups' && currentPermissions.can_manage_backups === 1) allowed = true;
    else if (viewName === 'settings') allowed = true; // Profiling/password change is always open

    if (!allowed) {
      showToast('Access Denied: You do not have permission to view this page.', 'error');
      routeUserToAllowedView();
      return;
    }
  }

  activeView = viewName;
  
  // Highlight sidebar item
  document.querySelectorAll('.nav-item').forEach(li => li.classList.remove('active'));
  const activeLi = document.getElementById(`nav-${viewName}`);
  if (activeLi) activeLi.classList.add('active');

  // Activate view panel
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  const activePanel = document.getElementById(`panel-${viewName}`);
  if (activePanel) activePanel.classList.add('active');

  // Trigger loads
  if (viewName === 'dashboard') {
    fetchDashboardStats();
  } else if (viewName === 'pos') {
    loadPOS();
  } else if (viewName === 'inventory') {
    loadInventory();
  } else if (viewName === 'returns') {
    loadReturns();
  } else if (viewName === 'employees') {
    loadEmployees();
  } else if (viewName === 'reports') {
    resetReportsView();
  } else if (viewName === 'audit') {
    fetchAuditTrails();
  } else if (viewName === 'backups') {
    loadBackups();
  } else if (viewName === 'settings') {
    loadProfileDetails();
  }

  // Reload icons
  lucide.createIcons();
}

// -------------------------------------------------------------------------
// A. DASHBOARD LOAD STATS
// -------------------------------------------------------------------------
function fetchDashboardStats() {
  fetch('/api/dashboard/stats')
    .then(res => res.json())
    .then(data => {
      if (data.error) return;
      document.getElementById('kpi-revenue').innerText = `${data.total_revenue_today.toFixed(2)} ETB`;
      document.getElementById('kpi-profit').innerText = `${data.total_profit_today.toFixed(2)} ETB`;
      document.getElementById('kpi-lowstock').innerText = data.low_stock_count;
      document.getElementById('kpi-sales').innerText = data.total_sales_count;
      document.getElementById('dashboard-top-product').innerText = data.top_selling_product;

      // Handle champion employee card
      const championCard = document.getElementById('employee-champion-card');
      if (data.employee_count >= 2 && data.top_employee) {
        championCard.style.display = 'block';
        document.getElementById('champion-name').innerText = data.top_employee.name;
        document.getElementById('champion-tx').innerText = `${data.top_employee.tx_count} Checkouts (${data.top_employee.items_sold} items)`;
        document.getElementById('champion-revenue').innerText = `${data.top_employee.revenue.toFixed(2)} ETB`;
      } else {
        championCard.style.display = 'none';
      }
    });
}

// -------------------------------------------------------------------------
// B. POINT OF SALE (POS) ACTIONS
// -------------------------------------------------------------------------
let currentSelectedCategory = null;

function loadPOS() {
  // Populate category tabs
  const tabContainer = document.getElementById('pos-cat-tabs');
  if (tabContainer) {
    tabContainer.innerHTML = `<button class="category-tab ${!currentSelectedCategory ? 'active': ''}" onclick="filterPOSCategory('')">All Products</button>`;
    
    if (Array.isArray(categoriesList)) {
      categoriesList.forEach(c => {
        if(c.is_active === 1) {
          const activeClass = currentSelectedCategory == c.id ? 'active' : '';
          tabContainer.innerHTML += `<button class="category-tab ${activeClass}" onclick="filterPOSCategory(${c.id})">${c.name}</button>`;
        }
      });
    }
  }

  // Query products list ranked by sales
  triggerPOSSearch();
}

function filterPOSCategory(catId) {
  currentSelectedCategory = catId ? parseInt(catId) : null;
  loadPOS();
}

function triggerPOSSearch() {
  const query = document.getElementById('pos-search').value;
  let url = '/api/pos/search?';
  if (currentSelectedCategory) url += `category_id=${currentSelectedCategory}&`;
  if (query) url += `query=${encodeURIComponent(query)}`;

  fetch(url)
    .then(res => res.json())
    .then(products => {
      if (!Array.isArray(products)) {
        console.error('Failed to search POS products:', products);
        productsList = [];
        return;
      }
      productsList = products;
      const grid = document.getElementById('pos-product-grid');
      if (!grid) return;
      grid.innerHTML = '';

      if (products.length === 0) {
        grid.innerHTML = `<div style="grid-column: span 4; text-align: center; color: var(--text-muted); padding: 40px;">No items found in this section.</div>`;
        return;
      }

      products.forEach(p => {
        let disabledAttr = p.stock <= 0 ? 'out' : '';
        let badge = '';
        if (p.stock <= 0) {
          badge = '<span class="product-badge badge-out">OUT OF STOCK</span>';
        } else if (p.stock <= p.low_stock_threshold) {
          badge = '<span class="product-badge badge-low">LOW STOCK</span>';
        }

        const priceText = p.has_variants === 1 ? 'From variant' : `${p.sell_price.toFixed(2)} ETB`;
        const actionClick = p.stock > 0 ? `onclick="addPOSItemToCart(${p.id})"` : '';

        grid.innerHTML += `
          <div class="product-card glass" ${actionClick} style="${p.stock <= 0 ? 'opacity: 0.55; cursor: default;': ''}">
            ${badge}
            <div>
              <div class="product-meta">${p.brand || 'No Brand'} • ${p.category_name}</div>
              <div class="product-title" title="${p.name}">${p.name}</div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
              <span class="product-price">${priceText}</span>
              <span class="text-secondary" style="font-size:11px; font-weight:500;">Stock: ${p.stock}</span>
            </div>
          </div>
        `;
      });
    });
}

// POS CART FLOW LOGIC
function addPOSItemToCart(productId) {
  const product = productsList.find(p => p.id === productId);
  if (!product) return;

  if (product.has_variants === 1) {
    // Open variant selection modal
    selectedProductForVariant = product;
    document.getElementById('vsel-title').innerText = `Select variant for: ${product.name}`;
    const dropdown = document.getElementById('vsel-dropdown');
    dropdown.innerHTML = '';
    
    product.variants.forEach(v => {
      if (v.stock_quantity > 0) {
        dropdown.innerHTML += `<option value="${v.id}">${v.variant_name} - ${v.sell_price.toFixed(2)} ETB (Avail: ${v.stock_quantity})</option>`;
      }
    });

    if (dropdown.children.length === 0) {
      showToast('All variants for this product are currently out of stock.', 'error');
      return;
    }

    openModal('modal-variant-select');
  } else {
    // Simple product addition to cart
    insertCartItem(product, null);
  }
}

function confirmVariantSelection() {
  const vId = parseInt(document.getElementById('vsel-dropdown').value);
  const variant = selectedProductForVariant.variants.find(v => v.id === vId);
  closeModal('modal-variant-select');
  
  if (variant) {
    insertCartItem(selectedProductForVariant, variant);
  }
}

function insertCartItem(product, variant) {
  const cartKey = variant ? `v_${variant.id}` : `p_${product.id}`;
  const existing = cart.find(c => c.cartKey === cartKey);

  const productStock = variant ? variant.stock_quantity : product.stock;

  if (existing) {
    if (existing.quantity >= productStock) {
      showToast('Cannot add more items. Limit reaching available stock count.', 'error');
      return;
    }
    existing.quantity += 1;
  } else {
    cart.push({
      cartKey,
      product_id: product.id,
      variant_id: variant ? variant.id : null,
      name: product.name,
      variant_name: variant ? variant.variant_name : null,
      quantity: 1,
      sell_price: variant ? variant.sell_price : product.sell_price,
      max_stock: productStock
    });
  }

  renderCart();
}

function updateCartQuantity(cartKey, delta) {
  const item = cart.find(c => c.cartKey === cartKey);
  if (!item) return;

  const nextQty = item.quantity + delta;
  if (nextQty <= 0) {
    cart = cart.filter(c => c.cartKey !== cartKey);
  } else {
    if (nextQty > item.max_stock) {
      showToast('Cannot exceed actual item warehouse quantities.', 'error');
      return;
    }
    item.quantity = nextQty;
  }
  renderCart();
}

function removeCartItem(cartKey) {
  cart = cart.filter(c => c.cartKey !== cartKey);
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-items-container');
  container.innerHTML = '';
  
  if (cart.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 40px 10px; font-size: 13px;">
        <i data-lucide="shopping-basket" style="width: 32px; height: 32px; margin-bottom: 10px; opacity: 0.5;"></i>
        <p>Cart is empty. Select products on the left.</p>
      </div>
    `;
    document.getElementById('cart-item-count').innerText = '0 Items';
    document.getElementById('cart-subtotal').innerText = '0.00 ETB';
    document.getElementById('cart-total').innerText = '0.00 ETB';
    lucide.createIcons();
    return;
  }

  let subtotal = 0;
  let totalItems = 0;

  cart.forEach(item => {
    const lineVal = item.sell_price * item.quantity;
    subtotal += lineVal;
    totalItems += item.quantity;

    const variantLabel = item.variant_name ? `<span class="cart-itm-variant">${item.variant_name}</span>` : '';

    container.innerHTML += `
      <div class="cart-item">
        <div class="cart-itm-info">
          <span class="cart-itm-title">${item.name}</span>
          ${variantLabel}
          <span class="cart-itm-calc">${item.sell_price.toFixed(2)} x ${item.quantity} = ${lineVal.toFixed(2)} ETB</span>
        </div>
        <div class="cart-itm-qty">
          <button class="qty-btn" onclick="updateCartQuantity('${item.cartKey}', -1)">-</button>
          <span style="font-size:13px; font-weight:600; width:15px; text-align:center;">${item.quantity}</span>
          <button class="qty-btn" onclick="updateCartQuantity('${item.cartKey}', 1)">+</button>
        </div>
        <button class="btn-remove-itm" onclick="removeCartItem('${item.cartKey}')"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
      </div>
    `;
  });

  document.getElementById('cart-item-count').innerText = `${totalItems} Items`;
  document.getElementById('cart-subtotal').innerText = `${subtotal.toFixed(2)} ETB`;
  recalcCartTotals();
  lucide.createIcons();
}

function recalcCartTotals() {
  const subtotalText = document.getElementById('cart-subtotal').innerText;
  const subtotalVal = parseFloat(subtotalText) || 0;
  const discountVal = parseFloat(document.getElementById('cart-discount').value) || 0;

  const total = Math.max(0, subtotalVal - discountVal);
  document.getElementById('cart-total').innerText = `${total.toFixed(2)} ETB`;
}

function handlePaymentMethodChange(val) {
  const group = document.getElementById('checkout-mobile-group');
  if (val === 'mobile') {
    group.style.display = 'flex';
  } else {
    group.style.display = 'none';
    document.getElementById('checkout-mobile-subtype').value = '';
    handleMobileSubtypeChange('');
  }
}

function handleMobileSubtypeChange(val) {
  const groupTx = document.getElementById('group-txid');
  const groupPiv = document.getElementById('group-piv');
  
  groupTx.style.display = (val === 'transaction_id') ? 'block' : 'none';
  groupPiv.style.display = (val === 'piv') ? 'block' : 'none';
  
  if (val === 'piv') {
    // Show a loading/placeholder. Actual generation happens on server.
    document.getElementById('display-piv-code').innerText = 'PIV-PENDING';
    // Optionally fetch the preview next PIV
    fetch('/api/sales/next-piv')
      .then(r => r.json())
      .then(data => {
        if (data.nextPiv) document.getElementById('display-piv-code').innerText = data.nextPiv;
      });
  }
}

function handleCheckout(e) {
  e.preventDefault();
  if (cart.length === 0) {
    showToast('Checkout aborted: Your cart is empty.', 'error');
    return;
  }

  const paytype = document.getElementById('checkout-paytype').value;
  const paysub = document.getElementById('checkout-mobile-subtype').value;
  const discValue = parseFloat(document.getElementById('cart-discount').value) || 0;
  const txRef = document.getElementById('checkout-txref').value;
  const totalAmountText = document.getElementById('cart-total').innerText || '0.00';

  // VALIDATION
  if (paytype === 'mobile') {
    if (!paysub) {
      showToast('Validation Error: Please select a Mobile Subtype (Transaction ID or PIV).', 'error');
      return;
    }
    if (paysub === 'transaction_id' && !txRef.trim()) {
      showToast('Validation Error: Transaction ID is required for this mode.', 'error');
      return;
    }
  }

  showConfirm(
    `Confirm authorize of invoice totaling ETB ${totalAmountText} via [${paytype === 'mobile' ? 'Mobile: ' + paysub : 'Cash'}]?`,
    () => {
      const formData = new FormData();
      formData.append('cart', JSON.stringify(cart));
      formData.append('payment_type', paytype);
      formData.append('payment_subtype', paysub);
      formData.append('discount_amount', discValue);
      
      if (paytype === 'mobile' && paysub === 'transaction_id') {
        formData.append('transaction_reference', txRef);
      }

      fetch('/api/sales/checkout', {
        method: 'POST',
        body: formData
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          showToast(`Checkout failed: ${data.error}`, 'error');
        } else {
          showToast(`Checkout authorized! Invoice: ${data.sale_number}`, 'success');
          if (data.piv_assigned) {
            showAlert(`Sale completion successful. Generated Payment Reference: ${data.piv_assigned}. Please label the external image folder accordingly.`, "PIV Code Assigned", "success");
          }
          cart = [];
          document.getElementById('checkout-form').reset();
          document.getElementById('cart-discount').value = '0';
          handlePaymentMethodChange('cash');
          renderCart();
          triggerPOSSearch();
          loadInventory();
          fetchDashboardStats();
        }
      })
      .catch(err => {
        showToast('System Interface Error during checkout authorization.', 'error');
      });
    },
    null,
    "Authorize Order"
  );
}

// -------------------------------------------------------------------------
// C. INVENTORY MANAGEMENT (STOCKS, PRODUCTS, CATEGORIES)
// -------------------------------------------------------------------------
function loadCategories() {
  fetch('/api/categories')
    .then(res => res.json())
    .then(cats => {
      if (!Array.isArray(cats)) {
        console.error('Failed to load categories:', cats);
        categoriesList = [];
        return;
      }
      categoriesList = cats;
      
      // Populate drop selection inputs
      const drop1 = document.getElementById('prod-category');
      const drop2 = document.getElementById('edit-prod-category');
      
      if(drop1) {
        drop1.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }
      if(drop2) {
        drop2.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }
    });
}

function loadInventory() {
  fetch('/api/products')
    .then(res => res.json())
    .then(prods => {
      if (!Array.isArray(prods)) {
        console.error('Failed to load inventory products:', prods);
        return;
      }
      const tbody = document.getElementById('inventory-table-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      if (prods.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding:30px;">No inventory records created yet. Join categories and products above.</td></tr>`;
        return;
      }

      prods.forEach(p => {
        let isLow = p.stock <= p.low_stock_threshold;
        let warningStyle = isLow ? 'color: var(--accent-warning);' : '';
        const statusPill = p.is_active === 1 
          ? `<span class="profit-pill" style="margin:0;">Active</span>`
          : `<span class="product-badge badge-out" style="position:static;">Deactivated</span>`;

        let actionHtml = '';
        if (currentUser.role_type === 'owner' || currentPermissions.can_manage_stock === 1) {
          actionHtml += `<button class="btn" style="padding:4px 8px; font-size:11px;" onclick="openRestockModal(${p.id}, '${p.name.replace(/'/g, "\\'")}')"><i data-lucide="plus"></i> Stock In</button> `;
        }
        if (currentUser.role_type === 'owner' || currentPermissions.can_adjust_stock === 1) {
          actionHtml += `<button class="btn btn-danger" style="padding:4px 8px; font-size:11px; background:rgba(239,68,68,0.1); border-color:rgba(239,68,68,0.2); color:#fca5a5;" onclick="openAdjustmentModal(${p.id}, '${p.name.replace(/'/g, "\\'")}')"><i data-lucide="scissors"></i> Adjust</button> `;
        }
        if (currentUser.role_type === 'owner' || currentPermissions.can_manage_products === 1) {
          actionHtml += `<button class="btn" style="padding:4px 8px; font-size:11px;" onclick="openEditProductModal(${p.id})"><i data-lucide="edit"></i> Edit</button>`;
        }

        // Pricing column text
        let pricingText = '';
        if (p.has_variants) {
          pricingText = '<span class="text-secondary" style="font-size:11px;">Multiple variants</span>';
        } else {
          pricingText = `
            <div style="font-weight:600; color:#fff;">${p.sell_price.toFixed(2)} <span style="font-size:11px; color:var(--text-muted);">sell</span></div>
            <div style="font-size:11px; color:var(--text-muted);">${p.buy_price.toFixed(2)} buy (${p.profit_percentage}% profit)</div>
          `;
        }

        // Stock and variants listings detail
        let stockDetail = '';
        if (p.has_variants) {
          const vRows = p.variants.map(v => `
            <div style="font-family:var(--font-mono); font-size:11px; padding:2px 0; border-top:1px solid rgba(255,255,255,0.02);">
              <span>${v.variant_name}:</span> 
              <b style="${v.stock_quantity <= v.low_stock_threshold ? 'color:var(--accent-warning);' : ''}">${v.stock_quantity} units</b>
              <span class="text-muted">_SKU: ${v.sku_variant}</span>
            </div>
          `).join('');
          stockDetail = `
            <div style="font-weight:700; ${warningStyle}">${p.stock} Units total</div>
            <div style="margin-top:4px;">${vRows}</div>
          `;
        } else {
          stockDetail = `<span style="font-size:14px; font-weight:700; ${warningStyle}">${p.stock} units</span>`;
        }

        tbody.innerHTML += `
          <tr>
            <td style="font-family: var(--font-mono); font-size: 12px; color: #fff;">
              <div>${p.product_id_display}</div>
              <div style="color:var(--text-muted); font-size:11px;">${p.sku}</div>
            </td>
            <td>
              <div style="font-weight: 600; color: #fff;">${p.name}</div>
              <div style="font-size: 11px; color: var(--text-secondary);">${p.brand || 'No Brand'} • ${p.product_type || 'Type'}</div>
              <div style="font-size: 10px; color: var(--text-muted); text-overflow:ellipsis; max-width:200px; overflow:hidden; white-space:nowrap;">${p.description || ''}</div>
            </td>
            <td><span class="brand-badge">${p.category_name}</span></td>
            <td>${pricingText}</td>
            <td>${stockDetail}</td>
            <td>${statusPill}</td>
            <td style="white-space:nowrap;">${actionHtml || 'No permissions'}</td>
          </tr>
        `;
      });
      lucide.createIcons();
    });
}

function openAddCategoryModal() {
  document.getElementById('cat-modal-error').style.display = 'none';
  document.getElementById('cat-modal-form').reset();
  openModal('modal-category');
}

function createCategory(e) {
  e.preventDefault();
  const name = document.getElementById('cat-name').value;
  const description = document.getElementById('cat-desc').value;

  fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      document.getElementById('cat-modal-error').innerText = data.error;
      document.getElementById('cat-modal-error').style.display = 'block';
    } else {
      closeModal('modal-category');
      loadCategories();
      showToast('Storefront Category initialized.', 'success');
    }
  });
}

function openAddProductModal() {
  document.getElementById('prod-modal-error').style.display = 'none';
  document.getElementById('prod-modal-form').reset();
  
  // Set default buy/profit/initial qty inputs
  document.getElementById('prod-buy').value = '0';
  document.getElementById('prod-profit').value = '10';
  document.getElementById('prod-sell').value = '0.00';
  document.getElementById('prod-initial-qty').value = '0';

  // Clear nested variant builder list
  document.getElementById('variants-list').innerHTML = '';
  toggleVariantSection(false);

  openModal('modal-product');
}

function calculateSellPrice() {
  const buy = parseFloat(document.getElementById('prod-buy').value) || 0;
  const profit = parseFloat(document.getElementById('prod-profit').value) || 0;
  const sell = buy * (1 + profit / 100);
  document.getElementById('prod-sell').value = sell.toFixed(2);
}

function toggleVariantSection(checked) {
  const vSec = document.getElementById('variants-section');
  const simpleSec = document.getElementById('simple-pricing-section');
  const qtyContainer = document.getElementById('prod-initial-qty-container');

  if (checked) {
    vSec.style.display = 'block';
    simpleSec.style.display = 'none';
    if (qtyContainer) qtyContainer.style.display = 'none';
    // Add default row
    if (document.getElementById('variants-list').children.length === 0) {
      addVariantRow();
    }
  } else {
    vSec.style.display = 'none';
    simpleSec.style.display = 'flex';
    if (qtyContainer) qtyContainer.style.display = 'block';
  }
}

function addVariantRow() {
  const list = document.getElementById('variants-list');
  const index = list.children.length;

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '10px';
  row.style.alignItems = 'center';
  row.style.background = 'rgba(0,0,0,0.2)';
  row.style.padding = '8px';
  row.style.borderRadius = '6px';
  row.dataset.index = index;

  row.innerHTML = `
    <input type="text" placeholder="Size/Color Label" class="input-control variant-name" style="flex:1; padding:6px 10px;" required>
    <input type="number" step="0.01" placeholder="Buy Price" class="input-control variant-buy" style="width:100px; padding:6px 10px;" required oninput="recalcVarRow(${index})">
    <select class="input-control variant-profit" style="width:100px; padding:6px 10px;" onchange="recalcVarRow(${index})">
      <option value="5">5%</option>
      <option value="10" selected>10%</option>
      <option value="15">15%</option>
      <option value="20">20%</option>
      <option value="25">25%</option>
    </select>
    <input type="number" placeholder="Sell Price" class="input-control variant-sell" style="width:100px; padding:6px 10px; background:rgba(0,0,0,0.3); font-weight:600;" readonly>
    <input type="number" placeholder="Init Qty" class="input-control variant-qty" style="width:80px; padding:6px 10px;" min="0" value="0">
    <button type="button" class="qty-btn" style="background:rgba(239,68,68,0.1); color:#f87171; border-color:transparent;" onclick="this.parentElement.remove()">&times;</button>
  `;

  list.appendChild(row);
}

function recalcVarRow(idx) {
  const row = document.querySelector(`#variants-list div[data-index="${idx}"]`);
  if (!row) return;

  const buy = parseFloat(row.querySelector('.variant-buy').value) || 0;
  const margin = parseFloat(row.querySelector('.variant-profit').value) || 0;
  const sellVal = buy * (1 + margin / 100);
  row.querySelector('.variant-sell').value = sellVal.toFixed(2);
}

function createProduct(e) {
  e.preventDefault();
  
  const category_id = parseInt(document.getElementById('prod-category').value);
  const brand = document.getElementById('prod-brand').value;
  const name = document.getElementById('prod-name').value;
  const product_type = document.getElementById('prod-type').value;
  const description = document.getElementById('prod-desc').value;
  const unit_type = document.getElementById('prod-unit').value;
  const has_variants = document.getElementById('prod-has-variants').checked;
  const expiry_required = document.getElementById('prod-expiry-required').checked;
  const low_stock_threshold = parseInt(document.getElementById('prod-threshold').value) || 0;

  let buy_price = 0;
  let profit_percentage = 10;
  let variants = [];

  if (has_variants) {
    const rows = document.querySelectorAll('#variants-list div');
    if (rows.length === 0) {
      showToast('Please add at least one variant configuration row.', 'warning');
      return;
    }
    
    let hasErr = false;
    rows.forEach(r => {
      const vName = r.querySelector('.variant-name').value;
      const vBuy = parseFloat(r.querySelector('.variant-buy').value);
      const vMargin = parseFloat(r.querySelector('.variant-profit').value);
      const vQty = parseInt(r.querySelector('.variant-qty').value) || 0;
      
      if (!vName || isNaN(vBuy)) {
        hasErr = true;
      } else {
        variants.push({
          variant_name: vName,
          buy_price: vBuy,
          profit_percentage: vMargin,
          initial_quantity: vQty
        });
      }
    });

    if (hasErr) {
      showToast('Please fill out all assigned variant fields.', 'warning');
      return;
    }
  } else {
    buy_price = parseFloat(document.getElementById('prod-buy').value) || 0;
    profit_percentage = parseFloat(document.getElementById('prod-profit').value) || 10;
  }

  const initial_quantity = has_variants ? 0 : (parseInt(document.getElementById('prod-initial-qty').value) || 0);

  fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category_id, brand, name, product_type, description, unit_type,
      has_variants, expiry_required, low_stock_threshold, buy_price,
      profit_percentage, variants, initial_quantity
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      document.getElementById('prod-modal-error').innerText = data.error;
      document.getElementById('prod-modal-error').style.display = 'block';
    } else {
      closeModal('modal-product');
      loadInventory();
      loadPOS();
      fetchDashboardStats();
      showToast(`Product registered successfully. Displays ID: ${data.product_id_display}`, 'success');
    }
  });
}

// RESTOCK ACTIONS INDIVIDUAL SELECTION
function openRestockModal(prodId, prodName) {
  document.getElementById('restock-error').style.display = 'none';
  document.getElementById('restock-form').reset();
  
  document.getElementById('restock-pid').value = prodId;
  document.getElementById('restock-pname').value = prodName;

  const product = productsList.find(p => p.id === prodId);
  const variantGroup = document.getElementById('restock-variant-group');
  const dropdown = document.getElementById('restock-vid');
  
  // Expiry date toggled based on rule validation
  const expiryGroup = document.getElementById('restock-expiry-group');
  if (product && product.expiry_required === 1) {
    document.getElementById('restock-expiry').setAttribute('required', 'true');
    expiryGroup.style.display = 'block';
  } else {
    document.getElementById('restock-expiry').removeAttribute('required');
    expiryGroup.style.display = 'block'; // still let optional expiry edit occur
  }

  if (product && product.has_variants === 1) {
    variantGroup.style.display = 'block';
    dropdown.innerHTML = product.variants.map(v => `<option value="${v.id}">${v.variant_name}</option>`).join('');
    
    // Auto fill defaults per variant change
    dropdown.onchange = () => {
      const activeV = product.variants.find(vx => vx.id === parseInt(dropdown.value));
      document.getElementById('restock-buy').value = activeV ? activeV.buy_price : '';
    };
    dropdown.onchange();
  } else {
    variantGroup.style.display = 'none';
    document.getElementById('restock-buy').value = product ? product.buy_price : '';
  }

  openModal('modal-restock');
}

function saveRestock(e) {
  e.preventDefault();
  const product_id = parseInt(document.getElementById('restock-pid').value);
  const variant_id = document.getElementById('restock-variant-group').style.display !== 'none'
    ? parseInt(document.getElementById('restock-vid').value)
    : null;
  const quantity = parseInt(document.getElementById('restock-qty').value);
  const buy_price = parseFloat(document.getElementById('restock-buy').value);
  const expiry_date = document.getElementById('restock-expiry').value;
  const reason = document.getElementById('restock-reason').value;

  fetch('/api/stock/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id, variant_id, quantity, buy_price, expiry_date, reason })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      document.getElementById('restock-error').innerText = data.error;
      document.getElementById('restock-error').style.display = 'block';
    } else {
      closeModal('modal-restock');
      loadInventory();
      loadPOS();
      fetchDashboardStats();
      showToast('Stock catalog updated successfully.', 'success');
    }
  });
}

// ADJUSTMENT ACTION WRITE-OFF
function openAdjustmentModal(prodId, prodName) {
  document.getElementById('adj-error').style.display = 'none';
  document.getElementById('adjustment-form').reset();

  document.getElementById('adj-pid').value = prodId;
  document.getElementById('adj-pname').value = prodName;

  const product = productsList.find(p => p.id === prodId);
  const variantGroup = document.getElementById('adj-variant-group');
  const dropdown = document.getElementById('adj-vid');

  if (product && product.has_variants === 1) {
    variantGroup.style.display = 'block';
    dropdown.innerHTML = product.variants.map(v => `<option value="${v.id}">${v.variant_name}</option>`).join('');
  } else {
    variantGroup.style.display = 'none';
  }

  openModal('modal-adjustment');
}

function saveAdjustment(e) {
  e.preventDefault();
  const product_id = parseInt(document.getElementById('adj-pid').value);
  const variant_id = document.getElementById('adj-variant-group').style.display !== 'none'
    ? parseInt(document.getElementById('adj-vid').value)
    : null;
  const adjustment_type = document.getElementById('adj-type').value;
  const quantity = parseInt(document.getElementById('adj-qty').value);
  const reason = document.getElementById('adj-reason').value;

  fetch('/api/stock/adjust', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id, variant_id, adjustment_type, quantity, reason })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      document.getElementById('adj-error').innerText = data.error;
      document.getElementById('adj-error').style.display = 'block';
    } else {
      closeModal('modal-adjustment');
      loadInventory();
      loadPOS();
      fetchDashboardStats();
      showToast('Loss Adjustment and writeoff logged in audit history.', 'success');
    }
  });
}

// PRODUCT EDIT MODAL CONTROLLERS
function openEditProductModal(productId) {
  document.getElementById('edit-prod-error').style.display = 'none';
  document.getElementById('edit-product-form').reset();

  const product = productsList.find(p => p.id === productId);
  if (!product) return;

  document.getElementById('edit-prod-id').value = product.id;
  document.getElementById('edit-prod-category').value = product.category_id;
  document.getElementById('edit-prod-brand').value = product.brand;
  document.getElementById('edit-prod-name').value = product.name;
  document.getElementById('edit-prod-type').value = product.product_type;
  document.getElementById('edit-prod-unit').value = product.unit_type;
  document.getElementById('edit-prod-threshold').value = product.low_stock_threshold;
  document.getElementById('edit-prod-desc').value = product.description;
  document.getElementById('edit-prod-expiry-required').checked = product.expiry_required === 1;

  const simplePriceRow = document.getElementById('edit-simple-pricing-section');
  if (product.has_variants === 1) {
    simplePriceRow.style.display = 'none';
  } else {
    simplePriceRow.style.display = 'flex';
    document.getElementById('edit-prod-buy').value = product.buy_price;
    document.getElementById('edit-prod-profit').value = product.profit_percentage;
    document.getElementById('edit-prod-sell').value = product.sell_price.toFixed(2);
  }

  // Double check pricing permissions
  const priceControls = document.querySelectorAll('#edit-simple-pricing-section input, #edit-simple-pricing-section select');
  const hasPricePermission = currentUser.role_type === 'owner' || currentPermissions.can_edit_prices === 1;
  priceControls.forEach(ctrl => {
    if(!hasPricePermission) ctrl.setAttribute('disabled', 'true');
    else ctrl.removeAttribute('disabled');
  });

  openModal('modal-edit-product');
}

function calculateEditSellPrice() {
  const buy = parseFloat(document.getElementById('edit-prod-buy').value) || 0;
  const profit = parseFloat(document.getElementById('edit-prod-profit').value) || 0;
  const sell = buy * (1 + profit / 100);
  document.getElementById('edit-prod-sell').value = sell.toFixed(2);
}

function saveEditProduct(e) {
  e.preventDefault();
  const prodId = parseInt(document.getElementById('edit-prod-id').value);
  const category_id = parseInt(document.getElementById('edit-prod-category').value);
  const brand = document.getElementById('edit-prod-brand').value;
  const name = document.getElementById('edit-prod-name').value;
  const product_type = document.getElementById('edit-prod-type').value;
  const unit_type = document.getElementById('edit-prod-unit').value;
  const low_stock_threshold = parseInt(document.getElementById('edit-prod-threshold').value);
  const description = document.getElementById('edit-prod-desc').value;
  const expiry_required = document.getElementById('edit-prod-expiry-required').checked;

  const bodyData = {
    category_id, brand, name, product_type, unit_type, low_stock_threshold, description, expiry_required
  };

  const simplePricing = document.getElementById('edit-simple-pricing-section');
  if (simplePricing.style.display !== 'none') {
    bodyData.buy_price = parseFloat(document.getElementById('edit-prod-buy').value);
    bodyData.profit_percentage = parseFloat(document.getElementById('edit-prod-profit').value);
  }

  fetch(`/api/products/${prodId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyData)
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      document.getElementById('edit-prod-error').innerText = data.error;
      document.getElementById('edit-prod-error').style.display = 'block';
    } else {
      closeModal('modal-edit-product');
      loadInventory();
      loadPOS();
      fetchDashboardStats();
      showToast('Product updates recorded.', 'success');
    }
  });
}

// -------------------------------------------------------------------------
// D. CUSTOMER RETURN WORKFLOW RECEIPTS
// -------------------------------------------------------------------------
function loadReturns() {
  fetch('/api/returns')
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        console.error('Failed to load returns:', data);
        return;
      }
      const tbody = document.getElementById('returns-table-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">No return requests filed yet inside local ledger.</td></tr>`;
        return;
      }

      data.forEach(r => {
        let textStatusClass = '';
        if (r.status === 'pending') textStatusClass = 'color: var(--accent-warning); font-weight:600;';
        if (r.status === 'approved') textStatusClass = 'color: var(--accent-success); font-weight:600;';
        if (r.status === 'rejected') textStatusClass = 'color: var(--accent-danger); font-weight:600;';

        let options = '';
        if (r.status === 'pending') {
          if (currentUser.role_type === 'owner' || currentPermissions.can_approve_returns === 1) {
            options = `
              <button class="btn btn-success" style="padding:4px 8px; font-size:11px;" onclick="approveReturn(${r.id}, 'approved')">Approve</button>
              <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="approveReturn(${r.id}, 'rejected')">Reject</button>
            `;
          } else {
            options = `<em class="text-secondary" style="font-size:11px;">Awaiting owner review</em>`;
          }
        } else {
          options = `<span class="text-secondary" style="font-size:11px;">Processed by: <b>${r.approver_name || 'System'}</b></span>`;
        }

        const date = new Date(r.created_at).toLocaleString();

        const imgReference = r.receipt_file_name 
          ? `<br><a href="/uploads/receipts/${r.receipt_file_name}" target="_blank" class="profit-pill" style="font-size:9px; margin-top:4px; display:inline-block;">View Receipt Ref</a>` 
          : '';

        tbody.innerHTML += `
          <tr>
            <td>
              <div style="font-weight:600; color:#fff;">RET-${r.id}</div>
              <div class="text-muted" style="font-size:11px;">${date}</div>
            </td>
            <td>
              <div style="font-weight:600; color:#fff;">${r.sale_number}</div>
              <div style="font-size:11px; color:var(--text-secondary);">Line: item ${r.sale_item_id || 'whole package'}</div>
            </td>
            <td><b>${r.requester_name}</b></td>
            <td>
              <div style="font-weight:700; color:#fff;">${r.refund_amount.toFixed(2)} ETB</div>
              <div style="font-size:11px; color:var(--text-muted);">Method: ${r.refund_method} ${imgReference}</div>
            </td>
            <td style="max-width:200px; font-size:12px; word-break:break-all;">${r.reason}</td>
            <td style="${textStatusClass}">${r.status.toUpperCase()}</td>
            <td>${options}</td>
          </tr>
        `;
      });
      lucide.createIcons();
    });
}

function selectReturnDetails(saleId, saleItemId, saleNumber, itemTitle, itemPrice) {
  closeModal('modal-sale-item-picker');
  document.getElementById('ret-request-error').style.display = 'none';
  document.getElementById('return-request-form').reset();

  document.getElementById('ret-sale-id').value = saleId;
  document.getElementById('ret-sale-item-id').value = saleItemId || '';
  document.getElementById('ret-sale-number').value = saleNumber;
  document.getElementById('ret-item-details').value = `${itemTitle} (${itemPrice.toFixed(2)} ETB)`;
  document.getElementById('ret-amount').value = itemPrice;

  toggleReturnMobileFields('cash');
  openModal('modal-request-return');
}

function toggleReturnMobileFields(val) {
  const g = document.getElementById('return-mobile-group');
  if (val === 'mobile_transfer') {
    g.style.display = 'flex';
  } else {
    g.style.display = 'none';
  }
}

function submitReturnRequest(e) {
  e.preventDefault();
  const sale_id = parseInt(document.getElementById('ret-sale-id').value);
  const sale_item_id = document.getElementById('ret-sale-item-id').value;
  const reason = document.getElementById('ret-reason').value;
  const refund_method = document.getElementById('ret-method').value;
  const refund_amount = parseFloat(document.getElementById('ret-amount').value);
  const transaction_reference = document.getElementById('ret-txref').value;
  const imgInput = document.getElementById('ret-img');

  const formData = new FormData();
  formData.append('sale_id', sale_id);
  if (sale_item_id) formData.append('sale_item_id', sale_item_id);
  formData.append('reason', reason);
  formData.append('refund_method', refund_method);
  formData.append('refund_amount', refund_amount);

  if (refund_method === 'mobile_transfer') {
    formData.append('transaction_reference', transaction_reference);
    if (imgInput.files.length > 0) {
      formData.append('receipt_image', imgInput.files[0]);
    }
  }

  fetch('/api/returns/request', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      document.getElementById('ret-request-error').innerText = data.error;
      document.getElementById('ret-request-error').style.display = 'block';
    } else {
      closeModal('modal-request-return');
      closeModal('modal-sale-item-picker');
      loadReturns();
      showToast(`Return request RET-${data.returnId} filed. Awaiting Owner approval.`, 'info');
    }
  });
}

function approveReturn(retId, decision) {
  showConfirm(
    `Are you sure you want to change status to ${decision}?`,
    () => {
      fetch(`/api/returns/approve/${retId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          showToast(data.error, 'error');
        } else {
          loadReturns();
          loadInventory();
          loadPOS();
          fetchDashboardStats();
          showToast(`Return request updated to: ${decision}`, 'success');
        }
      });
    },
    null,
    "Approve Return"
  );
}

// -------------------------------------------------------------------------
// E. MANAGE EMPLOYEES CONTROL
// -------------------------------------------------------------------------
function loadEmployees() {
  fetch('/api/employees')
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        console.error('Failed to load employees:', data);
        return;
      }
      const tbody = document.getElementById('employees-table-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">No employee records built yet. Click New Employee to join local operators.</td></tr>`;
        return;
      }

      data.forEach(e => {
        const status = e.is_active === 1 
          ? `<span class="profit-pill" style="margin:0;">Active</span>` 
          : `<span class="product-badge badge-out" style="position:static;">Suspended</span>`;

        // Collate checked permissions for neat dashboard visual listing
        const pFlags = [];
        const labelMap = {
          can_view_dashboard: 'Dashboard',
          can_manage_products: 'Products',
          can_manage_categories: 'Categories',
          can_manage_stock: 'Stock-In',
          can_sell: 'Sell POS',
          can_create_returns: 'ReturnsReq',
          can_approve_returns: 'ReturnsApp',
          can_view_reports: 'Reports',
          can_manage_employees: 'Employees',
          can_view_audit_logs: 'Audits',
          can_manage_backups: 'Backups',
          can_edit_prices: 'PriceMarg',
          can_adjust_stock: 'Adjustment',
          can_manage_settings: 'Settings'
        };

        for (const [key, val] of Object.entries(labelMap)) {
          if (e[key] === 1) pFlags.push(`<span class="brand-badge" style="font-size:10px; padding:1px 4px; margin:2px 1px; display:inline-block;">${val}</span>`);
        }

        tbody.innerHTML += `
          <tr>
            <td>
              <div style="font-weight:600; color:#fff;">${e.full_name}</div>
              <div class="text-secondary" style="font-size:11px;">ID: User #${e.id}</div>
            </td>
            <td><b>${e.username}</b></td>
            <td>${status}</td>
            <td style="max-width:350px;">${pFlags.join('') || '<span class="text-muted">None</span>'}</td>
            <td style="white-space:nowrap;">
              <button class="btn" style="padding:4px 8px; font-size:11px;" onclick="openResetPasswordModal(${e.id}, '${e.username}')"><i data-lucide="key"></i> Reset</button>
              <button class="btn btn-primary" style="padding:4px 8px; font-size:11px;" onclick="toggleEmployeePermission(${e.id})"><i data-lucide="edit-2"></i> Permissions</button>
              <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="perfDeleteEmployee(${e.id}, '${e.username}')"><i data-lucide="trash"></i> Delete</button>
            </td>
          </tr>
        `;
      });
      lucide.createIcons();
    });
}

function openAddEmployeeModal() {
  document.getElementById('emp-modal-error').style.display = 'none';
  document.getElementById('emp-modal-form').reset();
  
  // Set default check POS and returns checkboxes
  document.getElementById('perm-pos').checked = true;
  document.getElementById('perm-ret-create').checked = true;

  openModal('modal-employee');
}

function createEmployee(e) {
  e.preventDefault();
  const full_name = document.getElementById('emp-fullname').value;
  const username = document.getElementById('emp-username').value;
  const password = document.getElementById('emp-password').value;

  const strengthErr = validatePasswordStrength(password);
  if (strengthErr) {
    document.getElementById('emp-modal-error').innerText = strengthErr;
    document.getElementById('emp-modal-error').style.display = 'block';
    return;
  }

  const permissions = {
    can_view_dashboard: document.getElementById('perm-dashboard').checked,
    can_manage_products: document.getElementById('perm-products').checked,
    can_manage_categories: document.getElementById('perm-categories').checked,
    can_manage_stock: document.getElementById('perm-stock').checked,
    can_sell: document.getElementById('perm-pos').checked,
    can_create_returns: document.getElementById('perm-ret-create').checked,
    can_approve_returns: document.getElementById('perm-ret-approve').checked,
    can_view_reports: document.getElementById('perm-reports').checked,
    can_manage_employees: document.getElementById('perm-employees').checked,
    can_view_audit_logs: document.getElementById('perm-audit').checked,
    can_manage_backups: document.getElementById('perm-backups').checked,
    can_edit_prices: document.getElementById('perm-edit-price').checked,
    can_adjust_stock: document.getElementById('perm-adjust').checked,
    can_manage_settings: document.getElementById('perm-settings').checked,
  };

  fetch('/api/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name, username, password, permissions })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      document.getElementById('emp-modal-error').innerText = data.error;
      document.getElementById('emp-modal-error').style.display = 'block';
    } else {
      closeModal('modal-employee');
      loadEmployees();
      showToast('Employee operator credentials registered on disk.', 'success');
    }
  });
}

function openResetPasswordModal(id, username) {
  document.getElementById('emp-reset-error').style.display = 'none';
  document.getElementById('emp-reset-form').reset();
  document.getElementById('reset-emp-id').value = id;
  document.getElementById('reset-emp-username').value = username;
  openModal('modal-emp-reset');
}

function resetEmployeePassword(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById('reset-emp-id').value);
  const new_password = document.getElementById('reset-emp-password').value;

  const strengthErr = validatePasswordStrength(new_password);
  if (strengthErr) {
    document.getElementById('emp-reset-error').innerText = strengthErr;
    document.getElementById('emp-reset-error').style.display = 'block';
    return;
  }

  fetch(`/api/employees/reset-password/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      document.getElementById('emp-reset-error').innerText = data.error;
      document.getElementById('emp-reset-error').style.display = 'block';
    } else {
      closeModal('modal-emp-reset');
      showToast('Employee login password overwritten.', 'success');
    }
  });
}

function toggleEmployeePermission(empId) {
  // Query full employees and edit permissions
  fetch('/api/employees')
    .then(res => res.json())
    .then(list => {
      if (!Array.isArray(list)) {
        console.error('Failed to load employees list:', list);
        return;
      }
      const emp = list.find(e => e.id === empId);
      if(!emp) return;

      openAddEmployeeModal(); // loads standard window
      
      document.getElementById('emp-fullname').value = emp.full_name;
      document.getElementById('emp-username').value = emp.username;
      
      // Remove required password as we are editing an account
      document.getElementById('emp-password').removeAttribute('required');
      document.getElementById('emp-password').placeholder = 'Leave empty to keep password';
      
      // Override title & behavior
      document.querySelector('#modal-employee .modal-title').innerText = `Edit operator permissions: ${emp.username}`;
      
      const setCheck = (id, val) => {
        document.getElementById(id).checked = val === 1;
      };

      setCheck('perm-dashboard', emp.can_view_dashboard);
      setCheck('perm-pos', emp.can_sell);
      setCheck('perm-products', emp.can_manage_products);
      setCheck('perm-categories', emp.can_manage_categories);
      setCheck('perm-stock', emp.can_manage_stock);
      setCheck('perm-ret-create', emp.can_create_returns);
      setCheck('perm-ret-approve', emp.can_approve_returns);
      setCheck('perm-reports', emp.can_view_reports);
      setCheck('perm-employees', emp.can_manage_employees);
      setCheck('perm-audit', emp.can_view_audit_logs);
      setCheck('perm-backups', emp.can_manage_backups);
      setCheck('perm-edit-price', emp.can_edit_prices);
      setCheck('perm-adjust', emp.can_adjust_stock);
      setCheck('perm-settings', emp.can_manage_settings);

      // Re-intercept form submit to trigger PUT request instead of POST
      const form = document.getElementById('emp-modal-form');
      form.onsubmit = (ev) => {
        ev.preventDefault();
        
        const permissions = {
          can_view_dashboard: document.getElementById('perm-dashboard').checked,
          can_manage_products: document.getElementById('perm-products').checked,
          can_manage_categories: document.getElementById('perm-categories').checked,
          can_manage_stock: document.getElementById('perm-stock').checked,
          can_sell: document.getElementById('perm-pos').checked,
          can_create_returns: document.getElementById('perm-ret-create').checked,
          can_approve_returns: document.getElementById('perm-ret-approve').checked,
          can_view_reports: document.getElementById('perm-reports').checked,
          can_manage_employees: document.getElementById('perm-employees').checked,
          can_view_audit_logs: document.getElementById('perm-audit').checked,
          can_manage_backups: document.getElementById('perm-backups').checked,
          can_edit_prices: document.getElementById('perm-edit-price').checked,
          can_adjust_stock: document.getElementById('perm-adjust').checked,
          can_manage_settings: document.getElementById('perm-settings').checked,
        };

        const bodyData = {
          full_name: document.getElementById('emp-fullname').value,
          username: document.getElementById('emp-username').value,
          permissions
        };

        const pwdVal = document.getElementById('emp-password').value;
        if (pwdVal) {
          // Trigger password rewrite
          fetch(`/api/employees/reset-password/${empId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_password: pwdVal })
          });
        }

        fetch(`/api/employees/${empId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyData)
        })
        .then(r => r.json())
        .then(d => {
          if (d.error) {
            document.getElementById('emp-modal-error').innerText = d.error;
            document.getElementById('emp-modal-error').style.display = 'block';
          } else {
            closeModal('modal-employee');
            loadEmployees();
            
            // Re-bind default listener
            form.onsubmit = null;
            document.querySelector('#modal-employee .modal-title').innerText = 'Create Employee Account';
            document.getElementById('emp-password').placeholder = '••••••••';
            document.getElementById('emp-password').setAttribute('required', 'true');
            showToast('Permissions updated successfully.', 'success');
          }
        });
      };
    });
}

function perfDeleteEmployee(id, username) {
  showConfirm(
    `Are you sure you want to completely delete employee: ${username}?`,
    () => {
      fetch(`/api/employees/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            showToast(data.error, 'error');
          } else {
            loadEmployees();
            showToast('Operator employee deleted.', 'success');
          }
        });
    },
    null,
    "Delete Employee Account"
  );
}

// -------------------------------------------------------------------------
// F. REPORTS DIAGNOSTICS & CURVES
// -------------------------------------------------------------------------
function resetReportsView() {
  document.getElementById('report-summary-kpis').style.display = 'none';
  document.getElementById('report-type').value = 'daily_sales';
  toggleDateInputs('daily_sales');
  
  const h = document.getElementById('report-table-head');
  h.innerHTML = `
    <tr>
      <th>Invoice/Time</th>
      <th>Cashier</th>
      <th>Settlement Mode</th>
      <th>Total Items</th>
      <th>Wholesale Cost</th>
      <th>Revenue (ETB)</th>
      <th>Net Profit Margin</th>
    </tr>
  `;
}

function toggleDateInputs(val) {
  const datesRow = document.getElementById('report-date-inputs');
  if (val === 'custom_range') {
    datesRow.style.display = 'flex';
  } else {
    datesRow.style.display = 'none';
  }
}

function generateReport(e) {
  e.preventDefault();

  const type = document.getElementById('report-type').value;
  const start = document.getElementById('report-start').value;
  const end = document.getElementById('report-end').value;

  let url = `/api/reports/query?type=${type}`;
  if (type === 'custom_range') {
    if (!start || !end) {
      showToast('Must select Start and End date bounds for custom diagnostic range.', 'warning');
      return;
    }
    url += `&start_date=${start}&end_date=${end}`;
  }

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (!data || !Array.isArray(data.sales)) {
        console.error('Failed to load report data:', data);
        showToast(data && data.error ? `Report failed: ${data.error}` : 'Failed to retrieve report diagnostic logs.', 'error');
        return;
      }
      const head = document.getElementById('report-table-head');
      const tbody = document.getElementById('report-table-body');
      const kpibox = document.getElementById('report-summary-kpis');

      tbody.innerHTML = '';

      if (data.sales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">No logs found matching selection parameters.</td></tr>`;
        kpibox.style.display = 'none';
        return;
      }

      // Configure table columns based on metric selection
      if (type === 'top_selling') {
        kpibox.style.display = 'none';
        head.innerHTML = `
          <tr>
            <th>Product Name</th>
            <th>Variant Type</th>
            <th>SKU Reference</th>
            <th>Units Sold</th>
            <th>Total Revenue (ETB)</th>
            <th>Profit margin</th>
          </tr>
        `;

        data.sales.forEach(s => {
          tbody.innerHTML += `
            <tr>
              <td><b style="color:#fff;">${s.product_name}</b></td>
              <td>${s.variant_name || '<em class="text-secondary">-</em>'}</td>
              <td style="font-family:var(--font-mono); font-size:12px;">${s.sku}</td>
              <td><b>${s.total_units} units</b></td>
              <td><span style="color:var(--accent-success); font-weight:600;">${s.total_revenue.toFixed(2)} ETB</span></td>
              <td><span class="profit-pill">${s.total_profit.toFixed(2)} ETB</span></td>
            </tr>
          `;
        });
      } else if (type === 'low_stock') {
        kpibox.style.display = 'none';
        head.innerHTML = `
          <tr>
            <th>Display / SKU Code</th>
            <th>Product Title</th>
            <th>Variant Title</th>
            <th>Threshold Limit</th>
            <th>Available Stock Status</th>
          </tr>
        `;

        data.sales.forEach(s => {
          tbody.innerHTML += `
            <tr>
              <td style="font-family:var(--font-mono); font-size:12px; color:#fff;">${s.sku}</td>
              <td><b>${s.name}</b></td>
              <td>${s.variant_name || '<em class="text-secondary">-</em>'}</td>
              <td>${s.low_stock_threshold} units</td>
              <td style="color: var(--accent-warning); font-weight:700;">${s.current_stock} units remain</td>
            </tr>
          `;
        });
      } else {
        // Financial sales list
        kpibox.style.display = 'grid';
        document.getElementById('rep-kpi-revenue').innerText = `${data.summary.total_revenue.toFixed(2)} ETB`;
        document.getElementById('rep-kpi-cost').innerText = `${data.summary.total_cost.toFixed(2)} ETB`;
        document.getElementById('rep-kpi-profit').innerText = `${data.summary.total_profit.toFixed(2)} ETB`;

        head.innerHTML = `
          <tr>
            <th>Invoice/Time</th>
            <th>Cashier</th>
            <th>Settlement Mode</th>
            <th>Total Items</th>
            <th>Wholesale Cost</th>
            <th>Revenue (ETB)</th>
            <th>Net Profit Margin</th>
          </tr>
        `;

        data.sales.forEach(s => {
          const date = new Date(s.created_at).toLocaleString();
          let payLabel = '';
          if (s.payment_type === 'cash') {
            payLabel = '<span style="color:var(--text-secondary);">Cash Payment</span>';
          } else {
            const sub = s.payment_subtype === 'transaction_id' ? 'TX-ID' : 'PIV-Ref';
            const ref = s.transaction_reference ? `<div style="font-size:10px; color:var(--accent-color); font-family:var(--font-mono); font-weight:600;">${s.transaction_reference}</div>` : '';
            payLabel = `<div>Mobile (${sub})</div>${ref}`;
          }

          tbody.innerHTML += `
            <tr>
              <td>
                <div style="font-weight:600; color:#fff;">${s.sale_number}</div>
                <div class="text-secondary" style="font-size:11px;">${date}</div>
              </td>
              <td><b>${s.cashier || 'Owner'}</b></td>
              <td style="font-size:12px;">${payLabel}</td>
              <td>${s.total_items} items</td>
              <td>${s.total_cost.toFixed(2)} ETB</td>
              <td><b style="color: var(--accent-success);">${s.total_amount.toFixed(2)} ETB</b></td>
              <td><span class="profit-pill">${s.total_profit.toFixed(2)} ETB</span></td>
            </tr>
          `;
        });
      }
      lucide.createIcons();
    });
}

function filterReportRows(query) {
  const q = query.toLowerCase();
  const rows = document.querySelectorAll('#report-table-body tr');
  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(q) ? '' : 'none';
  });
}

// -------------------------------------------------------------------------
// G. SECURITY AUDIT TIMELINES
// -------------------------------------------------------------------------
function fetchAuditTrails() {
  fetch('/api/audit-logs')
    .then(res => res.json())
    .then(logs => {
      if (!Array.isArray(logs)) {
        console.error('Failed to fetch audit trails:', logs);
        return;
      }
      const tbody = document.getElementById('audit-table-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">Audit trails are clear.</td></tr>`;
        return;
      }

      logs.forEach(l => {
        const date = new Date(l.created_at).toLocaleString();
        tbody.innerHTML += `
          <tr>
            <td style="font-size:11px; white-space:nowrap;">${date}</td>
            <td><span class="brand-badge" style="text-transform: uppercase; font-size:10px; font-weight:600; background:rgba(255,255,255,0.05);">${l.action_type}</span></td>
            <td style="text-transform:capitalize; font-size:12px;">${l.entity_type}</td>
            <td><b>${l.actor_name || 'System Auto'}</b></td>
            <td style="font-size:12px; max-width:400px; word-break:break-word;">${l.description}</td>
          </tr>
        `;
      });
      lucide.createIcons();
    });
}

// -------------------------------------------------------------------------
// H. SYSTEM BACKUPS & RECOVERY
// -------------------------------------------------------------------------
function loadBackups() {
  fetch('/api/backups')
    .then(res => res.json())
    .then(data => {
      if (!data || !data.backups || !Array.isArray(data.backups)) {
        console.error('Failed to load backups:', data);
        return;
      }
      const tbody = document.getElementById('backups-table-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      // Toggled Retention popup
      const retentionBox = document.getElementById('retention-prompt-box');
      if (retentionBox) {
        if (data.needs_retention_prompt) {
          retentionBox.style.display = 'block';
        } else {
          retentionBox.style.display = 'none';
        }
      }

      if (data.backups.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">No backup databases recorded. Trigger manual backup above to seed files.</td></tr>`;
        return;
      }

      data.backups.forEach(b => {
        const date = new Date(b.created_at).toLocaleString();
        let statusStyle = '';
        if (b.retention_status === 'active') statusStyle = 'color: var(--accent-success);font-weight:600;';
        if (b.retention_status === 'archived') statusStyle = 'color: var(--accent-color);font-weight:600;';
        if (b.retention_status === 'deleted') statusStyle = 'color: var(--accent-danger);opacity:0.6;';

        tbody.innerHTML += `
          <tr>
            <td style="font-size:11px;">${date}</td>
            <td style="font-family: var(--font-mono); font-size:11px; color:#fff;">${b.file_name}</td>
            <td style="font-size:11px; color:var(--text-secondary); max-width:300px; overflow:hidden; text-overflow:ellipsis;">${b.file_path}</td>
            <td><span class="brand-badge" style="text-transform:uppercase;">${b.backup_type}</span></td>
            <td style="${statusStyle}">${b.retention_status.toUpperCase()}</td>
          </tr>
        `;
      });
      lucide.createIcons();
    });
}

function createManualBackup() {
  fetch('/api/backups/create', { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      if (data.error) showToast(data.error, 'error');
      else {
        loadBackups();
        showToast(`Offline backup complete! Database written to backups/daily/${data.filename}`, 'success');
      }
    });
}

function handleBackupRetention(decision) {
  fetch('/api/backups/retention-decision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) showToast(data.error, 'error');
    else {
      loadBackups();
      showToast(`Backups updated! Handled retention files correctly.`, 'success');
    }
  });
}

// -------------------------------------------------------------------------
// I. PROFILE CREDENTIALS & SYSTEM CONFIGS
// -------------------------------------------------------------------------
function loadProfileDetails() {
  document.getElementById('profile-success').style.display = 'none';
  document.getElementById('profile-error').style.display = 'none';
  
  document.getElementById('prof-fullname').value = currentUser.full_name;
  document.getElementById('prof-username').value = currentUser.username;
  document.getElementById('prof-password').value = '';
}

function loadSettingsData() {
  fetch('/api/settings')
    .then(res => res.json())
    .then(settings => {
      if (!Array.isArray(settings)) {
        console.error('Failed to load settings:', settings);
        return;
      }
      const shopNameSetting = settings.find(s => s.setting_key === 'shop_name');
      const sessionTimeoutSetting = settings.find(s => s.setting_key === 'session_timeout');
      
      const shopName = shopNameSetting ? shopNameSetting.setting_value : 'My Retail Business';
      const timeout = sessionTimeoutSetting ? sessionTimeoutSetting.setting_value : '15';

      document.getElementById('display-shop-name').innerText = shopName;

      // Handle owner options visibility in settings
      const settingsCard = document.getElementById('shop-settings-card');
      if (currentUser.role_type === 'owner') {
        settingsCard.style.display = 'block';
        document.getElementById('set-shopname').value = shopName;
        document.getElementById('set-timeout').value = timeout;
      } else {
        settingsCard.style.display = 'none';
      }
    });
}

function updateMyProfile(e) {
  e.preventDefault();
  const full_name = document.getElementById('prof-fullname').value;
  const username = document.getElementById('prof-username').value;
  const password = document.getElementById('prof-password').value;

  const errDiv = document.getElementById('profile-error');
  const succDiv = document.getElementById('profile-success');

  errDiv.style.display = 'none';
  succDiv.style.display = 'none';

  if (password) {
    const strengthErr = validatePasswordStrength(password);
    if (strengthErr) {
      errDiv.innerText = strengthErr;
      errDiv.style.display = 'block';
      return;
    }
  }

  fetch('/api/profile/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name, username, password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      errDiv.innerText = data.error;
      errDiv.style.display = 'block';
    } else {
      succDiv.style.display = 'block';
      currentUser.full_name = full_name;
      currentUser.username = username;
      showAppLayout();
    }
  });
}

function updateShopSettings(e) {
  e.preventDefault();
  const shop_name = document.getElementById('set-shopname').value;
  const session_timeout = parseInt(document.getElementById('set-timeout').value);

  const succDiv = document.getElementById('settings-success');
  succDiv.style.display = 'none';

  fetch('/api/settings/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shop_name, session_timeout })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      showToast(data.error, 'error');
    } else {
      succDiv.style.display = 'block';
      loadSettingsData();
    }
  });
}

// -------------------------------------------------------------------------
// CORE LOW STOCK POPUP ALERTS
// -------------------------------------------------------------------------
function checkLowStockAlerts() {
  if (!currentUser) return; // session must be initialized
  
  fetch('/api/alerts/low-stock')
    .then(res => res.json())
    .then(alerts => {
      if (!Array.isArray(alerts)) {
        console.error('Failed to load low stock alerts:', alerts);
        return;
      }
      const container = document.getElementById('alerts-container');
      
      // Filter out acknowledged ones
      const unacknowledged = alerts.filter(a => !acknowledgedAlerts.has(a.display_id));

      if (unacknowledged.length === 0) return;

      unacknowledged.forEach(a => {
        // Build alert card UI if not already drawn in window DOM
        const uniqueAlertId = `low-stock-alert-${a.display_id}`;
        if (document.getElementById(uniqueAlertId)) return;

        const card = document.createElement('div');
        card.id = uniqueAlertId;
        card.className = 'alert-item glass';
        card.innerHTML = `
          <div class="alert-icon"><i data-lucide="alert-triangle"></i></div>
          <div class="alert-content">
            <h4>Low Stock Alert - ${a.display_id}</h4>
            <p>${a.name} is running dangerously low. Count: <b>${a.stock}</b> (Threshold: ${a.threshold})</p>
          </div>
          <button class="alert-dismiss" onclick="acknowledgeAlertId('${a.display_id}')">&times;</button>
        `;

        container.appendChild(card);
      });
      lucide.createIcons();
    });
}

function acknowledgeAlertId(skuCode) {
  acknowledgedAlerts.add(skuCode);
  const el = document.getElementById(`low-stock-alert-${skuCode}`);
  if (el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(50px)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }
}

// -------------------------------------------------------------------------
// HELPER AUXILIARY MODAL TRIGGERS
// -------------------------------------------------------------------------
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
  // Re-enable body scroll if modals stacked
}

// POS Return Picker table helper
function openReturnItemPicker() {
  document.getElementById('sp-sales-items-body').innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Retrieving recent sales...</td></tr>';
  openModal('modal-sale-item-picker');

  // Query database of completed sales using custom diagnostic reports endpoint
  fetch('/api/reports/query?type=daily_sales')
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('sp-sales-items-body');
      tbody.innerHTML = '';
      
      if (!data.sales || data.sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No sales record completed on the machine today. Use report filters for older weeks.</td></tr>';
        return;
      }

      data.sales.forEach(s => {
        // Query items for this sale
        // For simple offline return setup, we offer quick selection of the whole block or we can let them input refund
        const label = `${s.total_amount.toFixed(2)} ETB (${s.total_items} items, ${s.payment_type})`;
        tbody.innerHTML += `
          <tr id="sp-row-${s.sale_number}">
            <td style="font-family:var(--font-mono); font-weight:600; color:#fff;">${s.sale_number}</td>
            <td style="font-size:11px;">${new Date(s.created_at).toLocaleTimeString()}</td>
            <td>${label}</td>
            <td>
              <button class="btn btn-primary" style="padding:4px 8px; font-size:11px;" onclick="selectReturnDetails('${s.id}', null, '${s.sale_number}', 'Whole purchase refund', ${s.total_amount})">Select</button>
            </td>
          </tr>
        `;
      });
    });
}

// -------------------------------------------------------------------------
// ONBOARDING WIZARD LOGIC (First Login Setup)
// -------------------------------------------------------------------------
let onboardingState = {
  currentStep: 1,
  mode: 'templates', // 'templates' or 'empty'
  templates: [],
  selectedTemplateIds: [],
  businessDescription: '',
  suggestedCategories: []
};

async function checkOnboarding() {
  if (!currentUser || currentUser.role_type !== 'owner') return;

  try {
    const res = await fetch('/api/onboarding/status');
    const data = await res.json();

    if (data.isComplete === false) {
      onboardingState.templates = data.templates || [];
      openOnboardingWizard();
    }
  } catch (err) {
    console.error('Failed to check onboarding status:', err);
  }
}

function openOnboardingWizard() {
  onboardingState.currentStep = 1;
  onboardingState.selectedTemplateIds = [];
  onboardingState.businessDescription = '';
  onboardingState.suggestedCategories = [];
  
  document.getElementById('modal-onboarding').classList.add('active');
  updateOnboardingUI();
}

function setOnboardingMode(mode) {
  onboardingState.mode = mode;
  if (mode === 'empty') {
    // Skip directly to a simplified finalize or just move to a confirm step
    // But requirement says "Allow choosing template OR empty system"
    // If empty system, we can just finalize.
  }
  onboardingNext();
}

function onboardingNext() {
  if (onboardingState.currentStep === 1) {
    if (onboardingState.mode === 'empty') {
      finalizeOnboarding(true); 
      return;
    }
    onboardingState.currentStep = 2;
    renderOnboardingTemplates();
  } else if (onboardingState.currentStep === 2) {
    if (onboardingState.selectedTemplateIds.length === 0) {
      showToast('Please select at least one template.', 'warning');
      return;
    }
    onboardingState.currentStep = 3;
  } else if (onboardingState.currentStep === 3) {
    const desc = document.getElementById('onboarding-description').value.trim();
    if (!desc) {
      document.getElementById('onboarding-description-error').style.display = 'block';
      return;
    }
    onboardingState.businessDescription = desc;
    document.getElementById('onboarding-description-error').style.display = 'none';
    fetchSuggestions(desc);
    onboardingState.currentStep = 4;
  } else if (onboardingState.currentStep === 4) {
    finalizeOnboarding(false);
    return;
  }
  updateOnboardingUI();
}

function onboardingPrev() {
  if (onboardingState.currentStep > 1) {
    onboardingState.currentStep--;
    updateOnboardingUI();
  }
}

function updateOnboardingUI() {
  const steps = [1, 2, 3, 4];
  steps.forEach(s => {
    const el = document.getElementById(`onboarding-step-${s}`);
    if (el) el.style.display = (onboardingState.currentStep === s) ? 'flex' : 'none';
    if (el) el.style.flexDirection = 'column';
  });

  // Progress Bar
  const progress = (onboardingState.currentStep / 4) * 100;
  document.getElementById('onboarding-progress').style.width = `${progress}%`;

  // Dots
  const dots = document.querySelectorAll('.onboarding-dot');
  dots.forEach((dot, index) => {
    dot.className = index === onboardingState.currentStep - 1 ? 'onboarding-dot active' : 'onboarding-dot';
  });

  // Buttons
  const nextBtn = document.getElementById('onboarding-next');
  const prevBtn = document.getElementById('onboarding-prev');

  prevBtn.style.visibility = onboardingState.currentStep === 1 ? 'hidden' : 'visible';
  nextBtn.innerHTML = onboardingState.currentStep === 4 ? 'Complete Setup <i data-lucide="check"></i>' : 'Continue <i data-lucide="chevron-right"></i>';
  
  if (window.lucide) lucide.createIcons();
}

function renderOnboardingTemplates() {
  const container = document.getElementById('onboarding-template-list');
  container.innerHTML = onboardingState.templates.map(t => `
    <div class="template-checkbox-card ${onboardingState.selectedTemplateIds.includes(t.id) ? 'selected' : ''}" onclick="toggleOnboardingTemplate('${t.id}')">
      <div style="width: 18px; height: 18px; border: 1px solid var(--border-glass); border-radius: 4px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3);">
        ${onboardingState.selectedTemplateIds.includes(t.id) ? '<i data-lucide="check" style="width:12px; height:12px; color:var(--accent-color);"></i>' : ''}
      </div>
      <div style="flex: 1;">
        <div style="font-size: 14px; font-weight: 600; color: #fff;">${t.name}</div>
        <div style="font-size: 10px; color: var(--text-secondary);">${t.description}</div>
      </div>
    </div>
  `).join('');
  if (window.lucide) lucide.createIcons();
}

function toggleOnboardingTemplate(id) {
  const index = onboardingState.selectedTemplateIds.indexOf(id);
  if (index === -1) {
    onboardingState.selectedTemplateIds.push(id);
  } else {
    onboardingState.selectedTemplateIds.splice(index, 1);
  }
  renderOnboardingTemplates();
}

async function fetchSuggestions(description) {
  try {
    const res = await fetch('/api/onboarding/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    });
    const data = await res.json();
    onboardingState.suggestedCategories = data.suggestions || [];
    renderOnboardingReview();
  } catch (err) {
    console.error('Failed to get suggestions:', err);
    renderOnboardingReview();
  }
}

function renderOnboardingReview() {
  const container = document.getElementById('onboarding-review-list');
  if (!container) return;
  
  // Aggregate categories from templates
  let templateCategories = new Set();
  onboardingState.selectedTemplateIds.forEach(id => {
    const t = onboardingState.templates.find(temp => temp.id === id);
    if (t) t.categories.forEach(cat => templateCategories.add(cat));
  });

  const categories = [
    ...Array.from(templateCategories).map(cat => ({ name: cat, type: 'template' })),
    ...onboardingState.suggestedCategories.map(cat => ({ name: cat, type: 'suggestion' }))
  ];

  if (categories.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No categories selected.</div>';
    return;
  }

  container.innerHTML = categories.map((cat, idx) => `
    <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.02); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-glass);">
      <input type="checkbox" checked id="cat-review-${idx}" data-cat-name="${cat.name}" style="width: 14px; height: 14px; accent-color: var(--accent-color);">
      <div style="flex: 1; overflow: hidden;">
        <div style="font-size: 13px; font-weight: 500; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cat.name}</div>
        <div style="font-size: 9px; text-transform: uppercase; color: ${cat.type === 'template' ? 'var(--text-muted)' : 'var(--accent-warning)'};">${cat.type === 'template' ? 'From Template' : 'AI Suggested'}</div>
      </div>
    </div>
  `).join('');
}

async function finalizeOnboarding(isEmpty) {
  let customCategories = [];
  if (!isEmpty) {
    const checkboxes = document.querySelectorAll('#onboarding-review-list input[type="checkbox"]:checked');
    checkboxes.forEach(cb => customCategories.push(cb.getAttribute('data-cat-name')));
  }

  try {
    const res = await fetch('/api/onboarding/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedTemplateIds: onboardingState.selectedTemplateIds,
        businessDescription: onboardingState.businessDescription,
        emptySystem: isEmpty,
        customCategories
      })
    });
    
    const data = await res.json();
    if (data.success) {
      showToast('Onboarding complete! Your shop categories are ready.', 'success');
      closeModal('modal-onboarding');
      // Refresh categories list
      loadCategories();
    } else {
      showToast(data.error || 'Failed to complete onboarding.', 'error');
    }
  } catch (err) {
    console.error('Failed to finalize onboarding:', err);
    showToast('Network error during onboarding.', 'error');
  }
}

function confirmResetOnboarding() {
  showConfirm(
    'Are you sure you want to reset the onboarding wizard? This will not delete existing categories, but will show the setup guide again on next login.',
    () => {
      fetch('/api/onboarding/reset', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showToast('Onboarding state reset successfully.', 'success');
          }
        });
    },
    null,
    'Reset Setup Wizard'
  );
}
