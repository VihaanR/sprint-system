---
name: live-swarm-coding
description: Orchestrates a visible, multi-agent parallel frontend swarm with live browser hot-reloading and an on-screen Swarm HUD. Use when the user wants to watch parallel AI subagents simultaneously code, style, and assemble a frontend in real time with visual feedback.
---

# Live Swarm Coding (Visual Parallel Development)

Transform Antigravity's parallel subagent engine into a visible, live-coding swarm with visual appeal matching and exceeding `pen.dev`.

Rather than waiting on headless terminal diffs or vector mockups, this workflow boots your hot-reloading dev server, overlays the **Glassmorphic Swarm Visual Engine**, and dispatches parallel subagents that swarm your screen with glowing SVG cursors, Figma-style dashed selection boxes, and floating code streamers as your real application assembles in front of your eyes.

---

## [VISUAL AESTHETICS & CUSTOMIZATION]

The included visual engine (`resources/swarm-overlay.js`) provides:
1. **Multi-Agent Glow Cursors**:
   - `[Agent Orion]` (`#A855F7`): Layout, Flexbox, & Grid Architecture.
   - `[Agent Lyra]` (`#10B981`): Design Tokens, Gradients, & Tailwind Spacing.
   - `[Agent Echo]` (`#F59E0B`): Reactive State, Event Handlers, & Interactions.
   - `[Agent Nova]` (`#0EA5E9`): Accessibility Auditing & WCAG Validation.
2. **Dynamic Selection Bounding Boxes**: Animated dashed boxes with corner handles that snap around components being actively modified.
3. **Floating Code Streamers**: Syntactically formatted pills showing real-time diffs (e.g. `+ backdrop-blur-2xl`, `+ useState(0)`).
4. **Glassmorphic Floating Dock**:
   - Live HMR latency indicator
   - Pause / Resume controls
   - Customizable speed dials (0.5x, 1x, 2x)
   - One-click dismiss

---

## [HOW TO ACTIVATE]

### Option A: Query Parameter or Single-Line Dev Inject
To activate the visual overlay during development in any React/HTML project:
Inject the isolated script into `index.html` during dev mode:
```html
<script src="/path/to/swarm-overlay.js"></script>
```
Or evaluate it directly via Chrome DevTools during the session:
```javascript
// Injected via evaluate_script in chrome-devtools-plugin
```

### Option B: Zero-Pollution Chrome DevTools Injection
Antigravity evaluates `swarm-overlay.js` directly into the page context using `evaluate_script` so **no code is touched or polluted in your repository**!

---

## [EXECUTION PLAYBOOK]

1. **Server Boot**: Start `npm run dev` (Vite) as a daemon process.
2. **Browser Launch**: Open the page using `chrome-devtools-plugin`.
3. **Overlay Activation**: Evaluate `resources/swarm-overlay.js` in the tab.
4. **Parallel Swarm Dispatch**: Call `invoke_subagent` across designated roles. As each agent saves code to the component files, Vite HMR triggers instantaneous sub-second re-renders while the agent cursors animate to their targets.
5. **Dismount**: Once approved, the overlay is dismissed automatically.
