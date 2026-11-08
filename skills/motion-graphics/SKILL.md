---
name: motion-graphics
description: Embeds classic design laws (12 principles of animation, proper timing, and non-linear easing) so agents produce organic, purposeful motion instead of stiff AI transitions.
---

# Motion Graphics & Organic Animation

This skill enforces foundational animation principles and mathematical easing curves across visual media, CSS, SVG, canvas, and video rendering engines.

---

## [FOUNDATIONAL LAWS OF MOTION]

### 1. Purpose-Driven Motion
Every movement must serve an explicit objective:
- **Direct Attention**: Guide the user's eye to high-priority signals or state changes.
- **Explain Spatial Relationships**: Communicate hierarchy, scale, and spatial continuity.
- **Reinforce Momentum**: Emphasize speed, weight, and inertia through physical resistance.
- **Rule**: If a motion does not inform, guide, or clarify, eliminate it.

### 2. The 12 Principles of Animation
1. **Squash and Stretch**: Convey weight and flexibility. When an element impacts or lands, expand its horizontal axis while compressing its vertical axis (`scale(1.08, 0.92)`), preserving perceived volume.
2. **Anticipation**: Prepare the viewer for action. Pull back slightly before driving forward (e.g. slight negative offset before acceleration).
3. **Staging**: Direct attention to a single focal point at a time. Do not trigger simultaneous competing movements.
4. **Straight Ahead vs Pose to Pose**: Combine structured key poses (start, apex, settle) with organic in-betweens.
5. **Follow Through and Overlapping Action**: Different parts of an object move at different rates. Secondary elements (straps, antennae, hair, loose garments) continue moving after the main mass stops.
6. **Slow In and Slow Out**: Natural objects require time to accelerate and decelerate. Never use linear transitions (`linear`).
7. **Arcs**: Natural motion follows curved paths, not sharp straight lines. Use parabolic trajectories and bezier curves for translated elements.
8. **Secondary Action**: Subtle accent movements (sweat drops, spinning gauges, fluttering notes) reinforce the primary action without distracting from it.
9. **Timing and Spacing**: Control weight and perceived effort. Dense spacing near key poses creates deceleration; wide spacing creates velocity.
10. **Exaggeration**: Push physical boundaries slightly (10-15%) to make the intent immediately readable on small viewports.
11. **Solid Drawing**: Maintain volume, proportion, and three-dimensional perspective across all rotational states.
12. **Appeal**: Design characters and interface elements with distinct silhouettes, clear hierarchy, and rhythm.

---

## [MATHEMATICAL EASING CURVES & TIMING]

### Standard Curve Library
Never use linear transitions for interactive UI or character motion:
- **Standard Smooth-Out (Deceleration)**: `cubic-bezier(0.25, 1, 0.5, 1)` -> Use for entrances and settling states.
- **Smooth-In (Acceleration)**: `cubic-bezier(0.5, 0, 0.75, 0)` -> Use for exits and drop-offs.
- **Symmetric Ease-In-Out**: `cubic-bezier(0.65, 0, 0.35, 1)` -> Use for continuous looping cycles.
- **Elastic Bounce (Settling Mass)**: `cubic-bezier(0.34, 1.56, 0.64, 1)` -> Use for buttons, cards, and snappy tooltips.
- **Heavy Damped Spring**: Damping: 14, Mass: 0.8, Stiffness: 120 -> Use for structural modal overlays and bottom sheets.

### Timing Thresholds
- **Micro-interactions (Toggles, tooltips)**: 120ms to 200ms.
- **Component Entrances (Cards, badges, alerts)**: 250ms to 400ms.
- **Layout Transitions (Page routes, morphing shapes)**: 450ms to 650ms.
- **Continuous Loops (Bobs, pulses, radar sweeps)**: 1.2s to 3.5s.

---

## [STAGGERING & SEQUENCING]

- **Entrance Cascades**: When rendering lists or card grids, apply an explicit stagger offset (typically 40ms to 80ms per sibling element):
  ```css
  .card:nth-child(1) { animation-delay: 0.05s; }
  .card:nth-child(2) { animation-delay: 0.12s; }
  .card:nth-child(3) { animation-delay: 0.19s; }
  ```
- **Hierarchical Priority**: Primary container renders first -> Header text reveals second -> Content elements stagger third -> Interactive CTAs snap last.
