Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$env:NODE_OPTIONS="--max-old-space-size=4096"
node ./node_modules/jest/bin/jest.js --coverage --testPathPattern="incident.controller.spec"
