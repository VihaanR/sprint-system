/**
 * Antigravity Live Swarm Visual Engine (pen.dev-grade aesthetic)
 * Zero-dependency, isolated overlay that renders animated multi-agent cursors,
 * selection bounding boxes, floating code streamers, and a glassmorphic HUD.
 */
(function() {
  if (window.__SWARM_INITIALIZED__) return;
  window.__SWARM_INITIALIZED__ = true;

  const AGENTS = [
    { id: 'orion', name: 'Orion', role: 'Layout & Grid', color: '#A855F7', glow: 'rgba(168, 85, 247, 0.45)' },
    { id: 'lyra',  name: 'Lyra',  role: 'Tokens & Style', color: '#10B981', glow: 'rgba(16, 185, 129, 0.45)' },
    { id: 'echo',  name: 'Echo',  role: 'State & Logic',  color: '#F59E0B', glow: 'rgba(245, 158, 11, 0.45)' },
    { id: 'nova',  name: 'Nova',  role: 'A11y & Audit',   color: '#0EA5E9', glow: 'rgba(14, 165, 233, 0.45)' }
  ];

  // Create isolated container
  const host = document.createElement('div');
  host.id = '__antigravity_swarm_host__';
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '999999';
  host.style.fontFamily = 'Inter, -apple-system, system-ui, sans-serif';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // Styles
  const style = document.createElement('style');
  style.textContent = `
    .swarm-cursor {
      position: absolute;
      top: 0;
      left: 0;
      transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
      will-change: transform;
      pointer-events: none;
      z-index: 100;
    }
    .cursor-svg {
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));
      transform-origin: 0 0;
    }
    .agent-tag {
      position: absolute;
      left: 14px;
      top: 14px;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #FFFFFF;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 5px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      backdrop-filter: blur(8px);
      letter-spacing: -0.01em;
    }
    .agent-action {
      font-weight: 400;
      opacity: 0.85;
      font-size: 10px;
    }
    .code-pill {
      position: absolute;
      left: 14px;
      top: 38px;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 6px;
      padding: 4px 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #38BDF8;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      white-space: nowrap;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 0.2s, transform 0.2s;
    }
    .code-pill.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .selection-box {
      position: absolute;
      border: 1.5px dashed;
      border-radius: 6px;
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
      opacity: 0;
    }
    .selection-box.active {
      opacity: 1;
    }
    .handle {
      position: absolute;
      width: 7px;
      height: 7px;
      background: #FFFFFF;
      border: 1.5px solid;
      border-radius: 2px;
    }
    .handle-tl { top: -4px; left: -4px; }
    .handle-tr { top: -4px; right: -4px; }
    .handle-bl { bottom: -4px; left: -4px; }
    .handle-br { bottom: -4px; right: -4px; }

    /* Glassmorphic Swarm HUD Dock */
    .swarm-hud {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.82);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 9999px;
      padding: 6px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.05);
      pointer-events: auto;
      z-index: 999;
      color: #F8FAFC;
      user-select: none;
    }
    .hud-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #94A3B8;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .hud-pulse {
      width: 7px;
      height: 7px;
      border-radius: 9999px;
      background: #10B981;
      box-shadow: 0 0 8px #10B981;
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    .hud-divider {
      width: 1px;
      height: 16px;
      background: rgba(255, 255, 255, 0.15);
    }
    .hud-stat {
      font-size: 11px;
      color: #CBD5E1;
      font-family: 'JetBrains Mono', monospace;
    }
    .hud-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 9999px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .hud-btn:hover {
      background: rgba(255, 255, 255, 0.16);
      transform: translateY(-1px);
    }
  `;
  shadow.appendChild(style);

  // Canvas for selection boxes & cursors
  const layer = document.createElement('div');
  layer.style.position = 'relative';
  layer.style.width = '100vw';
  layer.style.height = '100vh';
  shadow.appendChild(layer);

  // Build Cursors & Selection Boxes
  const cursorMap = {};
  const boxMap = {};

  AGENTS.forEach(agent => {
    // Selection box
    const box = document.createElement('div');
    box.className = 'selection-box';
    box.style.borderColor = agent.color;
    box.style.boxShadow = `0 0 16px ${agent.glow}`;
    ['tl', 'tr', 'bl', 'br'].forEach(pos => {
      const h = document.createElement('div');
      h.className = `handle handle-${pos}`;
      h.style.borderColor = agent.color;
      box.appendChild(h);
    });
    layer.appendChild(box);
    boxMap[agent.id] = box;

    // Cursor
    const c = document.createElement('div');
    c.className = 'swarm-cursor';
    c.innerHTML = `
      <svg class="cursor-svg" width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 3L20 11L12.5 13.5L9.5 21L4 3Z" fill="${agent.color}" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
      <div class="agent-tag" style="background: ${agent.color};">
        <span>${agent.name}</span>
        <span class="agent-action" id="action-${agent.id}">Ready</span>
      </div>
      <div class="code-pill" id="pill-${agent.id}">+ &lt;Component /&gt;</div>
    `;
    layer.appendChild(c);
    cursorMap[agent.id] = c;
  });

  // Build HUD
  const hud = document.createElement('div');
  hud.className = 'swarm-hud';
  hud.innerHTML = `
    <div class="hud-title"><span class="hud-pulse"></span> Antigravity Swarm</div>
    <div class="hud-divider"></div>
    <div class="hud-stat" id="__swarm_status_text__">4 Agents Active • HMR Ready</div>
    <div class="hud-divider"></div>
    <button class="hud-btn" id="__swarm_pause_toggle__">Pause</button>
    <button class="hud-btn" id="__swarm_hide_btn__">✕</button>
  `;
  shadow.appendChild(hud);

  // Global API for Antigravity agents to drive the visual layer
  window.__SWARM__ = {
    moveAgent: function(agentId, x, y, action, codeSnippet) {
      const c = cursorMap[agentId];
      if (!c) return;
      c.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const act = shadow.getElementById(`action-${agentId}`);
      if (act && action) act.textContent = action;
      
      const pill = shadow.getElementById(`pill-${agentId}`);
      if (pill && codeSnippet) {
        pill.textContent = codeSnippet;
        pill.classList.add('visible');
        setTimeout(() => pill.classList.remove('visible'), 2400);
      }
    },
    selectElement: function(agentId, selector) {
      const target = document.querySelector(selector);
      const box = boxMap[agentId];
      if (!target || !box) return;
      const rect = target.getBoundingClientRect();
      box.style.left = (rect.left + window.scrollX - 4) + 'px';
      box.style.top = (rect.top + window.scrollY - 4) + 'px';
      box.style.width = (rect.width + 8) + 'px';
      box.style.height = (rect.height + 8) + 'px';
      box.classList.add('active');
    },
    clearSelection: function(agentId) {
      const box = boxMap[agentId];
      if (box) box.classList.remove('active');
    },
    setStatus: function(msg) {
      const el = shadow.getElementById('__swarm_status_text__');
      if (el) el.textContent = msg;
    }
  };

  // Demo Autonomous Swarm Loop (if no external driver is sending coords)
  let isPaused = false;
  shadow.getElementById('__swarm_pause_toggle__').onclick = () => {
    isPaused = !isPaused;
    shadow.getElementById('__swarm_pause_toggle__').textContent = isPaused ? 'Resume' : 'Pause';
  };
  shadow.getElementById('__swarm_hide_btn__').onclick = () => {
    host.remove();
  };

  function runAutonomousDemo() {
    if (isPaused) return;
    const elements = document.querySelectorAll('button, a, h1, h2, h3, nav, header, card, div');
    const valid = Array.from(elements).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 30 && r.height > 20 && r.top >= 0 && r.bottom <= window.innerHeight;
    });

    if (valid.length > 0) {
      AGENTS.forEach((agent, idx) => {
        const targetEl = valid[(Math.floor(Math.random() * valid.length) + idx) % valid.length];
        const rect = targetEl.getBoundingClientRect();
        const destX = rect.left + (Math.random() * rect.width * 0.7);
        const destY = rect.top + (Math.random() * rect.height * 0.7);

        const actions = [
          'Aligning auto-layout',
          'Applying glassmorphism',
          'Refactoring state hook',
          'Auditing ARIA attributes',
          'Optimizing tailwind classes'
        ];
        const codes = [
          '+ backdrop-blur-xl',
          '+ flex items-center gap-3',
          '+ const [active, setActive] = useState()',
          '+ aria-expanded="false"',
          '+ shadow-2xl rounded-2xl'
        ];

        window.__SWARM__.moveAgent(
          agent.id,
          destX,
          destY,
          actions[Math.floor(Math.random() * actions.length)],
          codes[Math.floor(Math.random() * codes.length)]
        );
        window.__SWARM__.selectElement(agent.id, targetEl.tagName.toLowerCase() + (targetEl.className ? '.' + targetEl.className.split(' ')[0] : ''));
      });
    }
  }

  setInterval(runAutonomousDemo, 2200);
  console.log('[Antigravity Swarm] Visual Engine Activated.');
})();
