from __future__ import annotations

from manim import *

from helpers import make_badge
from theme import (
    FONT_MAIN,
    LAG,
    PLUM,
    SAGE,
    T_FAST,
    T_NORMAL,
    T_REVEAL,
    TEAL,
    TEXT_MAIN,
    TEXT_MUTED,
)


class OutroScene(Scene):
    """Close on the one thing the viewer should remember."""

    def construct(self) -> None:
        title = Text(
            "Fake city, real requests.",
            font=FONT_MAIN,
            font_size=42,
            color=TEXT_MAIN,
            weight=BOLD,
        )
        subtitle = Text(
            "You can try every step in the dashboard.",
            font=FONT_MAIN,
            font_size=18,
            color=TEXT_MUTED,
        )
        title_group = VGroup(title, subtitle).arrange(DOWN, buff=0.35)

        self.play(Write(title), run_time=T_REVEAL)
        self.play(FadeIn(subtitle, shift=UP * 0.2), run_time=T_NORMAL)
        self.play(Circumscribe(title, color=TEAL, buff=0.18), run_time=T_FAST)
        self.wait(T_FAST)

        chips = VGroup(
            make_badge("Normal visitors pass", SAGE),
            make_badge("Attackers wait", PLUM),
            make_badge("AI only when needed", TEAL),
        ).arrange(RIGHT, buff=0.35)
        chips.next_to(title_group, DOWN, buff=0.8)

        self.play(
            LaggedStartMap(FadeIn, chips, shift=UP * 0.2, lag_ratio=LAG),
            run_time=T_REVEAL,
        )
        self.wait(T_NORMAL)
        self.play(FadeOut(title_group, chips), run_time=T_NORMAL)
