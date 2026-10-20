#!/bin/sh
# Relance le serveur de prévisualisation (port 4173) à partir du dernier build.
cd "$(dirname "$0")/.."
for pid in $(pgrep -f "node.*vite.*preview"); do kill "$pid" 2>/dev/null; done
nohup npx vite preview --port 4173 --strictPort > /dev/null 2>&1 &
i=0
while [ $i -lt 50 ]; do
  curl -s localhost:4173 > /dev/null && exit 0
  i=$((i + 1)); sleep 0.2
done
echo "Serveur indisponible" >&2
exit 1
