from __future__ import annotations

from manim import *

from helpers import make_badge, make_card, make_header, make_node
from theme import (
    CLAY,
    FONT_MAIN,
    RUST,
    SAGE,
    T_FAST,
    T_NORMAL,
    T_REVEAL,
    T_SLOW,
    TEAL,
    TEXT_DIM,
    TEXT_MUTED,
)


class GateScene(Scene):
    """Known tricks are answered from saved rules. The AI never wakes."""

    def construct(self) -> None:
        self.setup_header()
        self.setup_gate()
        self.scan_the_gate()
        self.transform_attack_to_answer()
        self.show_savings()
        self.cleanup()

    def setup_header(self) -> None:
        self.header = make_header()
        self.play(Write(self.header), run_time=T_NORMAL)

    def setup_gate(self) -> None:
        self.gate = make_node("Front gate", "rules and saved answers", TEAL, width=3.4)
        self.attack = make_card("SQL trick   ' OR 1=1--", RUST, width=3.6)

        pair = VGroup(self.attack, self.gate)
        pair.arrange(RIGHT, buff=0.8).next_to(self.header, DOWN, buff=1.3).set_x(0)

        self.rule_label = Text("Known pattern", font=FONT_MAIN, font_size=14, color=TEXT_DIM)
        self.rule_label.next_to(self.attack, UP, buff=0.2)

        self.play(
            GrowFromCenter(self.gate),
            FadeIn(self.attack, shift=RIGHT * 0.3),
            FadeIn(self.rule_label),
            run_time=T_REVEAL,
        )

    def scan_the_gate(self) -> None:
        self.speed_badge = make_badge("under 1 ms", SAGE)
        self.speed_badge.next_to(self.gate, UP, buff=0.55)

        beam = Line(
            self.gate.get_top() + UP * 0.4,
            self.gate.get_bottom() + DOWN * 0.4,
            color=TEAL,
            stroke_width=5,
        ).set_opacity(0.6)

        self.play(Write(self.speed_badge), run_time=T_FAST)
        self.play(Create(beam), run_time=T_FAST)
        self.play(beam.animate.shift(RIGHT * 0.8), run_time=T_FAST)
        self.play(beam.animate.shift(LEFT * 1.6), run_time=T_FAST)
        self.play(FadeOut(beam), run_time=T_FAST)

    def transform_attack_to_answer(self) -> None:
        focus_point = self.gate.get_center()

        # The gate copy must leave before the attack card occupies its space.
        self.play(
            FadeOut(self.gate, self.rule_label, self.speed_badge),
            run_time=T_FAST,
        )
        self.play(self.attack.animate.move_to(focus_point), run_time=T_REVEAL)

        answer = make_card("Fake ledger reply", TEAL, width=3.6)
        answer.move_to(focus_point)
        self.play(ReplacementTransform(self.attack, answer), run_time=T_REVEAL)
        self.answer = answer
        self.wait(T_FAST)

    def show_savings(self) -> None:
        saved = make_badge("AI stays asleep", SAGE)
        saved.next_to(self.answer, UP, buff=0.55)

        cache = Text(
            "Same trick later? Saved answer, zero model calls.",
            font=FONT_MAIN,
            font_size=15,
            color=TEXT_MUTED,
        )
        cache.next_to(self.answer, DOWN, buff=0.5)

        self.play(FadeIn(saved, shift=UP * 0.2), Write(cache), run_time=T_REVEAL)
        self.play(Indicate(saved, scale_factor=1.12), run_time=T_FAST)
        self.wait(T_SLOW)
        self.saved_badge = saved
        self.cache_note = cache

    def cleanup(self) -> None:
        self.play(
            FadeOut(
                self.header,
                self.answer,
                self.saved_badge,
                self.cache_note,
            ),
            run_time=T_NORMAL,
        )
