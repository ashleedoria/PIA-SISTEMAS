const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chapters = $$('.chapter');
const nav = $('#nav'), input = $('#q'), results = $('#results');
let pendingTerm = '';
$$('img[data-opc]').forEach(img => {
  const fail = () => img.classList.add('vacia');
  img.addEventListener('error', fail);
  if (img.complete && !img.naturalWidth) fail();
});

// n de ilustraciones
$$('figcaption').forEach((f, i) => f.prepend(`Ilustración ${i + 1}. `));

// menu
let n = 0;
chapters.forEach((c, i) => {
  if (!c.hasAttribute('data-nonum')) c.num = ++n;
});
const total = n;
chapters.forEach((c, i) => {
  const label = c.num ? `${c.num}. ${c.dataset.title}` : c.dataset.title;
  nav.insertAdjacentHTML('beforeend', `<a href="#${c.id}">${label}</a>`);
  if (c.num) {
    $('#cards').insertAdjacentHTML('beforeend', `<a class="card" href="#${c.id}"><b>${label}</b><small>${c.dataset.desc}</small></a>`);
    c.insertAdjacentHTML('afterbegin', `<p class="tag">Capítulo ${c.num} de ${total}</p>`);
  }
  if (i) {
    const next = chapters[i + 1];
    c.insertAdjacentHTML('beforeend', `<div class="pager"><a href="#${chapters[i - 1].id}">← ${chapters[i - 1].dataset.title}</a>${next ? `<a href="#${next.id}">${next.dataset.title} →</a>` : '<span></span>'}</div>`);
  }
});

// mostrar pantalla
function show(id) {
  chapters.forEach(c => {
    c.classList.toggle('active', c.id === id);
    highlight(c, c.id === id ? pendingTerm : '');
  });
  $$('#nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
  nav.classList.remove('open');

  const hits = $$('.chapter.active mark.hit');
  hits.forEach(m => {
    const d = m.closest('details'); if (d) d.open = true;
    const p = m.closest('.panel'); if (p) $(`[data-t="${p.id}"]`).click();
  });
  if (hits[0]) hits[0].scrollIntoView({ block: 'center' }); else window.scrollTo(0, 0);
  pendingTerm = '';
}
function route() {
  const id = location.hash.slice(1);
  show(chapters.some(c => c.id === id) ? id : 'portada');
}

function highlight(root, term) {
  root.querySelectorAll('mark.hit').forEach(m => m.replaceWith(m.textContent));
  root.normalize();
  if (!term) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
  while (w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach(t => {
    const pos = norm(t.data).indexOf(term);
    if (pos < 0) return;
    const f = t.splitText(pos); f.splitText(term.length);
    const m = document.createElement('mark'); m.className = 'hit';
    f.replaceWith(m); m.append(f);
  });
}

// buscador
function search(term) {
  const hits = [];
  chapters.filter(c => !c.hasAttribute('data-nosearch')).forEach(c => {
    let count = 0;
    c.querySelectorAll('p:not(.tag):not(.out), li, td, dd, dt, h2, h3, summary').forEach(el => {
      const text = el.textContent.trim(), pos = norm(text).indexOf(term);
      if (pos < 0 || count >= 2) return;
      count++;
      const s = Math.max(0, pos - 40), a = pos - s;
      const piece = text.slice(s, pos + term.length + 70);
      hits.push({ id: c.id, title: c.dataset.title, html: (s ? '…' : '') + esc(piece.slice(0, a)) + '<mark>' + esc(piece.slice(a, a + term.length)) + '</mark>' + esc(piece.slice(a + term.length)) + '…' });
    });
  });
  return hits;
}
input.addEventListener('input', () => {
  const term = norm(input.value.trim());
  if (term.length < 2) { results.hidden = true; return; }
  const hits = search(term);
  results.innerHTML = hits.length
    ? hits.map(h => `<a href="#${h.id}" data-term="${esc(term)}"><strong>${h.title}</strong><span>${h.html}</span></a>`).join('')
    : `<span class="vacio">Sin resultados para "${esc(input.value)}". Prueba con otra palabra.</span>`;
  results.hidden = false;
});
results.addEventListener('click', e => {
  const a = e.target.closest('a'); if (!a) return;
  e.preventDefault();
  pendingTerm = a.dataset.term;
  results.hidden = true;
  if (location.hash === a.getAttribute('href')) route(); else location.hash = a.getAttribute('href');
});
document.addEventListener('click', e => { if (!e.target.closest('.search')) results.hidden = true; });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { results.hidden = true; input.blur(); }
  if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
});

// pestañas
$$('.tabs').forEach(tabs => tabs.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  tabs.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  tabs.parentElement.querySelectorAll('.panel').forEach(p => p.classList.toggle('on', p.id === b.dataset.t));
}));

// botones explican
$$('.explorer').forEach(w => w.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  w.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  w.querySelector('.out').textContent = b.dataset.info;
}));

// lista instalacion
const checks = $$('.check input');
checks.forEach(c => c.addEventListener('change', () => {
  c.closest('li').classList.toggle('done', c.checked);
  const done = checks.filter(x => x.checked).length;
  $('#prog').value = done;
  $('#progTxt').textContent = done === checks.length ? '¡Instalación completa!' : `${done} de ${checks.length} pasos`;
}));

// simulador ram
const apps = $('#apps');
function updateRam() {
  const n = +apps.value, used = 1 + n * 0.45;           // 1 GB base + 0.45 GB por programa
  const ram = Math.min(4, used), swap = Math.min(2, Math.max(0, used - 4));
  $('#nApps').textContent = n;
  $('#ramBar').style.width = ram / 4 * 100 + '%';
  $('#swapBar').style.width = swap / 2 * 100 + '%';
  $('#ramMsg').textContent = used > 6 ? 'RAM y swap agotadas: el sistema se vuelve muy lento y puede cerrar procesos.'
    : used > 4 ? 'La RAM se llenó: el sistema empieza a usar la swap del disco (más lenta).'
    : 'Hay suficiente RAM disponible, todo funciona con fluidez.';
}
apps.addEventListener('input', updateRam); updateRam();

// terminal
const out = $('#tout'), tin = $('#tin');
const cmds = {
  help: 'Comandos: help, pwd, ls, whoami, date, uname -r, free -h, df -h, ps, clear',
  pwd: '/home/mint',
  ls: 'Descargas  Documentos  Escritorio  Imágenes  Música  Videos',
  whoami: 'mint',
  date: new Date().toLocaleString('es-MX'),
  'uname -r': '6.8.0-generic',
  'free -h': '        total   usada   libre\nMem:    3,8Gi   1,2Gi   1,9Gi\nSwap:   2,0Gi      0B   2,0Gi',
  'df -h': 'S.ficheros  Tamaño  Usados  Disp  Uso%  Montado en\n/dev/sda2      98G     21G   72G   23%  /',
  ps: '  PID TTY      CMD\n    1 ?        systemd\n 1204 ?        cinnamon\n 2310 pts/0    bash'
};
tin.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const c = tin.value.trim().replace(/\s+/g, ' ');
  tin.value = '';
  if (c === 'clear') { out.textContent = ''; return; }
  out.textContent += `\nmint@pc:~$ ${c}\n` + (c ? (cmds[c] ?? `${c}: comando no encontrado (escribe help)`) : '');
  out.scrollTop = out.scrollHeight;
});

// filtro glosario p 
$('#gf').addEventListener('input', e => {
  const t = norm(e.target.value);
  let visibles = 0;
  $$('#gloss > div').forEach(d => { const ok = norm(d.textContent).includes(t); d.hidden = !ok; visibles += ok; });
  $('#gfVacio').hidden = visibles > 0;
});

window.addEventListener('hashchange', route);
route();
