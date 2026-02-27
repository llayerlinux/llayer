#!/bin/bash
curl -L -o "{{ZIP_PATH}}" "{{URL}}" --progress-bar 2>"{{CACHE_DIR}}/{{THEME_NAME}}_progress.log"
echo $? > "{{CACHE_DIR}}/{{THEME_NAME}}_exit_code"
