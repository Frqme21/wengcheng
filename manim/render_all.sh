#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
export PYTHONPATH="$PWD${PYTHONPATH:+:$PYTHONPATH}"

scenes=(
  "scenes/01_intro.py:IntroScene"
  "scenes/02_route.py:RouteScene"
  "scenes/03_gate.py:GateScene"
  "scenes/04_decoys.py:DecoysScene"
  "scenes/05_report.py:ReportScene"
  "scenes/06_outro.py:OutroScene"
)

mkdir -p output
list="$(pwd)/output/concat.txt"
: > "$list"

for entry in "${scenes[@]}"; do
  file="${entry%%:*}"
  scene="${entry##*:}"
  find media/videos -type f -name "${scene}.mp4" -delete 2>/dev/null || true
  echo "Rendering ${scene}..."
  manim -qh --format=mp4 "$file" "$scene"
  rendered="$(find media/videos -type f -name "${scene}.mp4" | head -n 1)"
  if [[ -z "$rendered" ]]; then
    echo "Missing render for ${scene}" >&2
    exit 1
  fi
  printf "file '%s'\n" "$(pwd)/$rendered" >> "$list"
done

echo "Joining scenes..."
ffmpeg -y -f concat -safe 0 -i "$list" -c copy output/wengcheng.mp4
echo "Finished: $(pwd)/output/wengcheng.mp4"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 output/wengcheng.mp4
