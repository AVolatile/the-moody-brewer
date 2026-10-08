(function () {
  var notice = document.getElementById('closure-notice');
  if (!notice || typeof notice.showModal !== 'function') return;

  var expiresAt = Date.parse(notice.dataset.expiresAt);
  var dismissalKey = 'moody-brewer:closure:2026-10-12:2026-11-02';

  // The explicit Eastern offset prevents visitor time zones changing the end date.
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) return;

  try {
    if (sessionStorage.getItem(dismissalKey) === 'dismissed') return;
  } catch (error) {
    // Visitors with storage disabled can still read and dismiss the notice.
  }

  notice.addEventListener('close', function () {
    document.body.classList.remove('closure-notice-open');
    try {
      sessionStorage.setItem(dismissalKey, 'dismissed');
    } catch (error) {
      // Dismissal remains functional when session storage is unavailable.
    }
  });

  notice.showModal();
  document.body.classList.add('closure-notice-open');
})();
