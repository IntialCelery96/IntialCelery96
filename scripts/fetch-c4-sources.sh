#!/usr/bin/env bash
# Fetch the Connect 4 primary sources that the Claude Code environment's egress
# policy blocks, from a machine with open internet.
#
# Downloads first, into a directory that survives a Ctrl-C, then tries to push.
# Never prompts for credentials: if the push cannot authenticate it says so and
# leaves you a zip to attach instead.
set -uo pipefail

REPO="${C4_REPO:-https://github.com/IntialCelery96/IntialCelery96.git}"
BRANCH="${C4_BRANCH:-claude/research-sources}"
OUT="${C4_OUT:-$HOME/c4-sources}"
export GIT_TERMINAL_PROMPT=0   # fail fast instead of prompting for a username

say() { printf '\033[36m>\033[0m %s\n' "$*"; }
ok()  { printf '\033[32m ok \033[0m %s\n' "$*"; }
bad() { printf '\033[31mmiss\033[0m %s\n' "$*"; }

command -v curl >/dev/null || { bad "curl is required"; exit 1; }

mkdir -p "$OUT" || { bad "cannot write to $OUT"; exit 1; }
MAN="$OUT/MANIFEST.md"
{
  echo "# Connect 4 primary sources"
  echo
  echo "Fetched $(date -u '+%Y-%m-%d %H:%M UTC') from a machine with open internet,"
  echo "because the Claude Code environment's egress policy blocks these hosts."
  echo
  echo "| file | http | source |"
  echo "|---|---|---|"
} > "$MAN"

grab() { # grab <outfile> <url>
  local f="$1" u="$2" code
  code=$(curl -sSL --max-time 90 --retry 2 --retry-delay 2 \
           -A 'Mozilla/5.0 (compatible; connect4-curriculum-research)' \
           -o "$OUT/$f" -w '%{http_code}' "$u" 2>/dev/null) || code="error"
  if [ -s "$OUT/$f" ] && [ "$code" = "200" ]; then
    ok "$f ($(du -h "$OUT/$f" | cut -f1))"
    printf '| `%s` | %s | <%s> |\n' "$f" "$code" "$u" >> "$MAN"
  else
    bad "$f -> $code  $u"
    rm -f "$OUT/$f"
    printf '| `%s` | **FAILED (%s)** | <%s> |\n' "$f" "$code" "$u" >> "$MAN"
  fi
}

say "Downloading into $OUT"

# Allis 1988 - the origin of the nine strategic rules (ClaimEven, AfterEven...).
grab "allis-1988-thesis.pdf" \
  "https://www.informatik.uni-trier.de/~fernau/DSL0607/Masterthesis-Viergewinnt.pdf"
grab "pomakis-expert-play.html" "https://www.pomakis.com/c4/expert_play.html"
grab "tromp-c4.html"            "https://tromp.github.io/c4/c4.html"
grab "tromp-fhour.html"         "https://tromp.github.io/c4/fhour.html"
grab "wikipedia-connect-four.wiki" \
  "https://en.wikipedia.org/w/index.php?title=Connect_Four&action=raw"
grab "arxiv-2507.05267-strongly-solving.pdf" "https://arxiv.org/pdf/2507.05267"

# Pons' solver tutorial: chapters discovered from the sitemap, never guessed.
say "Discovering blog.gamesolver.org chapters"
SITEMAP="$OUT/.sitemap.xml"
if curl -sSL --max-time 60 -o "$SITEMAP" "https://blog.gamesolver.org/sitemap.xml" 2>/dev/null \
   && [ -s "$SITEMAP" ]; then
  n=0
  while read -r url; do
    case "$url" in
      *solving-connect-four*)
        slug=$(printf '%s' "$url" | sed -e 's#/$##' -e 's#.*/##')
        [ -n "$slug" ] || continue
        n=$((n + 1))
        grab "gamesolver-${slug}.html" "$url"
        ;;
    esac
  done < <(grep -o '<loc>[^<]*</loc>' "$SITEMAP" | sed -e 's#</\?loc>##g')
  [ "$n" -gt 0 ] || bad "sitemap held no solving-connect-four pages"
else
  bad "sitemap.xml unreachable - falling back to the index page"
  grab "gamesolver-index.html" "https://blog.gamesolver.org/solving-connect-four/01-introduction/"
fi
rm -f "$SITEMAP"

# The perfect solver, asked for the value of every opening move. This is what
# turns the solved-game table from "widely reported" into a verified fact.
say "Querying the perfect solver for all 7 openings"
SOLVE="$OUT/solver-openings.txt"
{
  echo "Perfect-solver evaluation of each opening move."
  echo "Endpoint: https://connect4.gamesolver.org/solve?pos=<move sequence>"
  echo "Columns are 1-7 left to right. Empty pos = the initial position."
  echo
} > "$SOLVE"
for pos in "" 1 2 3 4 5 6 7; do
  body=$(curl -sSL --max-time 45 -H 'Accept: application/json' \
           -A 'Mozilla/5.0 (compatible; connect4-curriculum-research)' \
           "https://connect4.gamesolver.org/solve?pos=${pos}" 2>/dev/null)
  if [ -n "$body" ]; then
    printf 'pos=%-2s %s\n' "${pos:-start}" "$body" >> "$SOLVE"
    ok "solver pos=${pos:-start}"
  else
    printf 'pos=%-2s NO RESPONSE\n' "${pos:-start}" >> "$SOLVE"
    bad "solver pos=${pos:-start}"
  fi
  sleep 1
done
printf '| `solver-openings.txt` | see file | <https://connect4.gamesolver.org/> |\n' >> "$MAN"

FOUND=$(find "$OUT" -type f ! -name MANIFEST.md | wc -l | tr -d ' ')
echo
say "$FOUND files downloaded to $OUT"
[ "$FOUND" -gt 0 ] || { bad "Nothing downloaded. Check your internet and re-run."; exit 1; }

# Always leave an archive, so a failed push is never a dead end.
ARCHIVE=""
if command -v zip >/dev/null; then
  ARCHIVE="$HOME/c4-sources.zip"; rm -f "$ARCHIVE"
  (cd "$(dirname "$OUT")" && zip -qr "$ARCHIVE" "$(basename "$OUT")") || ARCHIVE=""
elif command -v tar >/dev/null; then
  ARCHIVE="$HOME/c4-sources.tar.gz"
  tar -czf "$ARCHIVE" -C "$(dirname "$OUT")" "$(basename "$OUT")" || ARCHIVE=""
fi
[ -n "$ARCHIVE" ] && ok "Archive: $ARCHIVE"

if [ "${C4_NO_PUSH:-0}" = "1" ]; then
  say "C4_NO_PUSH=1 - skipping the push."
  exit 0
fi

# Push. GIT_TERMINAL_PROMPT=0 means this fails immediately rather than asking
# for a username, so an unauthenticated machine gets guidance, not a prompt.
command -v git >/dev/null || { bad "git not installed - use the archive above."; exit 0; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

say "Cloning to push"
if ! git clone --quiet --filter=blob:none "$REPO" "$TMP/repo" 2>/dev/null; then
  bad "Clone failed - use the archive above instead."
  exit 0
fi
mkdir -p "$TMP/repo/docs/sources"
cp -R "$OUT/." "$TMP/repo/docs/sources/"
cd "$TMP/repo" || exit 0
git checkout --quiet -B "$BRANCH"
git add docs/sources
git config user.name  >/dev/null 2>&1 || git config user.name  "Connect4 research fetch"
git config user.email >/dev/null 2>&1 || git config user.email "robertcabezud@gmail.com"
git commit --quiet -m "Add Connect 4 primary sources for curriculum research

Downloaded from a machine with open internet; the Claude Code environment's
egress policy blocks these hosts. See docs/sources/MANIFEST.md." 2>/dev/null

say "Pushing $BRANCH"
for attempt in 1 2 3 4; do
  if git push --quiet -u origin "$BRANCH" 2>/dev/null; then
    echo; ok "Pushed. Tell Claude: \"sources are on $BRANCH\""
    exit 0
  fi
  [ "$attempt" -lt 4 ] && sleep $((2 ** attempt))
done

echo
bad "Push could not authenticate (this is why git asked for a username)."
echo
echo "  Your GitHub account password will not work - GitHub removed password"
echo "  auth in 2021. Pick either:"
echo
echo "    A. gh auth login     then re-run this script"
echo "    B. Attach ${ARCHIVE:-$OUT} in the chat instead"
echo
exit 0
