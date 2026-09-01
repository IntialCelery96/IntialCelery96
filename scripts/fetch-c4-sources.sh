#!/usr/bin/env bash
# Fetch the Connect 4 primary sources and push them where Claude Code can read
# them. Run from anywhere; nothing is written outside a temp dir and the repo.
set -uo pipefail

REPO="${C4_REPO:-https://github.com/IntialCelery96/IntialCelery96.git}"
BRANCH="${C4_BRANCH:-claude/research-sources}"
WORK="$(mktemp -d)"
REPO_DIR="$WORK/repo"
OUT="$REPO_DIR/docs/sources"

say() { printf '\033[36m>\033[0m %s\n' "$*"; }
ok()  { printf '\033[32m OK \033[0m %s\n' "$*"; }
bad() { printf '\033[31mMISS\033[0m %s\n' "$*"; }

trap 'rm -rf "$WORK"' EXIT

command -v git   >/dev/null || { bad "git is required"; exit 1; }
command -v curl  >/dev/null || { bad "curl is required"; exit 1; }

say "Cloning $REPO"
git clone --quiet --filter=blob:none "$REPO" "$REPO_DIR" || {
  bad "Clone failed. Check you are signed in to GitHub (gh auth login) and try again."
  exit 1
}
mkdir -p "$OUT"

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

say "Downloading primary sources"

# 1. Allis 1988, "A Knowledge-based Approach of Connect-Four" - the origin of the
#    nine strategic rules (ClaimEven, BaseInverse, Vertical, AfterEven, ...).
grab "allis-1988-thesis.pdf" \
  "https://www.informatik.uni-trier.de/~fernau/DSL0607/Masterthesis-Viergewinnt.pdf"

# 2. Pomakis, "How to Play Connect Four Perfectly".
grab "pomakis-expert-play.html" "https://www.pomakis.com/c4/expert_play.html"

# 3. Tromp - exact game-theoretic values and the 8-ply database.
grab "tromp-c4.html"     "https://tromp.github.io/c4/c4.html"
grab "tromp-fhour.html"  "https://tromp.github.io/c4/fhour.html"

# 4. Wikipedia, as raw wikitext (citations intact, no page chrome).
grab "wikipedia-connect-four.wiki" \
  "https://en.wikipedia.org/w/index.php?title=Connect_Four&action=raw"

# 5. Strongly Solving 7x6 Connect-Four on Consumer Grade Hardware (2025).
grab "arxiv-2507.05267-strongly-solving.pdf" "https://arxiv.org/pdf/2507.05267"

# 6. Pascal Pons' solver tutorial - every part, discovered from the sitemap
#    rather than guessed, so we do not miss or invent chapters.
say "Discovering blog.gamesolver.org chapters"
SITEMAP="$WORK/sitemap.xml"
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

# 7. The perfect solver, asked directly for the value of every opening move.
#    This is what turns the solved-game table from "widely reported" into fact.
say "Querying the perfect solver for all 7 openings"
SOLVE="$OUT/solver-openings.txt"
{
  echo "Perfect-solver evaluation of each opening move."
  echo "Endpoint: https://connect4.gamesolver.org/solve?pos=<move sequence>"
  echo "Columns are 1-7 left to right. Empty pos = the initial position."
  echo "A positive score means the side to move wins; 0 is a draw."
  echo
} > "$SOLVE"
for pos in "" 1 2 3 4 5 6 7; do
  body=$(curl -sSL --max-time 45 \
           -H 'Accept: application/json' \
           -A 'Mozilla/5.0 (compatible; connect4-curriculum-research)' \
           "https://connect4.gamesolver.org/solve?pos=${pos}" 2>/dev/null)
  if [ -n "$body" ]; then
    printf 'pos=%-2s %s\n' "${pos:-(start)}" "$body" >> "$SOLVE"
    ok "solver pos=${pos:-(start)}"
  else
    printf 'pos=%-2s NO RESPONSE\n' "${pos:-(start)}" >> "$SOLVE"
    bad "solver pos=${pos:-(start)}"
  fi
  sleep 1
done
printf '| `solver-openings.txt` | see file | <https://connect4.gamesolver.org/> |\n' >> "$MAN"

FOUND=$(find "$OUT" -type f ! -name MANIFEST.md | wc -l | tr -d ' ')
say "$FOUND files in docs/sources"
if [ "$FOUND" -eq 0 ]; then
  bad "Nothing downloaded - not pushing an empty branch."
  exit 1
fi

say "Committing to $BRANCH"
cd "$REPO_DIR" || exit 1
git checkout --quiet -B "$BRANCH"
git add docs/sources
git config user.name  >/dev/null 2>&1 || git config user.name  "Connect4 research fetch"
git config user.email >/dev/null 2>&1 || git config user.email "robertcabezud@gmail.com"
git commit --quiet -m "Add Connect 4 primary sources for curriculum research

Downloaded from a machine with open internet; the Claude Code environment's
egress policy blocks these hosts. See docs/sources/MANIFEST.md for what
resolved and what did not." || { bad "Nothing new to commit"; exit 0; }

say "Pushing"
for attempt in 1 2 3 4; do
  if git push --quiet -u origin "$BRANCH"; then
    ok "Pushed $BRANCH"
    echo
    ok "Done. Tell Claude: \"sources are on $BRANCH\""
    exit 0
  fi
  bad "push failed (attempt $attempt)"
  sleep $((2 ** attempt))
done

BUNDLE="$HOME/c4-sources.zip"
bad "Could not push. Saving a bundle instead."
(cd "$REPO_DIR/docs" && zip -qr "$BUNDLE" sources) \
  && ok "Wrote $BUNDLE - attach it in the chat instead." \
  || bad "zip unavailable; files were in $OUT (now cleaned up)"
exit 1
