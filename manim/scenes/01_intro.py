from __future__ import annotations

from manim import *

from helpers import make_header, make_seal
from theme import (
    CLAY,
    FONT_MAIN,
    TEAL,
    TEXT_MAIN,
    TEXT_MUTED,
    T_FAST,
    T_NORMAL,
    T_REVEAL,
)


class IntroScene(Scene):
    """Opening card. The fake city looks real but holds nothing real."""

    def construct(self) -> None:
        self.show_seal()
        self.show_title()
        self.settle_header()

    def show_seal(self) -> None:
        self.seal = make_seal()
        self.seal.scale(0.78).to_edge(UR, buff=0.8)
        self.play(GrowFromCenter(self.seal), run_time=T_NORMAL)
        self.wait(T_FAST)

    def show_title(self) -> None:
        self.title = Text(
            "Wèngchéng",
            font=FONT_MAIN,
            font_size=46,
            color=TEXT_MAIN,
            weight=BOLD,
        )
        self.subtitle = Text(
            "A fake city behind a real front door",
            font=FONT_MAIN,
            font_size=20,
            color=TEXT_MUTED,
        )
        self.tagline = Text(
            "Let attackers find nothing real.",
            font=FONT_MAIN,
            font_size=17,
            color=CLAY,
        )

        block = VGroup(self.title, self.subtitle, self.tagline)
        block.arrange(DOWN, buff=0.35).move_to(ORIGIN).shift(DOWN * 0.3)

        self.play(Write(self.title), run_time=T_REVEAL)
        self.play(FadeIn(self.subtitle, shift=UP * 0.2), run_time=T_NORMAL)
        self.play(FadeIn(self.tagline, shift=UP * 0.15), run_time=T_NORMAL)
        self.wait(1.2)

    def settle_header(self) -> None:
        target_header = make_header()
        target_title = target_header[0]

        # Clear the center copy completely before the title leaves the center.
        self.play(
            FadeOut(self.subtitle, shift=UP * 0.15),
            FadeOut(self.tagline, shift=UP * 0.15),
            run_time=T_FAST,
        )
        self.play(ReplacementTransform(self.title, target_title), run_time=T_REVEAL)
        self.play(FadeIn(target_header[1], shift=RIGHT * 0.2), run_time=T_FAST)
        self.play(Flash(self.seal, color=TEAL), run_time=T_FAST)
        self.wait(0.8)
