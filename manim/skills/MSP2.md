---
name: MSP
description: Create, design, refactor, or debug ultra-clean, smooth, 3Blue1Brown-grade Manim Community animations with zero overlapping text, surgical morphing transitions, ValueTracker updaters, camera choreography, and cohesive visual hierarchy. Use this skill whenever the user asks to write, generate, fix, animate, or improve a Manim script, mathematical visualization, animated explainer scene, or motion graphics sequence in Python using Manim.
---
# MSP - Manim Style Protocol

## Purpose

Build Manim Community (`manim`) animations that look deliberately choreographed rather than cluttered, static, or mechanically assembled. Every scene prioritizes zero text or shape collisions, clean object replacement, surgical equation and geometry morphing, smooth parameter-driven motion, and clear visual storytelling.

## When to Use This Skill

Use this skill whenever the user asks to:

- Write or generate a new Manim animation script (`Scene`, `MovingCameraScene`, `ThreeDScene`).
- Fix overlapping text, colliding labels, off-screen elements, or z-index clipping in a Manim scene.
- Improve janky morphs, broken `Transform` transitions, or robotic pacing in existing Manim code.
- Create mathematical derivations, geometric proofs, algorithm visualizations, or animated diagrams with Manim.

## Core Design Requirements

1. Deliver complete, runnable Manim Community (`from manim import *`) Python scripts with no placeholders or omitted sections.
2. Treat layout safety, surgical morphing, and intentional pacing as default requirements unless the user explicitly asks otherwise.
3. Never use em dashes or en dashes in user-facing text, on-screen `Text` mobjects, or code comments; use regular hyphens, colons, or commas instead.

## Spatial Layout and Zero-Overlap Rules

### Relative Positioning Mandate
Never hardcode raw coordinate tuples like `.move_to([2.3, -1.4, 0])` for text or labels. Anchor every mobject relative to the frame or another mobject using `.next_to(target, direction, buff=0.35)`, `.to_edge(direction, buff=0.5)`, or `.align_to(target, edge)`.

### Group Auto-Arrangement
Place related labels, steps, or stacked equations inside a `VGroup` and call `.arrange(DOWN, aligned_edge=LEFT, buff=0.3)` so Manim calculates bounding boxes automatically and prevents collisions.

### Safe Margins and Frame Bounds
- Keep all primary content inside safe frame margins (`buff=0.5` minimum from screen edges).
- Scale wide equations or diagrams dynamically when needed using `.scale_to_fit_width(config.frame_width - 1.5)` so nothing clips past the viewport.
- Use generous spacing (`buff=0.4` to `0.6`) when placing callouts beside dynamic geometry or graphs.

### Foreground Layering Over Grids and Graphs
- When placing labels over axes, grids, filled polygons, or dense curves, elevate the text layer with `.set_z_index(10)` or `self.add_foreground_mobjects(label)`.
- Add a subtle dark backdrop behind labels sitting on busy geometry using `label.add_background_rectangle(color=BLACK, opacity=0.85, buff=0.1)` so text stays crisp and readable.
- Keep `Axes` ranges well-proportioned so plotted curves and tick labels stay comfortably inside the camera frame without clipping edges.

### Stage Hygiene and Decluttering
Never leave stale equations or completed steps crowding the canvas. Clear or transition out prior visual beats using `FadeOut(old_group, shift=UP*0.2)` or morph them directly into the next step before introducing new elements. Use `self.clear()` only at clean scene or chapter boundaries after fading active elements.

## Smooth Morphing and Shared-Element Transitions

### ReplacementTransform Over Transform
Always use `ReplacementTransform(source, target)` instead of `Transform(source, target)` when replacing an object. `Transform` mutates `source` visually while leaving `source` in the scene graph and abandoning `target`, which causes frozen ghost duplicates during subsequent animations.

### Surgical Equation Morphing (`TransformMatchingTex`)
Break `MathTex` strings into logical tokens wrapped in double braces `{{ }}` so identical terms glide smoothly across the screen instead of warping into unreadable paths:

```python
eq_start = MathTex("{{a^2}}", "+", "{{b^2}}", "=", "{{c^2}}")
eq_end = MathTex("{{a^2}}", "=", "{{c^2}}", "-", "{{b^2}}")
self.play(TransformMatchingTex(eq_start, eq_end), run_time=1.2)
```

Keep token strings identical across start and end equations so Manim pairs them reliably.

### Origin-Aware Branching (`TransformFromCopy`)
When deriving a new equation, pulling a label off a geometric side, or duplicating a term into a callout, use `TransformFromCopy(source_part, new_target)` so the viewer visually tracks where the new element originated without destroying the source.

### Geometry and Shape Morphing
- Use `TransformMatchingShapes(group_a, group_b)` when morphing between distinct geometric layouts or rearranged diagrams.
- Use `FadeTransform(a, b)` as a clean fallback when two objects have incompatible topology where path interpolation would twist or invert.

## Motion, Pacing, and Visual Polish

### Easing and Rate Functions
Avoid flat `linear` rate functions for UI-like motion, camera slides, and layout transitions. Use smooth deceleration curves such as `rate_func=smooth` (default) or `rate_func=rush_from` for snappy arrivals, reserving `linear` strictly for continuous parametric tracers or constant-speed rotations.

### Establish, Act, Hold Rhythm
Structure every narrative beat around three phases:
1. **Establish:** Introduce the element cleanly (`FadeIn(mob, shift=UP*0.2)` or `Write(mob)`).
2. **Act:** Execute one clear, focused transformation or highlight.
3. **Hold:** Pause with `self.wait(0.8)` to `self.wait(1.5)` after key steps so the viewer can read and absorb the state change.

### Eye-Guiding Before Mutation
Before moving, substituting, or transforming a specific term or shape, draw the viewer's attention to it briefly with `Indicate(target, color=accent)` or `Circumscribe(target, color=accent)`.

### Staggered Group Entrances (`LaggedStart`)
Avoid animating lists of items simultaneously (robotic) or sequentially one by one (too slow). Use `LaggedStart` with a tight lag ratio:

```python
self.play(
    LaggedStart(*[FadeIn(item, shift=UP * 0.2) for item in items], lag_ratio=0.15),
    run_time=1.2,
)
```

### Dynamic Updaters Over Frame-by-Frame Loops
For animated parameters, moving tangent lines, or live numeric readouts, drive motion with a `ValueTracker` and `always_redraw(...)` rather than manual step loops so curves, dots, and labels stay locked together at any frame rate:

```python
x_tracker = ValueTracker(-1.5)
dot = always_redraw(
    lambda: Dot(
        axes.c2p(x_tracker.get_value(), x_tracker.get_value() ** 2),
        color="#F472B6",
    ).set_z_index(10)
)
```

Add the `ValueTracker` to the scene (`self.add(x_tracker)`) when animating `x_tracker.animate.set_value(...)` alongside external updaters.

### Camera Choreography in MovingCameraScene
When zooming or panning with `MovingCameraScene`, save and restore camera states cleanly with `self.camera.frame.save_state()` and `Restore(self.camera.frame)` so the view never drifts off-center. Keep HUD titles or readouts fixed or re-anchored cleanly so zoomed geometry never collides with labels.

## Color and Typography Restraint

### 60-30-10 Visual Hierarchy
- **60% Dominant:** Deep neutral background (`#0D1117` or default Manim `#000000`) with high-contrast off-white primary text (`#F0F4F8`).
- **30% Secondary:** Calm structural color for axes, reference shapes, and secondary annotations (e.g., `#38BDF8` sky blue or `#94A3B8` slate).
- **10% Accent:** One vibrant highlight color reserved strictly for the active focus term, target vector, or key takeaway (e.g., `#F472B6` pink, `#FB923C` orange, or `#A3E635` lime).

### Semantic Color Coding
Assign one consistent color to each mathematical variable or concept across the entire scene using `.set_color_by_tex("x", BLUE)` so color reinforces meaning rather than acting as random decoration.

### Minimal On-Screen Copy
Keep on-screen text concise (short titles and crisp labels, never multi-sentence paragraphs). Let visual motion and spatial relationships carry the explanation.

## Complete Reference Pattern

```python
from manim import *

class UltraCleanTangentScene(MovingCameraScene):
    def construct(self):
        self.camera.background_color = "#0D1117"
        self.camera.frame.save_state()

        # 1. Anchor title to top safe margin
        title = Text("Slope Along a Parabola", font_size=34, color="#F0F4F8")
        title.to_edge(UP, buff=0.5)
        self.play(FadeIn(title, shift=DOWN * 0.2), run_time=0.8)
        self.wait(0.5)

        # 2. Set up axes and curve cleanly inside safe bounds
        axes = Axes(
            x_range=[-3, 3, 1],
            y_range=[0, 9, 3],
            x_length=6.5,
            y_length=4.2,
            axis_config={"color": "#94A3B8"},
        ).shift(DOWN * 0.4)

        curve = axes.plot(lambda x: x**2, x_range=[-2.5, 2.5], color="#38BDF8", stroke_width=3.5)
        formula = MathTex("{{f(x)}}", "=", "{{x^2}}", font_size=36)
        formula.set_color_by_tex("f(x)", "#F0F4F8")
        formula.set_color_by_tex("x^2", "#38BDF8")
        formula.next_to(axes, RIGHT, buff=0.5).align_to(axes, UP)

        self.play(Create(axes), Create(curve), run_time=1.0)
        self.play(FadeIn(formula, shift=LEFT * 0.2), run_time=0.7)
        self.wait(0.8)

        # 3. Drive point and live slope readout with ValueTracker + always_redraw
        x_val = ValueTracker(-1.5)
        self.add(x_val)

        moving_dot = always_redraw(
            lambda: Dot(
                axes.c2p(x_val.get_value(), x_val.get_value() ** 2),
                color="#F472B6",
                radius=0.09,
            ).set_z_index(10)
        )

        tangent_line = always_redraw(
            lambda: Line(
                axes.c2p(x_val.get_value() - 1.1, (x_val.get_value() ** 2) + (2 * x_val.get_value()) * (-1.1)),
                axes.c2p(x_val.get_value() + 1.1, (x_val.get_value() ** 2) + (2 * x_val.get_value()) * (1.1)),
                color="#A3E635",
                stroke_width=3,
            ).set_z_index(8)
        )

        slope_label = always_redraw(
            lambda: MathTex(
                rf"\text{{slope}} = {2 * x_val.get_value():.1f}",
                font_size=32,
                color="#A3E635",
            )
            .add_background_rectangle(color="#0D1117", opacity=0.85, buff=0.1)
            .set_z_index(10)
            .next_to(formula, DOWN, buff=0.6, aligned_edge=LEFT)
        )

        self.play(FadeIn(moving_dot), Create(tangent_line), FadeIn(slope_label), run_time=0.8)
        self.wait(0.6)

        # 4. Sweep parameter smoothly with intentional pacing
        self.play(x_val.animate.set_value(1.6), run_time=2.5, rate_func=smooth)
        self.wait(1.0)

        # 5. Morph formula into derivative and highlight takeaway
        deriv = MathTex("{{f'(x)}}", "=", "{{2x}}", font_size=38)
        deriv.set_color_by_tex("f'(x)", "#F0F4F8")
        deriv.set_color_by_tex("2x", "#A3E635")
        deriv.move_to(formula)

        self.play(Indicate(slope_label, color="#A3E635"), run_time=0.7)
        self.play(TransformMatchingTex(formula, deriv), run_time=1.1)
        self.play(Circumscribe(deriv, color="#A3E635"), run_time=0.8)
        self.wait(1.5)
```

## Implementation Checklist

Before finalizing any Manim script, verify:

- Every text element and label uses relative positioning (`.next_to`, `.to_edge`, `VGroup.arrange`) with explicit `buff` spacing instead of raw coordinates.
- Wide equations or diagrams fit within `config.frame_width - 1.5` without edge clipping.
- Labels placed over axes, grids, or filled shapes use `.set_z_index(10)` and/or `.add_background_rectangle()`.
- Old elements are faded out or morphed before new concepts occupy the same space.
- `ReplacementTransform` is used instead of `Transform` whenever an object is replaced.
- Multi-step equations use `TransformMatchingTex` with `{{ }}` token delimiters, and derived callouts use `TransformFromCopy`.
- Transitions use smooth easing (`smooth` or `rush_from`), staggered entrances (`LaggedStart`), and `self.wait()` holds after major beats.
- Semantic colors follow a restrained 60-30-10 palette and remain consistent for each variable across the scene.
- The code is complete, runnable, and contains no em dashes or en dashes.
