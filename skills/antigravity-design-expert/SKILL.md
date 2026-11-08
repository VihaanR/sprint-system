---
name: antigravity-design-expert
description: Spatial, weightless web animations and interfaces using GSAP, React Three Fiber (R3F), glassmorphism, perspective transforms, and scroll-linked motion.
---

# Antigravity Design Expert: Spatial & Weightless UI

This skill guides the construction of spatial, weightless, and multi-layered web interfaces that combine GSAP, 3D CSS, React Three Fiber (R3F), and glassmorphic aesthetics.

---

## [CORE DESIGN PILLARS]

### 1. Spatial Depth & Weightlessness
- Interface elements float rather than resting on heavy opaque ground planes.
- Apply soft diffused drop-shadows with low alpha and high blur radius:
  ```css
  box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.35), 0 4px 12px -2px rgba(0, 0, 0, 0.2);
  ```
- Use subtle floating animations (`translateY(-4px)` to `translateY(4px)` over 3s with `cubic-bezier(0.4, 0, 0.2, 1)`) to establish zero-gravity presence.

### 2. Glassmorphism Architecture
- Ground containers in translucent, light-refracting backdrops rather than solid fills:
  ```css
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  ```
- For high-contrast dark surfaces, maintain subtle hairline highlights (`border-top: 1px solid rgba(255, 255, 255, 0.14)`).

### 3. Z-Axis Perspective & Parallax Layers
- Divide motion into distinct foreground, midground, and background planes:
  - **Background**: Ambient dust particles, blurred grid planes, or gradient nebulae moving at 0.2x scroll rate.
  - **Midground**: Primary cards, architecture nodes, and data matrices moving at 1.0x scroll rate.
  - **Foreground**: Floating badges, micro-tags, and interactive pointers moving at 1.4x scroll rate with 3D tilt.
- Enable hardware-accelerated 3D transforms:
  ```css
  .spatial-scene {
    perspective: 1000px;
    transform-style: preserve-3d;
  }
  .spatial-card {
    transform: rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)) translateZ(20px);
    transition: transform 0.25s cubic-bezier(0.25, 1, 0.5, 1);
  }
  ```

---

## [GSAP & SCROLLTRIGGER BEST PRACTICES]

### 1. Timeline Structuring
- Always encapsulate multi-step animations in GSAP timelines (`gsap.timeline()`) rather than isolated tweens:
  ```typescript
  const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.6 } });
  tl.from(".hero-badge", { y: -20, opacity: 0, scale: 0.9 })
    .from(".hero-title", { y: 30, opacity: 0 }, "-=0.4")
    .from(".hero-card", { y: 40, opacity: 0, stagger: 0.1 }, "-=0.3");
  ```

### 2. ScrollTrigger Scrubbing & Pinning
- Pin parent sections while scrubbing camera paths or 3D rotations:
  ```typescript
  ScrollTrigger.create({
    trigger: ".matrix-container",
    start: "top top",
    end: "+=1200",
    pin: true,
    scrub: 1,
    animation: spatialTimeline,
  });
  ```

### 3. React Three Fiber (R3F) Integration
- Keep 3D canvas lightweight: use `Canvas` with `dpr={[1, 2]}` and `performance={{ min: 0.5 }}`.
- Connect Three.js mesh rotations directly to useFrame ticks or GSAP timelines:
  ```tsx
  useFrame((state, delta) => {
    meshRef.current.rotation.y += delta * 0.2;
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.08;
  });
  ```
