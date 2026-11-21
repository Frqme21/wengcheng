from __future__ import annotations

from manim import *

from theme import (
    BG_COLOR,
    CARD_BUFF,
    FONT_CJK,
    FONT_MAIN,
    FONT_MONO,
    NODE_HEIGHT,
    NODE_WIDTH,
    PANEL,
    RAISED,
    TEXT_DIM,
    TEXT_MAIN,
    TEXT_MUTED,
    TEAL,
)


def make_header() -> VGroup:
    title = Text("WENGCHENG", font=FONT_MONO, font_size=28, color=TEXT_MAIN, weight=BOLD)
    subtitle = Text("Fake city, real requests", font=FONT_MAIN, font_size=15, color=TEXT_MUTED)
    group = VGroup(title, subtitle).arrange(RIGHT, buff=0.5)
    group.to_edge(UP, buff=0.7).to_edge(LEFT, buff=1.0)
    return group


def make_seal() -> VGroup:
    diamond = Square(side_length=1.35, color=TEAL, stroke_width=2).rotate(PI / 4)
    glyph = Text("瓮", font=FONT_CJK, font_size=52, color=TEAL)
    glyph.move_to(diamond)
    return VGroup(diamond, glyph)


def make_node(
    title: str,
    subtitle: str,
    color: str,
    width: float = NODE_WIDTH,
    height: float = NODE_HEIGHT,
) -> VGroup:
    box = RoundedRectangle(
        width=width,
        height=height,
        corner_radius=0.16,
        color=color,
        stroke_width=2,
        fill_color=PANEL,
        fill_opacity=0.96,
    )
    title_text = Text(title, font=FONT_MAIN, font_size=19, color=TEXT_MAIN, weight=BOLD)
    subtitle_text = Text(subtitle, font=FONT_MAIN, font_size=12.5, color=TEXT_MUTED)
    label = VGroup(title_text, subtitle_text).arrange(DOWN, buff=0.08)
    label.move_to(box)
    return VGroup(box, label)


def make_card(title: str, color: str, width: float = 2.5, height: float = 0.78) -> VGroup:
    box = RoundedRectangle(
        width=width,
        height=height,
        corner_radius=0.13,
        color=color,
        stroke_width=1.6,
        fill_color=RAISED,
        fill_opacity=0.98,
    )
    label = Text(title, font=FONT_MAIN, font_size=14, color=TEXT_MAIN)
    label.move_to(box)
    return VGroup(box, label)


def make_badge(text: str, color: str, font_size: float = 13) -> VGroup:
    label = Text(text, font=FONT_MONO, font_size=font_size, color=color)
    box = RoundedRectangle(
        width=label.width + 0.5,
        height=0.42,
        corner_radius=0.21,
        color=color,
        stroke_width=1.3,
        fill_color=PANEL,
        fill_opacity=0.95,
    )
    label.move_to(box)
    return VGroup(box, label)


def make_callout(text: str, color: str, font_size: float = 16) -> Text:
    label = Text(text, font=FONT_MAIN, font_size=font_size, color=color, weight=BOLD)
    label.set_z_index(10)
    label.add_background_rectangle(color=BG_COLOR, opacity=0.9, buff=CARD_BUFF * 0.3)
    return label


def make_flow(start: np.ndarray, end: np.ndarray, color: str) -> DashedVMobject:
    return DashedVMobject(Line(start, end, color=color, stroke_width=2), num_dashes=18)


def make_path(*points: np.ndarray) -> VMobject:
    path = VMobject()
    path.set_points_smoothly(list(points))
    return path


def make_packet(color: str, radius: float = 0.1) -> Dot:
    return Dot(radius=radius, color=color, fill_opacity=1, stroke_width=0).set_z_index(10)


def make_report_card(lines: list[str], color: str = TEAL) -> VGroup:
    title = Text("Incident report", font=FONT_MAIN, font_size=21, color=TEXT_MAIN, weight=BOLD)
    bullets = VGroup(
        *[
            Text(f"•  {line}", font=FONT_MAIN, font_size=15, color=TEXT_MUTED)
            for line in lines
        ]
    ).arrange(DOWN, aligned_edge=LEFT, buff=0.22)
    content = VGroup(title, bullets).arrange(DOWN, aligned_edge=LEFT, buff=0.35)
    box = RoundedRectangle(
        width=content.width + 0.9,
        height=content.height + 0.7,
        corner_radius=0.18,
        color=color,
        stroke_width=1.8,
        fill_color=PANEL,
        fill_opacity=0.98,
    )
    content.move_to(box)
    return VGroup(box, content)


def make_stat_label(text: str, color: str) -> Text:
    return Text(text, font=FONT_MONO, font_size=14, color=color)
