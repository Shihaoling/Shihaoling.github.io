import { profile } from './profile.js';
import { initFootprints } from './footprints.js';

const $ = (selector) => document.querySelector(selector);
const escape = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const tags = (items) => `<div class="tag-list">${items.map(item => `<span class="tag">${escape(item)}</span>`).join('')}</div>`;
const safeLink = (url) => {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.href);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch { return ''; }
};
const externalLink = (url, text, className = '') => {
  const href = safeLink(url);
  return href ? `<a class="${escape(className)}" href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(text)} ↗</a>` : '';
};

$('#intro').textContent = profile.intro;
$('#hero-title').textContent = profile.name;
$('#hero-english').textContent = profile.englishName;
$('#hero-location').textContent = `目前常驻${profile.currentBase}`;
const icons = {
  education: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5L2 9Z"/><path d="M6 11v6c3 3 9 3 12 0v-6M22 9v8"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 5v15M12 6C9 3 4 4 3 5v14c3-2 6-2 9 1 3-3 6-3 9-1V5c-2-1-6-2-9 1Z"/></svg>',
  work: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12c5 4 13 4 18 0M10 14h4"/></svg>',
};
$('#hero-facts').innerHTML = profile.education.map((item, index) => `
  <div class="profile-fact"><dt>${index === 0 ? icons.education : icons.book}<span>${index === 0 ? '硕士' : '本科'}</span></dt><dd><strong>${escape(item.school)}</strong><span class="fact-major">${escape(item.major)}</span><small>${escape(item.faculty)}</small><small class="fact-period">${escape(item.period)}</small></dd></div>`).join('') + `
  <div class="profile-fact profile-fact-wide"><dt>${icons.work}<span>实习经历</span></dt><dd class="internship-chips">${profile.experiences.map(item => `<span>${escape(item.id === 'pingan' ? '平安银行信用卡中心' : item.company)}</span>`).join('')}</dd></div>`;
initFootprints(profile.travel);
$('#travel-summary').textContent = `常驻${profile.travel.base.name} · 到访过 ${profile.travel.visits.length} 个国家或地区 · 想去 ${profile.travel.wishlist.length} 个`;

// Fade only the scenic background; text and controls remain fully readable.
const ocean = $('.ocean-scene');
const hero = $('#home');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let scheduled = false;
function updateOcean() {
  const distance = Math.max(1, hero.offsetHeight * .85);
  const progress = Math.min(1, Math.max(0, window.scrollY / distance));
  const opacity = reducedMotion.matches ? (window.scrollY < hero.offsetHeight ? 1 : 0) : 1 - progress;
  document.documentElement.style.setProperty('--ocean-opacity', opacity.toFixed(3));
  document.documentElement.style.setProperty('--header-opacity', (.35 + .62 * progress).toFixed(3));
  ocean.style.visibility = opacity === 0 ? 'hidden' : 'visible';
  scheduled = false;
}
function scheduleOcean() {
  if (!scheduled) { scheduled = true; requestAnimationFrame(updateOcean); }
}
window.addEventListener('scroll', scheduleOcean, { passive: true });
window.addEventListener('resize', scheduleOcean);
window.addEventListener('pageshow', scheduleOcean);
reducedMotion.addEventListener('change', scheduleOcean);
updateOcean();
$('#updated').textContent = profile.updated;
$('#education-list').innerHTML = profile.education.map(item => `
  <article class="education-item"><span class="edu-index">${escape(item.mark)}</span><div>
    <div class="edu-meta"><span>${escape(item.period)}</span><span class="edu-degree">${escape(item.degree)}</span></div>
    <h3>${escape(item.school)}</h3><p class="edu-en">${escape(item.en)}</p>
    <p class="edu-major">${escape(item.major)}</p><p class="edu-faculty">${escape(item.faculty)}</p><p class="edu-note">${escape(item.note)}</p>
  </div></article>`).join('');
$('#honors').innerHTML = profile.honors.map(honor => `<span>${escape(honor)}</span>`).join('');

$('#experience-tabs').innerHTML = profile.experiences.map((item, index) => `
  <button class="experience-tab" role="tab" id="tab-${escape(item.id)}" aria-controls="panel-${escape(item.id)}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" data-experience="${escape(item.id)}">
    <span class="tab-company">${escape(item.company)}</span><span class="tab-period">${escape(item.period)}</span><span class="tab-arrow" aria-hidden="true">↗</span>
  </button>`).join('');
$('#experience-panels').innerHTML = profile.experiences.map((item, index) => `
  <article class="experience-panel" role="tabpanel" id="panel-${escape(item.id)}" aria-labelledby="tab-${escape(item.id)}" tabindex="0" ${index ? 'hidden' : ''}>
    <p class="exp-period">${escape(item.period)}</p><h3>${escape(item.role)}</h3><p class="exp-department">${escape(item.fullName)} / ${escape(item.department)}</p>
    <h4 class="exp-summary">${escape(item.summary)}</h4><p class="exp-description">${escape(item.description)}</p>
    <ul class="exp-points">${item.points.map(point => `<li>${escape(point)}</li>`).join('')}</ul>${tags(item.tags)}
  </article>`).join('');

const tabs = [...document.querySelectorAll('[data-experience]')];
function selectExperience(tab, focus = false) {
  tabs.forEach(item => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  });
  if (focus) tab.focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectExperience(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (['ArrowDown', 'ArrowRight'].includes(event.key)) next = (index + 1) % tabs.length;
    if (['ArrowUp', 'ArrowLeft'].includes(event.key)) next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectExperience(tabs[next], true); }
  });
});
const mobile = window.matchMedia('(max-width: 600px)');
const updateTabOrientation = () => $('#experience-tabs').setAttribute('aria-orientation', mobile.matches ? 'horizontal' : 'vertical');
updateTabOrientation();
mobile.addEventListener('change', updateTabOrientation);

// Original vector method sketches, not screenshots or experimental results.
const artwork = {
  network: `<svg viewBox="0 0 300 160" fill="none" aria-hidden="true"><g stroke="#7898a9" stroke-width="1"><path d="M45 79L102 35L150 85L89 124L45 79L150 85L207 42L255 93L212 132L150 85L255 93M102 35L207 42M89 124L212 132"/><path d="M45 79L207 42M102 35L212 132" stroke-dasharray="3 5" opacity=".5"/></g><circle cx="150" cy="85" r="28" stroke="#8da8b6" stroke-dasharray="3 4"/><g fill="#f7fafb" stroke="#5b7e93"><circle cx="45" cy="79" r="9"/><circle cx="102" cy="35" r="7"/><circle cx="89" cy="124" r="9"/><circle cx="207" cy="42" r="9"/><circle cx="255" cy="93" r="7"/><circle cx="212" cy="132" r="8"/></g><circle cx="150" cy="85" r="13" fill="#31576f"/><circle cx="150" cy="85" r="4" fill="#f4f8fa"/><circle cx="207" cy="42" r="3" fill="#b9704e"/><circle cx="89" cy="124" r="3" fill="#b9704e"/></svg>`,
  pipeline: `<svg viewBox="0 0 300 160" fill="none" aria-hidden="true"><path d="M74 80H125M176 80H224" stroke="#ad9680" stroke-dasharray="3 4"/><path d="M116 76L121 80L116 84M215 76L220 80L215 84" stroke="#ad9680"/><rect x="22" y="54" width="52" height="54" rx="5" fill="#faf8f3" stroke="#ac9983"/><ellipse cx="48" cy="54" rx="26" ry="8" fill="#f7f3eb" stroke="#ac9983"/><path d="M22 72C22 82 74 82 74 72M22 89C22 99 74 99 74 89" stroke="#ac9983"/><rect x="125" y="54" width="51" height="54" rx="5" fill="#f7f3eb" stroke="#ac9983"/><path d="M141 72L133 81L141 90M160 72L168 81L160 90M153 68L147 94" stroke="#a16642" stroke-width="1.5"/><rect x="225" y="45" width="49" height="68" rx="4" fill="#faf8f3" stroke="#ac9983"/><path d="M235 59H262M235 66H253" stroke="#b6a58e"/><path d="M237 99V86M248 99V78M259 99V70" stroke="#a16642" stroke-width="5"/><text x="47" y="137" text-anchor="middle" fill="#877762" font-size="9" font-family="Arial">DATA</text><text x="150" y="137" text-anchor="middle" fill="#877762" font-size="9" font-family="Arial">PROCESS</text><text x="250" y="137" text-anchor="middle" fill="#877762" font-size="9" font-family="Arial">REPORT</text></svg>`,
  routing: `<svg viewBox="0 0 300 160" fill="none" aria-hidden="true"><g stroke="#cfdbcf" stroke-width=".7"><path d="M20 40H280M20 80H280M20 120H280M60 20V145M120 20V145M180 20V145M240 20V145"/></g><path d="M34 119L84 119L130 66L209 66L267 118" stroke="#627d68" stroke-width="2"/><path d="M84 119L105 36L209 66M130 66L200 129L267 118" stroke="#b87c50" stroke-width="1.5" stroke-dasharray="4 5"/><g fill="#f5f8f3" stroke="#6a826d" stroke-width="1.5"><circle cx="34" cy="119" r="5"/><circle cx="84" cy="119" r="5"/><circle cx="130" cy="66" r="5"/><circle cx="209" cy="66" r="5"/><circle cx="267" cy="118" r="5"/></g><g fill="#b87c50"><path d="M105 30L111 36L105 42L99 36Z"/><path d="M200 123L206 129L200 135L194 129Z"/></g><rect x="151" y="55" width="24" height="12" rx="2" fill="#627d68"/><rect x="175" y="59" width="9" height="8" rx="2" fill="#627d68"/><g fill="#eaf0e9" stroke="#627d68" stroke-width="1.5"><circle cx="157" cy="69" r="3"/><circle cx="178" cy="69" r="3"/></g></svg>`,
};

$('#projects').innerHTML = profile.projects.map(project => `
  <article class="project-card" data-category="${escape(project.category)}">
    <div class="project-art ${escape(project.visual)}">${artwork[project.visual] || artwork.network}<span class="art-label">${escape(project.type)} / 方法示意</span></div>
    <div class="project-body"><p class="project-context">${escape(project.context)}</p><h3>${escape(project.title)}</h3><p class="project-summary">${escape(project.summary)}</p>${tags(project.tags)}
    <button class="project-open" data-project="${escape(project.id)}" aria-haspopup="dialog" aria-label="了解项目：${escape(project.title)}"><span>查看详情</span><span aria-hidden="true">↗</span></button></div>
  </article>`).join('');

document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-filter]').forEach(item => {
    item.classList.toggle('active', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  });
  let visibleCount = 0;
  document.querySelectorAll('[data-category]').forEach(card => {
    card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter;
    if (!card.hidden) visibleCount++;
  });
  $('#filter-status').textContent = `正在显示${button.textContent}，共 ${visibleCount} 个项目。`;
}));

const dialog = $('#project-dialog');
let projectTrigger;
document.querySelectorAll('[data-project]').forEach(button => button.addEventListener('click', () => {
  const project = profile.projects.find(item => item.id === button.dataset.project);
  if (!project) return;
  projectTrigger = button;
  $('#dialog-content').innerHTML = `<p class="dialog-context">${escape(project.context)}</p><h2 id="dialog-title">${escape(project.title)}</h2>${tags(project.tags)}
    <div class="dialog-block"><h3>问题与场景</h3><p>${escape(project.challenge)}</p></div>
    <div class="dialog-block"><h3>方法与思路</h3><p>${escape(project.approach)}</p></div>
    <div class="dialog-block"><h3>我的参与</h3><p>${escape(project.contribution)}</p></div>
    <p class="dialog-footnote">${safeLink(project.link) ? externalLink(project.link, '查看相关作品') : '项目公开链接与更多展示材料待补充。'}</p>`;
  dialog.showModal();
  document.body.classList.add('modal-open');
  $('#close-dialog').focus();
}));
$('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.classList.remove('modal-open');
  projectTrigger?.focus();
});

$('#papers').innerHTML = profile.papers.map((paper, index) => `
  <article class="paper-row"><details class="paper-item"><summary><span class="paper-index">${String(index + 1).padStart(2, '0')}</span><span class="paper-title">${escape(paper.chinese)}<span class="paper-venue">${escape(paper.venue)}</span></span><span class="paper-status">${escape(paper.status)}</span><span class="paper-plus" aria-hidden="true">+</span></summary>
    <div class="paper-detail"><p class="paper-english" lang="en">${escape(paper.title)}</p><p>${escape(paper.note)}</p>${paper.citation ? `<p class="paper-citation" lang="en">${escape(paper.citation)}</p>` : ''}${paper.doi ? `<p class="paper-doi" lang="en">DOI: ${escape(paper.doi)}</p>` : ''}</div>
  </details><div class="paper-action">${safeLink(paper.link) ? externalLink(paper.link, '论文链接', 'paper-direct') : `<span class="paper-unavailable">${escape(paper.linkNote || '暂无公开链接')}</span>`}</div></article>`).join('');
$('#skills').innerHTML = profile.skills.map(skill => `<div class="skill-row"><h3>${escape(skill.title)}</h3><div class="skill-items">${skill.items.map(item => `<span>${escape(item)}</span>`).join('')}</div></div>`).join('');

if (profile.notes.length) {
  $('#notes').hidden = false;
  $('#notes-list').innerHTML = profile.notes.map(note => `<article class="note-card"><time>${escape(note.date)}</time><h3>${escape(note.title)}</h3><p>${escape(note.summary)}</p>${externalLink(note.url, '继续阅读', 'text-link')}</article>`).join('');
}
$('#email-link').href = `mailto:${encodeURIComponent(profile.email)}`;
$('#email-link').innerHTML = `${escape(profile.email)}<span aria-hidden="true">↗</span>`;
if (safeLink(profile.github)) $('#github-slot').outerHTML = externalLink(profile.github, 'GitHub', 'github-link');
if (safeLink(profile.resume)) $('#resume-slot').innerHTML = externalLink(profile.resume, '查看公开简历', 'resume-link');
$('#copy-email').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(profile.email);
    $('#copy-status').textContent = '邮箱已复制。';
  } catch {
    $('#copy-status').textContent = `请选中上方邮箱手动复制：${profile.email}`;
  }
});

const menu = $('.menu-toggle');
const nav = $('#main-nav');
function closeMenu() {
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', '打开导航');
  nav.classList.remove('open');
}
menu.addEventListener('click', () => {
  const expanded = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(expanded));
  menu.setAttribute('aria-label', expanded ? '关闭导航' : '打开导航');
  nav.classList.toggle('open', expanded);
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  const target = document.querySelector(link.hash);
  const wasOpen = nav.classList.contains('open');
  closeMenu();
  if (wasOpen && target) {
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
  }
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menu.focus(); }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu();
});
window.matchMedia('(min-width: 801px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

const navSections = [...nav.querySelectorAll('a')].map(link => ({ link, section: document.querySelector(link.hash) })).filter(item => item.section);
let navScheduled = false;
function updateActiveNav() {
  const threshold = Math.max(100, window.innerHeight * .25);
  let active = navSections[0];
  for (const item of navSections) if (item.section.getBoundingClientRect().top <= threshold) active = item;
  navSections.forEach(item => {
    if (item === active) item.link.setAttribute('aria-current', 'location');
    else item.link.removeAttribute('aria-current');
  });
  navScheduled = false;
}
function scheduleNav() {
  if (!navScheduled) { navScheduled = true; requestAnimationFrame(updateActiveNav); }
}
window.addEventListener('scroll', scheduleNav, { passive: true });
window.addEventListener('resize', scheduleNav);
window.addEventListener('pageshow', scheduleNav);
updateActiveNav();
