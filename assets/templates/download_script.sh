#!/bin/bash

echo "=== DOWNLOAD START ==="
echo "URL: {{URL}}"
echo "Target: {{OUTPUT_PATH}}"
echo "Timestamp: $(date)"

if [ -f "{{OUTPUT_PATH}}" ]; then
    echo "Removing existing file..."
    rm -f "{{OUTPUT_PATH}}"
fi

echo "Starting download..."
if command -v wget >/dev/null; then
    echo "Using wget..."
    wget --timeout={{WGET_TIMEOUT}} --tries=3 --show-progress --progress=bar:force:noscroll -O "{{OUTPUT_PATH}}" "{{URL}}"
    DOWNLOAD_STATUS=$?
else
    echo "Using curl..."
    curl -L --max-time {{CURL_TIMEOUT}} --retry 3 --progress-bar -o "{{OUTPUT_PATH}}" "{{URL}}"
    DOWNLOAD_STATUS=$?
fi

echo "Status: $DOWNLOAD_STATUS"
echo "Size: $([ -f "{{OUTPUT_PATH}}" ] && du -b "{{OUTPUT_PATH}}" | cut -f1 || echo "0")"
echo "=== DOWNLOAD END ==="

exit $DOWNLOAD_STATUS
