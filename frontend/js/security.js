// Bloquear clic derecho
document.addEventListener('contextmenu', e => e.preventDefault());

// Bloquear atajos de teclado de DevTools
document.addEventListener('keydown', e => {
  const k = e.key;
  // F12
  if (k === 'F12') { e.preventDefault(); return false; }
  // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (inspector)
  if (e.ctrlKey && e.shiftKey && ['I','i','J','j','C','c'].includes(k)) { e.preventDefault(); return false; }
  // Ctrl+U (ver fuente)
  if (e.ctrlKey && ['U','u'].includes(k)) { e.preventDefault(); return false; }
  // Ctrl+S (guardar página)
  if (e.ctrlKey && ['S','s'].includes(k)) { e.preventDefault(); return false; }
  // F5 con Ctrl (hard refresh que a veces abre panel)
  if (e.ctrlKey && k === 'F5') { e.preventDefault(); return false; }
});

// Detectar DevTools abierto y redirigir
(function detectDevTools() {
  const threshold = 160;
  function check() {
    const widthDiff  = window.outerWidth  - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    if (widthDiff > threshold || heightDiff > threshold) {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;font-size:1.2rem;color:#333">⛔ Acceso no permitido</div>';
    }
  }
  setInterval(check, 1000);
})();
