SET NODE_ENV=production

IF EXIST chrome.zip DEL chrome.zip
IF EXIST firefox.zip DEL firefox.zip
IF EXIST source.zip DEL source.zip

CALL yarn run build

"c:\Program Files\7-Zip\7z.exe" a chrome.zip ".\build_chrome\*"
"c:\Program Files\7-Zip\7z.exe" a firefox.zip ".\build_firefox\*"
"c:\Program Files\7-Zip\7z.exe" a source.zip * -x!node_modules -x!build_chrome -x!build_firefox -x!.git -x!.vscode
