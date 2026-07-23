#!/usr/bin/env bash
# PreToolUse hook: output/form_line/<lp-name>/ 配下の実装ファイル書き込みを
# refactoring-spec.md の存在 + frontmatter `approved: true` で gating する。
#
# matcher: "Write|Edit" (settings.json で設定)
# 通過 → exit 0
# ブロック → JSON で permissionDecision: "deny" を返却

set -euo pipefail

deny() {
  jq -n --arg msg "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $msg
    }
  }'
  exit 0
}

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# [1] スコープ判定: output/form_line/<lp-name>/ 配下か?
if [[ ! "$FILE_PATH" =~ /output/form_line/([^/]+)/ ]]; then
  exit 0
fi
LP_NAME="${BASH_REMATCH[1]}"

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SPEC_PATH="$PROJECT_DIR/output/form_line/$LP_NAME/refactoring-spec.md"

# [2] spec 自体の作成・編集は常に許可
if [[ "$FILE_PATH" == "$SPEC_PATH" ]]; then
  exit 0
fi

# [3] spec 存在チェック
if [[ ! -f "$SPEC_PATH" ]]; then
  deny "refactoring-spec.md が未作成です。先に $SPEC_PATH を作成し、ユーザーレビューを経て frontmatter に approved: true をセットしてから実装ファイルの作成・編集に入ってください。雛形は output/form_line/sururim-chatbot-lp/refactoring-spec.md を参照。"
fi

# [4] frontmatter 承認チェック (先頭の --- ブロックのみ走査)
APPROVED=$(awk '
  BEGIN { count = 0; in_fm = 0 }
  /^---[[:space:]]*$/ {
    count++
    if (count == 1) { in_fm = 1; next }
    if (count == 2) { exit }
  }
  in_fm && /^approved:[[:space:]]*true[[:space:]]*$/ { print "true"; exit }
' "$SPEC_PATH")

if [[ "$APPROVED" != "true" ]]; then
  deny "$SPEC_PATH は未承認です (冒頭 frontmatter に approved: true がありません)。ユーザーに spec をレビューしてもらい、承認を得てから frontmatter の approved を true に更新してください。"
fi

exit 0
