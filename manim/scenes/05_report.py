from __future__ import annotations

from manim import *

from helpers import make_badge, make_card, make_header, make_report_card
from theme import (
    FONT_MAIN,
    LAG,
    PLUM,
    RUST,
    SAGE,
    T_FAST,
    T_NORMAL,
    T_REVEAL,
    T_SLOW,
    TEAL,
    TEXT_DIM,
    TEXT_MUTED,
    TOKENS_SAVED,
)


class ReportScene(Scene):
    """The AI turns attack traces into one plain-English report."""

    def construct(self) -> None:
        self.setup_header()
        self.collect_traces()
        self.wake_ai()
        self.build_report()
        self.show_saving()
        self.cleanup()

    def setup_header(self) -> None:
        self.header = make_header()
        self.play(Write(self.header), run_time=T_NORMAL)

    def collect_traces(self) -> None:
        self.traces = VGroup(
            *[
                make_card(name, RUST, width=3.3, height=0.7)
                for name in ["SQL trick", "Secret file scan", "New endpoint"]
            ]
        )
        self.traces.arrange(DOWN, buff=0.3)
        self.traces.next_to(self.header, DOWN, buff=1.0).to_edge(LEFT, buff=1.0)

        self.trace_label = Text(
            "What the attacker tried",
            font=FONT_MAIN,
            font_size=15,
            color=TEXT_DIM,
        )
        self.trace_label.next_to(self.traces, UP, buff=0.35)

        self.play(
            FadeIn(self.trace_label),
            LaggedStartMap(
                FadeIn,
                self.traces,
                shift=RIGHT * 0.25,
                lag_ratio=LAG,
            ),
            run_time=T_REVEAL,
        )

    def wake_ai(self) -> None:
        self.spark = Star(
            n=6,
            outer_radius=0.38,
            inner_radius=0.17,
            color=PLUM,
            fill_opacity=0.9,
        )
        self.spark.next_to(self.traces, RIGHT, buff=1.3)

        provider = make_badge("NVIDIA NIM", PLUM)
        provider.next_to(self.spark, DOWN, buff=0.3)

        self.play(GrowFromCenter(self.spark), Flash(self.spark, color=PLUM), run_time=T_REVEAL)
        self.play(FadeIn(provider, shift=UP * 0.2), run_time=T_FAST)
        self.provider = provider
        self.wait(T_FAST)

    def build_report(self) -> None:
        lines = [
            "Tried an old SQL trick",
            "Went looking for secret files",
            "Asked for something new",
            "Action: keep this session watched",
        ]
        report = make_report_card(lines, TEAL)
        report.next_to(self.traces, RIGHT, buff=0.9)

        self.play(
            ReplacementTransform(self.traces, report),
            FadeOut(self.trace_label, self.spark, self.provider),
            run_time=T_REVEAL,
        )
        self.play(Indicate(report, scale_factor=1.03), run_time=T_FAST)
        self.wait(T_NORMAL)
        self.report = report

    def show_saving(self) -> None:
        self.saved_badge = make_badge("Saved for free reuse", SAGE)
        self.saved_badge.next_to(self.report, DOWN, buff=0.4)

        tracker = ValueTracker(0)
        self.add(tracker)

        # The number and label are one dynamic group, so the label always
        # moves aside as the value grows to four digits.
        def make_counter() -> VGroup:
            number = DecimalNumber(
                tracker.get_value(),
                num_decimal_places=0,
                color=SAGE,
                font_size=28,
            )
            label = Text("tokens saved", font=FONT_MAIN, font_size=14, color=TEXT_MUTED)
            return VGroup(number, label).arrange(RIGHT, buff=0.2).next_to(
                self.saved_badge, DOWN, buff=0.3
            )

        self.counter_group = always_redraw(make_counter)
        self.play(
            FadeIn(self.saved_badge, shift=UP * 0.15),
            FadeIn(self.counter_group),
            run_time=T_REVEAL,
        )
        self.play(
            tracker.animate.set_value(TOKENS_SAVED),
            run_time=T_SLOW,
            rate_func=smooth,
        )
        self.wait(T_NORMAL)

    def cleanup(self) -> None:
        self.play(
            FadeOut(
                self.header,
                self.report,
                self.saved_badge,
                self.counter_group,
            ),
            run_time=T_NORMAL,
        )
