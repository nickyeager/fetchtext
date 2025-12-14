#!/bin/bash
# Monitor GitHub Actions deployment workflow

REPO="nickyeager/fetchtext"
WORKFLOW="deploy-vm.yml"
POLL_INTERVAL=10

echo "🔍 Monitoring deployment workflow: $WORKFLOW"
echo "   Repository: $REPO"
echo "   Poll interval: ${POLL_INTERVAL}s"
echo ""

# Get the latest run
get_latest_run() {
    curl -s "https://api.github.com/repos/$REPO/actions/workflows/$WORKFLOW/runs?per_page=1" \
        | grep -E '"status"|"conclusion"|"html_url"|"created_at"' \
        | head -4
}

# Get run details with job status
get_run_details() {
    local run_id=$1
    curl -s "https://api.github.com/repos/$REPO/actions/runs/$run_id/jobs" \
        | grep -E '"name"|"status"|"conclusion"' \
        | head -30
}

# Check if there are any runs
RUNS=$(curl -s "https://api.github.com/repos/$REPO/actions/workflows/$WORKFLOW/runs?per_page=1" | grep '"total_count"')
TOTAL_COUNT=$(echo "$RUNS" | grep -o '[0-9]*')

if [ "$TOTAL_COUNT" = "0" ]; then
    echo "❌ No workflow runs found yet."
    echo ""
    echo "To trigger the workflow:"
    echo "1. Go to: https://github.com/$REPO/actions/workflows/$WORKFLOW"
    echo "2. Click 'Run workflow' button"
    echo "3. Select branch: feature/document-generation-ui"
    echo "4. Click 'Run workflow'"
    echo ""
    exit 0
fi

# Monitor the latest run
while true; do
    clear
    echo "🔍 Monitoring deployment workflow: $WORKFLOW"
    echo "   Repository: $REPO"
    echo "═══════════════════════════════════════════════"
    echo ""

    # Get latest run info
    RUN_DATA=$(curl -s "https://api.github.com/repos/$REPO/actions/workflows/$WORKFLOW/runs?per_page=1")

    STATUS=$(echo "$RUN_DATA" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    CONCLUSION=$(echo "$RUN_DATA" | grep -o '"conclusion":"[^"]*"' | head -1 | cut -d'"' -f4)
    RUN_URL=$(echo "$RUN_DATA" | grep -o '"html_url":"[^"]*"' | head -1 | cut -d'"' -f4)
    RUN_ID=$(echo "$RUN_DATA" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    CREATED_AT=$(echo "$RUN_DATA" | grep -o '"created_at":"[^"]*"' | head -1 | cut -d'"' -f4)

    echo "📊 Status: $STATUS"
    if [ "$CONCLUSION" != "null" ]; then
        case "$CONCLUSION" in
            "success")
                echo "✅ Result: SUCCESS"
                ;;
            "failure")
                echo "❌ Result: FAILURE"
                ;;
            "cancelled")
                echo "⚠️  Result: CANCELLED"
                ;;
            *)
                echo "🔄 Result: $CONCLUSION"
                ;;
        esac
    fi
    echo "🔗 URL: $RUN_URL"
    echo "⏰ Started: $CREATED_AT"
    echo ""
    echo "📝 Job Steps:"
    echo "─────────────────────────────────────────────"

    # Get job details
    JOBS=$(curl -s "https://api.github.com/repos/$REPO/actions/runs/$RUN_ID/jobs")

    echo "$JOBS" | grep -E '"name"|"status"|"conclusion"' | \
        awk '
            /"name":/ { name=$2; gsub(/[",]/, "", name) }
            /"status":/ { status=$2; gsub(/[",]/, "", status) }
            /"conclusion":/ {
                conclusion=$2; gsub(/[",]/, "", conclusion)
                if (conclusion == "success") icon="✅"
                else if (conclusion == "failure") icon="❌"
                else if (status == "in_progress") icon="⏳"
                else if (status == "queued") icon="⏱️ "
                else icon="⚪"

                if (name != "") {
                    printf "  %s %-40s [%s]\n", icon, name, status
                }
            }
        '

    echo ""
    echo "─────────────────────────────────────────────"

    # Exit if completed
    if [ "$STATUS" = "completed" ]; then
        echo ""
        if [ "$CONCLUSION" = "success" ]; then
            echo "🎉 Deployment completed successfully!"
        else
            echo "💥 Deployment failed. Check logs at: $RUN_URL"
        fi
        echo ""
        exit 0
    fi

    echo ""
    echo "⏳ Refreshing in ${POLL_INTERVAL}s... (Ctrl+C to stop)"
    sleep $POLL_INTERVAL
done
