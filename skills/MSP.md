# MSP — Manim Style & Protocol
### A Production-Grade Skill Specification for AI-Generated Manim Animations

```
Version: 1.0
Target: Manim Community Edition (ManimCE) ≥ v0.18
Purpose: Enable any AI system to generate clean, organized, smoothly-morphing,
         studio/production-quality Manim animations by default — not as an exception.
```

---

## 0. PRIME DIRECTIVE

> Every scene you write must look like it came from a professional animation studio, not a student script. If a choice is ambiguous, choose the option that is **smoother, cleaner, and more intentional** — never the laziest default.

Before writing any code, silently run through this checklist:
1. What is the **one idea** this scene communicates?
2. What is the **visual hierarchy** (what should the eye see first, second, third)?
3. What **color palette** and **font** am I using, and is it consistent project-wide?
4. How will each object **enter**, **transform**, and **exit** — nothing should simply "appear" or "vanish" without an animation verb.
5. What is the **pacing** (total run_time budget) for the scene?

---

## 1. ENVIRONMENT & VERSION LOCK

Always default to **Manim Community Edition**, not ManimGL, unless the user explicitly requests 3b1b-style ManimGL.

```python
from manim import *
```

- CLI binary: `manim` (not `manimgl`)
- Creation verb: `Create()` (not `ShowCreation()`)
- Math rendering: `MathTex(r"...")` (not `Tex(R"...")`)

**Never mix APIs.** If a snippet uses `self.camera.frame` without `MovingCameraScene`/`ThreeDScene`, flag it — that's ManimGL syntax leaking in.

---

## 2. PROJECT FILE STRUCTURE

For anything beyond a single trivial scene, enforce this structure — never dump everything into one monolithic file:

```
project/
├── manim.cfg              # locked render config (see §9)
├── theme.py               # colors, fonts, constants (single source of truth)
├── helpers.py             # reusable mobject builders / layout functions
├── scenes/
│   ├── 01_intro.py
│   ├── 02_derivation.py
│   └── 03_outro.py
└── assets/                # svgs, images, audio
```

`theme.py` example (ALWAYS create one for multi-scene projects):

```python
from manim import *

# ---- PALETTE ----
BG_COLOR      = "#0E0E12"
PRIMARY       = "#58C4DD"   # manim default blue, or brand color
SECONDARY     = "#FFD166"
ACCENT        = "#EF476F"
TEXT_MAIN     = "#F5F5F5"
TEXT_MUTED    = "#8A8A8F"
SUCCESS       = "#06D6A0"

# ---- TYPOGRAPHY ----
FONT_MAIN = "Helvetica"      # or project-specific
FONT_MONO = "JetBrains Mono"

# ---- TIMING CONSTANTS ----
T_FAST   = 0.5
T_NORMAL = 1.0
T_SLOW   = 1.8
LAG      = 0.08   # default lag_ratio for grouped reveals

config.background_color = BG_COLOR
```

Every scene file imports from `theme.py`. **Never hardcode hex colors or magic run_time numbers inline** once a theme file exists — this is the #1 marker of unprofessional, inconsistent output.

---

## 3. VISUAL DESIGN STANDARDS

### 3.1 Color Rules
- Max **4–5 colors** per project (1 background, 1–2 primary, 1–2 accent). More reads as noisy/amateur.
- Use color **semantically**: same color = same meaning across the whole video (e.g., always blue for "given", always red for "unknown").
- Background should almost never be pure black (`#000000`) or pure white — use a soft near-black (`#0E0E12`) or soft off-white for reduced eye strain and a "studio" feel.

### 3.2 Typography Rules
- `Text()` for UI labels, titles, captions — fast, no LaTeX dependency.
- `MathTex()` for all mathematical notation — never fake math with `Text()`.
- `Tex()` only for mixed prose+math LaTeX blocks.
- Set one `font=` globally via theme constants; never let font choice vary scene-to-scene.
- Title convention: `.to_edge(UP)`, bold weight, consistent font size (e.g., 40pt) across every scene.

### 3.3 Layout Rules
- Respect the **rule of thirds** — avoid dead-centering everything by default; use `.to_edge()`, `.shift()`, `.next_to()` deliberately.
- Maintain consistent **margins** (buff values) — define a `MARGIN = 0.75` constant and reuse it in every `.to_edge(..., buff=MARGIN)` call.
- Group related objects into a single `VGroup` and position/animate the group, not loose individual mobjects — this guarantees alignment stays correct through any later transform.
- Always call `.arrange()` or `.arrange_in_grid()` on groups instead of manually computing coordinates — manual coordinate math is fragile and the #1 source of broken layouts under later edits.

---

## 4. THE MORPHING & TRANSFORM PROTOCOL

This is the heart of "smooth, morphing" animation — the signature look of high-end explainer videos.

### 4.1 Rule: Never Cut, Always Transform
If an object conceptually becomes another object (equation rearranges, shape becomes another shape, label updates), **never** `FadeOut` + `FadeIn` as separate unrelated mobjects — this reads as a jump cut. Always use a transform family:

| Situation | Correct tool |
|---|---|
| Equation rearranges, terms persist | `TransformMatchingTex(old, new)` |
| Shape morphs into different shape | `Transform(old, new)` or `ReplacementTransform(old, new)` |
| Group of mobjects restructures (e.g. bullet list → diagram) | `TransformMatchingShapes(old_group, new_group)` |
| One object explicitly replaces another in the scene graph | `ReplacementTransform` (swaps old for new in `self.mobjects`) |
| Fading while implying continuity (e.g. ghost/overlay) | `FadeTransform(old, new)` |

**Protocol detail for `TransformMatchingTex`:** always build both `MathTex` mobjects with consistent substring grouping (same LaTeX fragments as separate `{}` groups) so Manim can match identical symbols — this is what makes terms visually "slide" into their new position instead of crossfading.

```python
eq1 = MathTex("a", "+", "b", "=", "c")
eq2 = MathTex("c", "=", "a", "+", "b")
self.play(TransformMatchingTex(eq1, eq2), run_time=1.2)
```

### 4.2 Rule: Use `.animate` for Simple Property Morphs
For single continuous property changes (position, scale, color, rotation) on **one** mobject, prefer the `.animate` syntax — it's cleaner and Manim interpolates the net transform automatically:

```python
self.play(square.animate.shift(RIGHT * 2).scale(1.5).set_color(ACCENT), run_time=1.0)
```

**Caveat (critical, avoid AI hallucination bugs):** chained `.animate` calls interpolate the **final net state**, not each intermediate step sequentially. Never chain `.animate` calls that depend on an intermediate result (e.g., `.animate.move_to(X).rotate(angle_depending_on_position)`) — split into separate `self.play()` calls instead.

### 4.3 Rule: Use Updaters for Continuous/Dependent Motion
Whenever an object's state must continuously track another object (a label following a dot, a value display tracking a `ValueTracker`), use `add_updater`, never manually re-`play` every frame:

```python
tracker = ValueTracker(0)
label = DecimalNumber(0).add_updater(lambda d: d.set_value(tracker.get_value()))
dot = Dot().add_updater(lambda m: m.move_to(axes.c2p(tracker.get_value(), f(tracker.get_value()))))
self.add(label, dot)
self.play(tracker.animate.set_value(5), run_time=3, rate_func=linear)
```

Always `remove_updater` (or use `always_redraw` for cleaner recompute-from-scratch logic) once an object's dependency phase ends, to avoid stale updater bugs later in long scenes.

---

## 5. TIMING, PACING & EASING PROTOCOL

### 5.1 Default Rate Function Policy
- **Default** (don't override): `smooth` — S-curve ease-in/ease-out. Use for 90% of animations — equation reveals, shape creation, standard moves.
- **`linear`**: mandatory for anything depicting literal constant-rate physical motion — orbiting dots, uniform-velocity vectors, rotating clock hands, progress bars tied to real elapsed time.
- **`rush_into` / `rush_from`**: use for emphasis entrances/exits where something should feel like it's snapping into place or launching away.
- **`there_and_back` / `there_and_back_with_pause`**: use for `Indicate`-style attention pulses, never for permanent state changes.
- **`ease_out_bounce` / `ease_out_elastic`**: reserve for playful, informal content only — never in a formal math/science derivation, where it looks unprofessional.

### 5.2 Timing Budget Rules
- Keep individual `run_time` between **0.4s and 3s**. Below 0.4s reads as jarring; above 3s (without narrative reason) drags.
- Title/section-header entrances: `0.8–1.2s`.
- Equation/diagram transforms: `1.0–1.5s`.
- Emphasis pulses (`Indicate`, `Flash`, `Circumscribe`): `0.5–0.8s`.
- Camera moves (`move_camera`, `self.camera.frame.animate`): `1.5–3s` — camera moves faster than this feel nauseating.
- Insert deliberate `self.wait(0.3–1.0)` breaths **after** every major reveal — never chain `self.play()` calls back-to-back with zero pause; it overwhelms the viewer.

### 5.3 Composition Protocol
- **Simultaneous but independent** events → single `self.play(AnimA, AnimB, ...)` call.
- **Simultaneous with staggered start** (e.g., 6 bullet points appearing in sequence but overlapping) → `LaggedStart(*anims, lag_ratio=0.15)`.
- **Strictly sequential, dependent** events → `Succession(*anims)` or separate `self.play()` calls.
- **List/grid reveals** (bullets, grids of shapes) → always `LaggedStartMap(FadeIn, group, lag_ratio=0.08, shift=UP*0.3)` instead of a single simultaneous `FadeIn(group)` — staggering is what makes group entrances feel organic rather than robotic.

---

## 6. SCENE & CODE ORGANIZATION PROTOCOL

### 6.1 Construct Method Shape
Always decompose `construct()` into clearly delimited, named phases via comments or helper methods — never one unbroken 100-line block:

```python
class DerivationScene(Scene):
    def construct(self):
        self.setup_title()
        self.show_initial_equation()
        self.derive_steps()
        self.highlight_result()
        self.cleanup()

    def setup_title(self):
        self.title = Text("Deriving the Quadratic Formula", font=FONT_MAIN).to_edge(UP)
        self.play(Write(self.title), run_time=T_NORMAL)
        self.wait(T_FAST)

    def show_initial_equation(self):
        ...
```

For long videos, split into **multiple scene classes** (one per logical section) rather than one giant `construct()` — enables targeted re-rendering via `-n` and parallel iteration.

### 6.2 Mobject Construction Protocol
- Build complex custom visuals (diagrams, graphs, icons) as **standalone functions in `helpers.py`** returning a `VGroup`, not inline in `construct()`:

```python
# helpers.py
def make_neuron(radius=0.3, color=PRIMARY) -> VGroup:
    circle = Circle(radius=radius, color=color, fill_opacity=0.8)
    label = Text("n", font_size=20).move_to(circle)
    return VGroup(circle, label)
```

- Always name mobjects meaningfully (`title`, `eq_initial`, `graph_group`) — never leave unreferenced anonymous literals you'll need to mutate or transform later.
- Use `z_index` explicitly for any scene with overlapping layers (don't rely on add-order alone once more than 2 layers exist).

### 6.3 Style / Linting Rules
- snake_case for variables/methods, PascalCase for Scene subclasses.
- One blank line between animation "beats" in code for readability — code structure should visually mirror the video's pacing.
- No bare magic numbers for color/position/timing — always reference `theme.py` constants.
- Type-hint helper functions (`def make_axes() -> Axes:`) for maintainability on larger projects.

---

## 7. COMPOSITION & CAMERA PROTOCOL (2D & 3D)

### 2D
- Use `MovingCameraScene` whenever the video needs to pan/zoom in 2D (e.g., focusing on a sub-region of a diagram) — animate via `self.camera.frame.animate.move_to(...).set(width=...)`, always with an explicit `run_time`.

### 3D
- Subclass `ThreeDScene`.
- Set initial orientation with `self.set_camera_orientation(phi=70*DEGREES, theta=-45*DEGREES, zoom=1)` in a dedicated setup step — never leave default orientation unless intentional.
- For any camera reposition the viewer should *perceive* as motion, use `self.move_camera(phi=..., theta=..., run_time=2.5)` — **never** jump-cut via `set_camera_orientation` mid-scene.
- Use `self.begin_ambient_camera_rotation(rate=0.15)` for slow idle rotation under narration; always pair with `self.stop_ambient_camera_rotation()` before any subsequent deliberate `move_camera`.
- HUD/labels/titles that must stay legible regardless of camera angle → `self.add_fixed_in_frame_mobjects(label)`.
- Labels that should track 3D objects but stay readable → `self.add_fixed_orientation_mobjects(label)`.
- Keep 3D surface `resolution` tuples low (e.g. `(24,24)`) during iteration; raise only for the final production render — this is purely a performance/workflow rule, not a visual one.

---

## 8. EMPHASIS & ATTENTION PROTOCOL

Never let a key result sit visually identical to supporting content. After revealing the "payoff" of a scene (final equation, key insight, result), apply exactly one emphasis technique — don't stack more than one or it reads as frantic:

- `Circumscribe(mobject, color=ACCENT, run_time=1.2)` — draws a shape around it.
- `Indicate(mobject, scale_factor=1.15)` — brief pulse scale + color flash.
- `Flash(point, color=ACCENT)` — radial burst, good for a specific coordinate/intersection point.
- `mobject.animate.set_color(ACCENT)` combined with a slight scale — for permanent recoloring signaling "this is the answer."

---

## 9. RENDER & EXPORT PROTOCOL

### 9.1 Locked Config File (commit this — never rely on ad hoc flags for final delivery)

`manim.cfg`:
```ini
[CLI]
quality = production_quality
preview = False
background_color = "#0E0E12"
output_file = {scene_name}
frame_rate = 60
pixel_height = 1080
pixel_width = 1920
```

### 9.2 Workflow Stages (always follow this order, never render final quality first)
1. **Draft pass**: `manim -pql scenes/02_derivation.py DerivationScene` — fast iteration, check logic/timing.
2. **Spot-check pass**: `manim -pqh -s scenes/02_derivation.py DerivationScene` — single-frame high-quality check of composition/color.
3. **Targeted re-render**: `manim -qh -n 4,7 ...` — fix only the broken animation range, not the whole scene.
4. **Final production render**: `manim -qh` (1080p60, standard delivery) or `manim -qk` (4K60, premium delivery) with `--format=mp4`.

### 9.3 Delivery Hygiene
- Never ship a video rendered at `-ql`. That resolution/framerate is for iteration only.
- Use `--flush_cache` only when LaTeX output is visibly corrupted — not as a default habit, since it discards useful partial-movie caching.
- Keep unrelated code changes out of scenes you aren't actively re-rendering, to preserve Manim's per-animation cache validity.

---

## 10. QUALITY ASSURANCE CHECKLIST (run before declaring any scene "done")

```
[ ] Does every object enter AND exit via an explicit animation (no raw add()/remove() for visible changes)?
[ ] Is every color pulled from theme.py — zero hardcoded hex values?
[ ] Is every run_time either a theme constant or a deliberate, justified literal?
[ ] Are equation rearrangements done via TransformMatchingTex, not Fade+Fade?
[ ] Does every self.play() have a sensible rate_func (explicit linear where physically required)?
[ ] Is there a self.wait() breath after every major reveal?
[ ] Are grouped reveals staggered via LaggedStart/LaggedStartMap rather than simultaneous?
[ ] Is layout done via .arrange()/.next_to()/.to_edge(), not manual coordinates?
[ ] Are camera moves (2D or 3D) using animate/move_camera, never instant jumps, unless a jump-cut is intentional?
[ ] Is the construct() method decomposed into named phases/helper methods?
[ ] Is there exactly one clear focal point of emphasis at the scene's payoff moment?
[ ] Was the scene iterated at -ql and only finally rendered at -qh/-qk?
```

---

## 11. REUSABLE SNIPPET LIBRARY

**Staggered bullet list reveal:**
```python
bullets = VGroup(*[Text(f"• {t}", font=FONT_MAIN, font_size=32) for t in items])
bullets.arrange(DOWN, aligned_edge=LEFT, buff=0.4).to_edge(LEFT)
self.play(LaggedStartMap(FadeIn, bullets, shift=RIGHT*0.3, lag_ratio=LAG))
```

**Title card:**
```python
title = Text(text, font=FONT_MAIN, weight=BOLD, color=TEXT_MAIN).scale(1.2)
self.play(Write(title), run_time=T_NORMAL)
self.wait(T_FAST)
self.play(title.animate.scale(0.5).to_edge(UP), run_time=T_FAST)
```

**Graph plot with smooth draw-on:**
```python
axes = Axes(x_range=[-5,5,1], y_range=[-3,3,1]).add_coordinates()
graph = axes.plot(lambda x: np.sin(x), color=PRIMARY)
self.play(Create(axes), run_time=1.2)
self.play(Create(graph), run_time=1.5, rate_func=smooth)
```

**Equation morph chain:**
```python
steps = [MathTex(s) for s in [r"x^2+2x+1", r"(x+1)^2"]]
self.play(Write(steps[0]))
self.wait(0.5)
self.play(TransformMatchingTex(steps[0], steps[1]), run_time=1.2)
```

---

## 12. FAILURE MODES TO ACTIVELY AVOID

- **The "pop-in" problem**: objects appearing via `add()` instead of `FadeIn`/`Create` — instantly reads as amateur.
- **The "crossfade equation" problem**: using `FadeOut(old) + FadeIn(new)` for what should be a `TransformMatchingTex` — loses the sense of algebraic continuity.
- **The "static camera monotony" problem**: a 3+ minute scene with zero camera movement or scale change — add deliberate `.animate` framing shifts even in 2D.
- **The "uniform timing" problem**: every single `self.play()` using the exact same `run_time` — vary pacing deliberately to create rhythm.
- **The "color soup" problem**: more than ~5 distinct colors on screen — consolidate to the theme palette.
- **The "wall of code" problem**: one 200-line `construct()` — always decompose per §6.1.
- **The "jittery chain" problem**: multi-step `.animate` chains with position-dependent later steps — split into sequential `self.play()` calls per §4.2.

---

**End of MSP v1.0.** Any AI implementing this protocol should treat §2–§10 as non-negotiable defaults, not optional suggestions — deviation should only occur with explicit user override, and even then the AI should note the deviation from standard protocol.
