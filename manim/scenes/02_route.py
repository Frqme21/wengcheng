from __future__ import annotations

from manim import *

from helpers import make_flow, make_header, make_node, make_packet, make_path
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
    TEXT_DIM,
)


class RouteScene(MovingCameraScene):
    """One request reaches either the real app or the fake city."""

    def construct(self) -> None:
        self.camera.frame.save_state()
        self.setup_header()
        self.build_route()
        self.show_normal_path()
        self.show_hostile_path()
        self.return_to_full_view()

    def setup_header(self) -> None:
        self.header = make_header()
        self.play(Write(self.header), run_time=T_NORMAL)

    def build_route(self) -> None:
        self.incoming = make_node("Requests", "arriving now", TEXT_DIM, width=2.4)
        self.gate = make_node("Front gate", "decides in under 1 ms", TEAL, width=3.0)
        self.real_app = make_node("Real app", "normal visitors pass through", TEAL, width=3.4)
        self.fake_city = make_node("Fake city", "suspicious visitors get decoys", CLAY, width=3.4)

        self.incoming.next_to(self.header, DOWN, buff=1.2).to_edge(LEFT, buff=1.0)
        self.gate.next_to(self.incoming, RIGHT, buff=1.0).align_to(self.incoming, DOWN)
        self.real_app.next_to(self.gate, RIGHT, buff=1.4).shift(UP * 1.0)
        self.fake_city.next_to(self.gate, RIGHT, buff=1.4).shift(DOWN * 1.0)

        self.flow_in = make_flow(self.incoming.get_right(), self.gate.get_left(), TEAL)
        self.flow_to_real = make_flow(self.gate.get_right(), self.real_app.get_left(), TEAL)
        self.flow_to_fake = make_flow(self.gate.get_right(), self.fake_city.get_left(), CLAY)

        self.play(
            LaggedStart(
                FadeIn(self.incoming, shift=LEFT * 0.3),
                GrowFromCenter(self.gate),
                FadeIn(self.real_app, shift=UP * 0.3),
                FadeIn(self.fake_city, shift=DOWN * 0.3),
                lag_ratio=LAG,
            ),
            run_time=T_SLOW,
        )
        self.play(
            LaggedStart(
                Create(self.flow_in),
                Create(self.flow_to_real),
                Create(self.flow_to_fake),
                lag_ratio=LAG,
            ),
            run_time=T_REVEAL,
        )
        self.wait(T_FAST)

    def show_normal_path(self) -> None:
        label = Text("Normal visitor", font_size=17, color=SAGE)
        label.next_to(self.real_app, UP, buff=0.3)

        packet = make_packet(SAGE)
        packet.move_to(self.incoming.get_center())
        path = make_path(
            self.incoming.get_center(),
            self.gate.get_center(),
            self.real_app.get_center(),
        )

        self.play(FadeIn(label), run_time=T_FAST)
        self.play(MoveAlongPath(packet, path), run_time=T_SLOW, rate_func=linear)
        self.play(
            self.real_app[0].animate.set_stroke(SAGE, width=4),
            Flash(self.real_app, color=SAGE),
            run_time=T_FAST,
        )
        self.wait(T_NORMAL)
        self.play(
            FadeOut(packet),
            FadeOut(label),
            self.real_app[0].animate.set_stroke(TEAL, width=2),
            run_time=T_FAST,
        )

    def show_hostile_path(self) -> None:
        label = Text("Suspicious visitor", font_size=17, color=RUST)
        label.next_to(self.fake_city, UP, buff=0.3)

        packet = make_packet(RUST)
        packet.move_to(self.incoming.get_center())
        path = make_path(
            self.incoming.get_center(),
            self.gate.get_center(),
            self.fake_city.get_center(),
        )

        self.play(FadeIn(label), run_time=T_FAST)
        self.play(
            self.camera.frame.animate.set_width(SAFE_WIDTH),
            run_time=T_CAMERA,
        )
        self.play(MoveAlongPath(packet, path), run_time=T_SLOW, rate_func=linear)
        self.play(
            self.fake_city[0].animate.set_stroke(RUST, width=4),
            Flash(self.fake_city, color=CLAY),
            run_time=T_FAST,
        )
        self.wait(T_NORMAL)
        self.play(
            FadeOut(packet),
            FadeOut(label),
            self.fake_city[0].animate.set_stroke(CLAY, width=2),
            run_time=T_FAST,
        )

    def return_to_full_view(self) -> None:
        self.play(Restore(self.camera.frame), run_time=T_CAMERA)
        self.wait(0.6)
        self.play(
            FadeOut(
                self.header,
                self.incoming,
                self.gate,
                self.real_app,
                self.fake_city,
                self.flow_in,
                self.flow_to_real,
                self.flow_to_fake,
            ),
            run_time=T_NORMAL,
        )
