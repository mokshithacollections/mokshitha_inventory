// ============================================================
// AUTH / ACCOUNT — shared by every signed-in page
//
//  1. Attaches the CSRF token to every mutating fetch()
//  2. Turns an expired session into a clean redirect, not a crash
//  3. Fills the account bar and drives the Change Password dialog
// ============================================================

(function () {
    'use strict';

    // ---- CSRF token, published by each template as <meta> tags -------------
    function meta(name) {
        var el = document.querySelector('meta[name="' + name + '"]');
        return el ? el.getAttribute('content') : null;
    }
    var CSRF_TOKEN  = meta('_csrf');
    var CSRF_HEADER = meta('_csrf_header') || 'X-XSRF-TOKEN';

    // ------------------------------------------------------------------
    //  Patch window.fetch
    //
    //  Doing it here, once, means none of the existing call sites in
    //  home.js / purchases.js / analysis.js had to change when CSRF was
    //  switched on. Only same-origin, state-changing requests are touched.
    // ------------------------------------------------------------------
    var SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];

    function isSameOrigin(url) {
        try {
            return new URL(url, window.location.href).origin === window.location.origin;
        } catch (e) {
            return false;
        }
    }

    var nativeFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
        init = init || {};

        var url    = (typeof input === 'string') ? input : (input && input.url) || '';
        var method = (init.method || (input && input.method) || 'GET').toUpperCase();

        if (CSRF_TOKEN && SAFE_METHODS.indexOf(method) === -1 && isSameOrigin(url)) {
            // Headers may arrive as a Headers object, an array, or a plain object.
            var headers = new Headers(init.headers || (input && input.headers) || {});
            if (!headers.has(CSRF_HEADER)) headers.set(CSRF_HEADER, CSRF_TOKEN);
            init = Object.assign({}, init, { headers: headers });
            // Needed so the session cookie rides along on every request.
            if (!init.credentials) init.credentials = 'same-origin';
        }

        return nativeFetch(input, init).then(function (response) {
            // The server answers 401 (not a redirect) for /api/** once the
            // session is gone — see SecurityConfig. Send the user to the
            // login page rather than letting JSON.parse() fail on login HTML.
            if (response.status === 401) {
                window.location.href = '/login?expired';
            }
            return response;
        });
    };

    // ------------------------------------------------------------------
    //  Account bar + Change Password
    // ------------------------------------------------------------------
    function byId(id) { return document.getElementById(id); }

    function loadAccount() {
        var nameEl = byId('acctName');
        if (!nameEl) return;                 // page has no account bar

        fetch('/api/account/me')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (me) {
                if (!me) return;
                nameEl.textContent = me.displayName || me.username;
                var mailEl = byId('acctEmail');
                if (mailEl) mailEl.textContent = me.username;
                var lastEl = byId('acctLastLogin');
                if (lastEl) {
                    lastEl.textContent = me.lastLoginAt
                        ? 'Last signed in ' + me.lastLoginAt
                        : 'First sign-in';
                }
            })
            .catch(function () { /* bar just stays on its placeholder text */ });
    }

    // ---- Change Password dialog ----
    window.openChangePassword = function () {
        var modal = byId('changePasswordModal');
        if (!modal) return;
        ['cpCurrent', 'cpNew', 'cpConfirm'].forEach(function (id) {
            var el = byId(id);
            if (el) el.value = '';
        });
        setCpMessage('', null);
        modal.style.display = 'flex';
        setTimeout(function () { var f = byId('cpCurrent'); if (f) f.focus(); }, 60);
    };

    window.closeChangePassword = function () {
        var modal = byId('changePasswordModal');
        if (modal) modal.style.display = 'none';
    };

    function setCpMessage(text, kind) {
        var el = byId('cpMessage');
        if (!el) return;
        el.textContent = text || '';
        el.className = 'cp-message' + (kind ? ' ' + kind : '');
    }

    window.submitChangePassword = function () {
        var btn     = byId('cpSaveBtn');
        var current = (byId('cpCurrent') || {}).value || '';
        var next    = (byId('cpNew') || {}).value || '';
        var confirm = (byId('cpConfirm') || {}).value || '';

        // Cheap checks up front so the obvious mistakes never need a round trip.
        if (!current)                 { setCpMessage('Enter your current password.', 'error'); return; }
        if (!next)                    { setCpMessage('Enter a new password.', 'error'); return; }
        if (next.length < 10)         { setCpMessage('New password must be at least 10 characters.', 'error'); return; }
        if (next !== confirm)         { setCpMessage('New password and confirmation do not match.', 'error'); return; }
        if (next === current)         { setCpMessage('New password must be different from the current one.', 'error'); return; }

        btn.disabled = true;
        setCpMessage('Saving…', null);

        fetch('/api/account/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currentPassword: current,
                newPassword: next,
                confirmPassword: confirm
            })
        })
        .then(function (r) {
            return r.json().then(function (body) { return { ok: r.ok, body: body }; });
        })
        .then(function (res) {
            if (!res.ok) {
                setCpMessage(res.body.error || 'Could not change the password.', 'error');
                btn.disabled = false;
                return;
            }
            // The server ends the session on success, so go and sign in again.
            setCpMessage('Password changed. Redirecting to sign in…', 'ok');
            setTimeout(function () { window.location.href = '/login?changed'; }, 1100);
        })
        .catch(function () {
            setCpMessage('Network error. Please try again.', 'error');
            btn.disabled = false;
        });
    };

    // ---- Logout (posts the real form so the CSRF token is sent) ----
    window.doLogout = function () {
        if (!window.confirm('Sign out of Mokshitha Inventory?')) return;
        var form = byId('logoutForm');
        if (form) form.submit();
    };

    // ---- Wiring ----
    document.addEventListener('DOMContentLoaded', function () {
        loadAccount();

        var modal = byId('changePasswordModal');
        if (modal) {
            // Click the backdrop to dismiss.
            modal.addEventListener('mousedown', function (e) {
                if (e.target === modal) window.closeChangePassword();
            });
            // Enter submits from any of the three fields.
            ['cpCurrent', 'cpNew', 'cpConfirm'].forEach(function (id) {
                var el = byId(id);
                if (el) el.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') { e.preventDefault(); window.submitChangePassword(); }
                });
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            var m = byId('changePasswordModal');
            if (m && m.style.display !== 'none') window.closeChangePassword();
        });
    });
})();
