(function() {
  const getTheme = () => {
    const saved = localStorage.getItem('uwrms_theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  };

  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
  };

  applyTheme(getTheme());

  window.toggleTheme = function() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('uwrms_theme', next);
    
    // Dispatch event so icons can update if needed
    window.dispatchEvent(new CustomEvent('themechanged', { detail: next }));
  };

  // Listen for system changes
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
    if (!localStorage.getItem('uwrms_theme')) {
      applyTheme(e.matches ? 'light' : 'dark');
    }
  });
})();
