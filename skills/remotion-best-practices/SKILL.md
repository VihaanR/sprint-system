---
name: remotion-best-practices
description: Programmatic video and motion graphics generation in React and TypeScript. Covers composition architecture, frame-accurate timing, spring physics, and video asset optimization.
---

# Remotion Best Practices: Programmatic Video & Motion Graphics

This skill guides the design, structuring, and rendering of programmatic video and motion graphics using Remotion (React + TypeScript).

---

## [CORE ARCHITECTURAL RULES]

### 1. Frame-Accurate Determinism
- Remotion renders video frame-by-frame. Never use non-deterministic browser APIs (`Date.now()`, `Math.random()`, `setTimeout`, `setInterval`) inside rendering code.
- Derive all visual state from the `useCurrentFrame()` and `useVideoConfig()` hooks:
  ```tsx
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  ```

### 2. Spring Physics Over Linear Interpolation
- Always use `spring()` with explicit damping, mass, and stiffness for organic movement:
  ```tsx
  const scale = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 100 },
  });
  ```
- Use `interpolate()` with clean cubic or quad extrapolation curves rather than linear stepping:
  ```tsx
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  ```

### 3. Staggered Sequential Entrances
- Stagger element reveals using frame offsets (e.g. 3 to 5 frames apart):
  ```tsx
  const titleDelay = 0;
  const subtitleDelay = 8;
  const cardDelay = 16;
  ```

### 4. Static File Resolution & Preloading
- Always reference assets in the `public/` directory via `staticFile("path/to/asset.png")`.
- Preload remote fonts and heavy image assets before the composition begins rendering.
