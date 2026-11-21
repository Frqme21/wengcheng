from __future__ import annotations

from manim import *

from helpers import make_card, make_flow, make_header, make_node, make_packet
from theme import (
    CLAY,
    LAG,
    RUST,
    SAGE,
    SAFE_WIDTH,
    T_CAMERA,
    T_FAST,
    T_NORMAL,
    T_REVEAL,
    T_SLOW,
    TEAL,
    TEXT_MUTED,
)


class DecoysScene(MovingCameraScene):
    """Attackers touch fake files while the real app stays untouched."""

    def construct(self) -> None:
        self.camera.frame.save_state()
        self.setup_header()
        self.build_city()
        self.zoom_to_city()
        self.touch_each_decoy()
        self.show_time_wasted()
        self.finish()

    def setup_header(self) -> None:
        self.header = make_header()
        self.play(Write(self.header), run_time=T_NORMAL)

    def build_city(self) -> None:
        self.real_app = make_node("Real app", "untouched", TEAL, width=3.0)
        self.fake_city = make_node("Fake city", "believable answers", CLAY, width=3.4)

        top_row = VGroup(self.real_app, self.fake_city)
        top_row.arrange(RIGHT, buff=0.8).next_to(self.header, DOWN, buff=0.7).set_x(0)

        decoy_names = ["Fake database", "Fake secrets file", "Fake admin data", "Slow export"]
        self.decoys = VGroup(
            *[
                make_card(name, SAGE if i < 3 else RUST, width=3.1, height=0.78)
                for i, name in enumerate(decoy_names)
            ]
        )
        self.decoys.arrange_in_grid(rows=2, cols=2, buff=(0.35, 0.45))
        self.decoys.next_to(self.fake_city, DOWN, buff=0.5)

        self.attacker = make_packet(RUST, radius=0.14)
        self.attacker.next_to(self.decoys, LEFT, buff=0.8).align_to(self.decoys, UP)

        self.guide = Text("Attackers stay here", font_size=15, color=RUST)
        self.guide.next_to(self.attacker, DOWN, buff=0.25)

        self.play(
            FadeIn(self.real_app, shift=UP * 0.2),
            FadeIn(self.fake_city, shift=UP * 0.2),
            run_time=T_REVEAL,
        )
        self.play(
            LaggedStart(
                *[FadeIn(card, shift=RIGHT * 0.3) for card in self.decoys],
                lag_ratio=LAG,
            ),
            run_time=T_SLOW,
        )
        self.play(FadeIn(self.attacker), FadeIn(self.guide), run_time=T_FAST)

        self.decoy_flows = VGroup(
            *[
                make_flow(
                    self.attacker.get_center(),
                    card.get_left(),
                    CLAY if i < 3 else RUST,
                )
                for i, card in enumerate(self.decoys)
            ]
        )
        self.play(
            LaggedStart(*[Create(flow) for flow in self.decoy_flows], lag_ratio=LAG),
            run_time=T_REVEAL,
        )

    def zoom_to_city(self) -> None:
        self.play(
            self.camera.frame.animate.set_width(SAFE_WIDTH),
            run_time=T_CAMERA,
        )

    def touch_each_decoy(self) -> None:
        pulses = [
            Flash(card, color=SAGE if i < 3 else RUST)
            for i, card in enumerate(self.decoys)
        ]
        self.play(LaggedStart(*pulses, lag_ratio=0.2), run_time=T_SLOW)

        self.protected_check = Text("✓  Protected", font_size=15, color=SAGE)
        self.protected_check.next_to(self.real_app, DOWN, buff=0.25)
        self.play(FadeIn(self.protected_check, shift=UP * 0.15), run_time=T_FAST)
        self.wait(T_FAST)

    def show_time_wasted(self) -> None:
        tracker = ValueTracker(0)
        self.add(tracker)

        self.clock = Circle(radius=0.45, color=CLAY, stroke_width=3)
        self.clock.next_to(self.decoys, DOWN, buff=0.4)
        clock_center = self.clock.get_center()

        self.hand = always_redraw(
            lambda: Line(
                clock_center,
                clock_center + rotate_vector(UP * 0.32, -tracker.get_value() * 0.22),
                color=CLAY,
                stroke_width=3,
            )
        )

        # Build the number and its label together so the text never collides.
        def make_counter() -> VGroup:
            number = DecimalNumber(
                tracker.get_value(),
                num_decimal_places=1,
                color=CLAY,
                font_size=22,
            )
            label = Text("attacker seconds wasted", font_size=12, color=TEXT_MUTED)
            return VGroup(number, label).arrange(RIGHT, buff=0.2).next_to(
                self.clock, DOWN, buff=0.12
            )

        self.counter = always_redraw(make_counter)

        self.play(
            Create(self.clock),
            FadeIn(self.hand),
            FadeIn(self.counter),
            run_time=T_REVEAL,
        )
        self.play(tracker.animate.set_value(42.7), run_time=T_SLOW * 2, rate_func=linear)
        self.play(Indicate(self.counter, scale_factor=1.12), run_time=T_FAST)
        self.wait(T_NORMAL)

        self.hand.clear_updaters()
        self.counter.clear_updaters()

    def finish(self) -> None:
        self.play(Restore(self.camera.frame), run_time=T_CAMERA)
        self.play(
            FadeOut(
                self.header,
                self.real_app,
                self.fake_city,
                self.decoys,
                self.attacker,
                self.guide,
                self.decoy_flows,
                self.protected_check,
                self.clock,
                self.hand,
                self.counter,
            ),
            run_time=T_NORMAL,
        )
