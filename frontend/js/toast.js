// Sistema de notificaciones tipo Toast
(function () {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.style.cssText = `
    position: fixed; top: 1.2rem; right: 1.2rem; z-index: 9999;
    display: flex; flex-direction: column; gap: .6rem;
    max-width: 340px; width: 100%;
    pointer-events: none;
  `;
  document.body.appendChild(container);

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const colors = {
    success: { bg: '#D4EDDA', border: '#82C341', text: '#155724' },
    error:   { bg: '#FFE5E5', border: '#FF6B6B', text: '#842029' },
    warning: { bg: '#FFF3CD', border: '#FFD93D', text: '#856404' },
    info:    { bg: '#E8FAF8', border: '#3DBDB7', text: '#1A4A44' },
  };

  window.toast = function (mensaje, tipo = 'info', duracion = 4000) {
    const c = colors[tipo] || colors.info;
    const t = document.createElement('div');
    t.style.cssText = `
      background: ${c.bg};
      border-left: 4px solid ${c.border};
      color: ${c.text};
      border-radius: 10px;
      padding: .85rem 1.1rem;
      box-shadow: 0 4px 20px rgba(0,0,0,.12);
      display: flex; align-items: flex-start; gap: .7rem;
      font-family: 'Poppins', sans-serif;
      font-size: .88rem; font-weight: 500;
      pointer-events: all;
      cursor: pointer;
      animation: toastIn .3s cubic-bezier(.4,0,.2,1) forwards;
      max-width: 100%;
      word-break: break-word;
    `;
    t.innerHTML = `
      <span style="font-size:1.1rem;flex-shrink:0;margin-top:.05rem">${icons[tipo]}</span>
      <span style="flex:1;line-height:1.5">${mensaje}</span>
      <span style="font-size:1rem;opacity:.5;flex-shrink:0">✕</span>
    `;

    const style = document.getElementById('toast-style');
    if (!style) {
      const s = document.createElement('style');
      s.id = 'toast-style';
      s.textContent = `
        @keyframes toastIn  { from { opacity:0; transform: translateX(30px); } to { opacity:1; transform: translateX(0); } }
        @keyframes toastOut { from { opacity:1; transform: translateX(0); }   to { opacity:0; transform: translateX(30px); } }
      `;
      document.head.appendChild(s);
    }

    const cerrar = () => {
      t.style.animation = 'toastOut .3s ease forwards';
      setTimeout(() => t.remove(), 300);
    };

    t.onclick = cerrar;
    container.appendChild(t);
    setTimeout(cerrar, duracion);
  };

  // Reemplaza window.alert con toast
  window.alert = (msg) => toast(msg, 'info');
})();
