export function generateLaunchdPlist(scriptPath: string, queuePath: string, nodePath = process.execPath || "/usr/local/bin/node"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.x-auto-scheduler</string>
    <key>ProgramArguments</key>
    <array>
        <string>${nodePath}</string>
        <string>${scriptPath}</string>
        <string>run-pending</string>
        <string>--queue</string>
        <string>${queuePath}</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>StandardOutPath</key>
    <string>/tmp/x-scheduler.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/x-scheduler.err</string>
</dict>
</plist>
`;
}
